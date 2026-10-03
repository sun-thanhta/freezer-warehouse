# E-02-S03: 設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004）

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-02-S03 |
| ストーリー名 | Phiên bản cấu hình + change request maker-checker (ADR-004)（和訳：設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004）） |
| 関連Epic | E-02（マスタ・顧客×SKU契約 ＝ F01） |
| 関連機能ID | FE-04 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）として、温度帯しきい値・SKU の期限種別・顧客×SKU 契約の納品期限といったハードストップを左右する設定の変更を、申請者とは別の承認者が内容と適用開始日を確認してから有効にしたい。なぜなら、1 人の判断で賞味 ↔ 消費や温度しきい値を切り替えると全ロットの判定が即座に変わってしまい、RFP のメーカー・チェッカー要件（NFR-SEC-02、DR-MST-01）を満たせないからだ。

## 3. 背景・目的

- ハードストップを左右する設定は 3 種類ある（ADR-004）：温度帯しきい値（受入・拒否・隔離、出荷可否）、SKU の期限種別（ハードストップ ① の有無）、契約の納品期限（④）。
- プロトタイプは manager が現行値を直接上書きし、トリガーで変更前後を監査するだけだった。そのため「当時のしきい値」が分からず、第二の確認者もおらず、適用日の予約もできなかった（差分 D-05、D-06、D-21）。
- 対象設計（ADR-004）：
  1. 高リスク設定はバージョン表（`effective_from` は含む、`effective_to` は含まない・NULL ＝ 現在有効、`approved_by`、`approved_at`）で持つ。
  2. ルールは基準日に有効なバージョンを `zone_range_at()`・`product_rule_at()`・`agreement_at()` で読む。
  3. 変更はすべて `change_requests`（`entity`、`entity_id`、`payload_before`、`payload_after`、`effective_from`、`status` ∈ {pending, approved, rejected, cancelled}、`requested_by`、`decided_by`、`decision_note`）を通す。承認者 ≠ 申請者。承認したときに初めて新バージョンを作る（1 トランザクション）。
  4. 承認前に影響（在庫ロット数・結果が変わる未出荷明細数）を表示する。
  5. 変更申請自体も監査する（`change.request` / `change.approve` / `change.reject`）。
- 本ストーリーは、この共通の仕組みと承認待ち一覧（ロードマップ P1 の「マスタ承認待ち一覧（SCR-05 のマスタ部分）」）を作る。E-04-S01（温度帯）、E-02-S02（SKU）、E-02-S04（契約）はこの仕組みに乗る。

## 4. 対象ユーザー

| ロールコード | 申請 | 承認・却下 | 備考 |
| --- | --- | --- | --- |
| manager（倉庫管理者） | 可（温度帯・SKU・納品期限） | 可（自分の申請は不可） | 主な承認者 |
| qa（品質管理） | 可（温度帯・SKU） | 不可（§10 で確認） | 権限マトリクス §3.3 |
| admin（システム管理） | 可（温度帯・SKU） | 不可（§10 で確認。時間外の緊急承認案あり） | |
| sales（営業・CS） | 可（納品期限のみ） | 不可 | |
| warehouse（倉庫作業者） | 不可 | 不可 | 一覧の閲覧のみ |
| auditor（監査・閲覧のみ） | 不可 | 不可 | 一覧・監査の閲覧のみ |

申請者本人は、取り消し（cancelled）はできるが承認・却下はできない。

## 5. スコープ

**スコープ内**
- テーブル `change_requests`（CHECK `decided_by <> requested_by`、同じ対象に承認待ちは 1 件だけ＝部分一意インデックス `(entity, entity_id) where status = 'pending'`、`requested_by` / `decided_by` → `app_users`）。
- `SECURITY DEFINER` 関数（`search_path = public, pg_temp`、`auth.uid()`・ユーザー情報・ロール・業務ルールを関数内で確認）：
  - 申請登録：対象ごとの申請可能ロールと値の妥当性を確認し、`payload_before` は DB が現行バージョンから自分で読む（クライアントの値を信用しない）。
  - `decide_change_request`：承認なら、前バージョンの `effective_to` を閉じて新バージョンを 1 行作る（1 トランザクション）。却下は理由必須。申請者本人なら `SELF_APPROVAL`。
  - 取り消し：申請者本人のみ、承認待ちのときだけ。
- 汎用の仕組みとして、バージョン表への反映を対象（`entity`）ごとに差し替えられる形で作り、[ASSUMPTION] 最初の対象として E-02-S02 の `product_versions` に接続する。温度帯（E-04-S01）と契約（E-02-S04）は各ストーリーで接続する。
- `authenticated` からバージョン表への直接書き込み権限を一切与えない（D-06、D-21 を作らない）。
- 監査：`change.request` / `change.approve` / `change.reject`（E-01-S03 の `audit_logs`）。バージョン表自体にも `audit_config_change` を付ける。
- 承認待ち一覧画面（SCR-05 のマスタ部分）：対象・変更前 → 変更後・適用開始日・申請者・申請日時を表示し、承認者には「承認」「却下（理由入力）」、申請者には「取り消し」を出す。承認済み・却下・取り消しの履歴タブ。
- [ASSUMPTION] API：`GET /api/change-requests?status=`、`POST /api/change-requests`、`POST /api/change-requests/[id]/decision {approve, note}`、`POST /api/change-requests/[id]/cancel`（いずれも `withAuth`、RPC 呼び出し）。
- [ASSUMPTION] 適用開始日は JST の今日以降のみ受け付ける。
- バージョン参照関数の共通テスト方針（前日・当日・翌日の境界）を定め、E-02-S02 の `product_rule_at` で実証する。

**スコープ外**
- 各設定画面の入力 UI（SKU：E-02-S02、温度帯：E-04-S01、納品期限：E-02-S04）。
- [ASSUMPTION] 承認前の影響表示（在庫ロット数・未出荷明細数）は、ロット・出荷テーブルができる E-03 / E-05 以降に追加する。本ストーリーでは表示枠と「影響件数：未計算」の表示まで。
- 承認依頼のメール通知 → E-12-S02（IF-MAIL-01）。
- 日付逆転の例外申請（出荷側のメーカー・チェッカー）→ E-06-S02。
- 名称・住所などの非高リスクマスタのバージョン化（ADR-004 の不採用案 E。監査で足りる）。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. qa（申請者）が SKU 設定画面で CHI-004 の期限接近日数を 2 → 3 に変え、適用開始日 2026-12-15 で保存する（E-02-S02 の画面）。
2. 申請登録関数が、ロール・値・適用開始日を検証し、現行バージョンを `payload_before` として読み、`change_requests` に `pending` で 1 行作る。監査 `change.request` が同じトランザクションで記録される。
3. manager（承認者、申請者とは別人）が承認待ち一覧を開き、変更前 → 変更後と適用開始日を確認して「承認」を押す。
4. `decide_change_request` が申請を `FOR UPDATE` でロックし、承認待ちであること・承認者 ≠ 申請者・承認ロールを確認したうえで、前バージョンの `effective_to` を 2026-12-15 に閉じ、新バージョン（`effective_from` = 2026-12-15、`approved_by` = 承認者）を作る。申請は `approved`、監査 `change.approve` が記録される。
5. 2026-12-14 までは旧値、2026-12-15 以降は新値が `product_rule_at()` から返る。

**代替・例外フロー**
- 申請者本人が承認しようとする：403「申請者本人は承認できません（メーカー・チェッカー）。別の承認者が必要です。」（`SELF_APPROVAL`）。UI でも本人には承認ボタンを出さない。
- 承認ロールを持たない人が承認：403「この操作を行う権限がありません。」（`FORBIDDEN`）。
- 申請ロールを持たない人が申請：403（`FORBIDDEN`）。
- すでに処理済みの申請を承認・却下・取り消し：409「申請はすでに処理されています。」（`REQUEST_NOT_PENDING`）。
- 理由なしで却下：422「理由の入力は必須です。」（`REASON_REQUIRED`）。
- 同じ対象に承認待ちがすでにある：409「この対象には承認待ちの変更申請がすでにあります。」（[ASSUMPTION] 文言は仮訳）（一意制約 `23505` を BFF で変換）。
- [ASSUMPTION] 適用開始日が過去：422「適用開始日は今日以降を指定してください。」
- 値の妥当性違反（例：`near_expiry_days` 366、しきい値 min > max、納品期限 NULL）：422（各対象の検証。DB の CHECK でも防ぐ）。
- 存在しない申請 ID・形式不正：404。JSON 不正：400。
- 未ログイン：401。ユーザー情報なし：403（`NO_PROFILE`）。DB 接続不可：503。
- 2 人の承認者がほぼ同時に承認：行ロックにより 1 人だけ成功し、もう 1 人は 409。
- 承認処理の途中でエラー：新バージョン・申請状態・監査がすべてロールバックされる。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 申請 ID | `change_requests.id` | 表示のみ | uuid |
| 対象種別・対象 ID | `change_requests.entity`・`entity_id` | 表示のみ | 例：`product_versions` / CHI-004 |
| 変更前 | `change_requests.payload_before` | 表示のみ | DB が現行バージョンから取得 |
| 変更後 | `change_requests.payload_after` | 編集可（申請時のみ） | 対象ごとに検証 |
| 適用開始日 | `change_requests.effective_from` | 編集可（申請時のみ） | JST の日付 |
| 状態 | `change_requests.status` | 表示のみ | pending → approved / rejected / cancelled（終状態は変更不可） |
| 申請者・申請日時 | `change_requests.requested_by` → `app_users.full_name`、`created_at` | 表示のみ | |
| 承認者・判定理由・判定日時 | `change_requests.decided_by`・`decision_note`・`decided_at` | 編集可（承認者が判定時に入力） | 却下は理由必須 |
| バージョン | `product_versions` / `temperature_zone_versions` / `customer_sku_agreements` の `effective_from`・`effective_to`・`approved_by` | 表示のみ | 承認時に DB が作成 |
| 監査 | `audit_logs`（`change.*`） | 表示のみ | E-01-S03 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR・要件：NFR-SEC-02（申請者と承認者の分離）、DR-MST-01（有効日付管理＋メーカー・チェッカー）、BR-TEMP-01（しきい値は有効日付つき）、BR-EXP-01、BR-DELWIN-01、NFR-AUD-01、NFR-LOC-01（日付は JST）、NFR-PERF-01（書き込み p95 ≤ 3 秒）。
- ADR-004（本ストーリーの根拠）：`EXCLUDE USING gist` のため `btree_gist` を有効化。参照は必ず `*_at(date)` 経由。
- ADR-001：申請・承認・取り消しは `SECURITY DEFINER` 関数のみ。内部ヘルパーには execute を付与しない。`SECURITY DEFINER` を含むマイグレーションはセキュリティレビュー必須。
- 業務ルールの二重実装：申請可能ロール・承認可否の判定は TS（UI 表示）と SQL（最終判断）の両方に置き、両方テストする。
- ADR-006：ローカル実行のみ。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] Given qa が作成した承認待ち申請、When 同じ qa が承認、Then `SELF_APPROVAL`（403）で失敗し、申請は `pending` のまま（pgTAP＋E2E、D-011）。
- [ ] Given 別の manager、When 承認、Then 前バージョンの `effective_to` が適用開始日で閉じ、新バージョンがちょうど 1 行でき、申請は `approved`、`change.approve` の監査が 1 行記録される（pgTAP、D-011）。
- [ ] 承認後、`product_rule_at` が適用開始日の前日は旧値、当日・翌日は新値を返す（pgTAP＋単体、D-002）。
- [ ] 同じ対象に 2 件目の承認待ち申請を作ると 409、処理済み申請への再判定は `REQUEST_NOT_PENDING`（409）、理由なしの却下は `REASON_REQUIRED`（422）になる（pgTAP＋API テスト、D-011）。
- [ ] `change_requests` に `decided_by = requested_by` の行は CHECK で入らない。`authenticated` はバージョン表・`change_requests` に直接 INSERT / UPDATE / DELETE できない（`42501`）（pgTAP、D-011）。
- [ ] 承認処理の途中で例外を起こすと、新バージョン・申請状態・監査がすべて残らない（pgTAP、D-011）。
- [ ] 承認待ち一覧で、申請者本人には「取り消し」だけ、別の manager には「承認」「却下」が表示され、warehouse・auditor には操作ボタンが出ない（E2E、D-001）。
- [ ] 画面の日付が `yyyy/mm/dd`（JST）で表示され、文言にベトナム語が残っていない（E2E、D-014）。
- [ ] `api-specification.md` に新しい API を追記し、`business-rules-and-state-machines.md` に変更申請の状態遷移と新しいエラーコードを追記、`03-implementation-status.md` を更新している（レビュー、D-015）。
- [ ] `npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` がすべて成功する（D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] API を `GET /api/change-requests`、`POST /api/change-requests`、`POST /api/change-requests/[id]/decision`、`POST /api/change-requests/[id]/cancel` とする | API 仕様 A01〜A21 に変更申請の API がない | テックリード | S1 開始（2026-11-30） |
| 2 | 未決：承認できるロール。案は「manager のみ（申請者以外）」。qa・admin にも承認権を与えるか、対象（温度帯・SKU・納品期限）ごとに変えるか | ADR-004 は「承認者 ≠ 申請者」のみ規定。権限マトリクスに承認列がない | お客様 | M-02（2026-10-30） |
| 3 | [ASSUMPTION] 適用開始日は JST の今日以降のみ。過去日は 422 で拒否する | ADR-004 は将来日付の予約を想定。過去日の扱いは未定義 | PM / お客様 | M-03（2026-11-27） |
| 4 | 未決：緊急変更の手順（しきい値の誤りで入荷が全停止した場合など）。案は「manager 2 名がオンライン」または「時間外は admin が承認」 | ADR-004 の「悪い結果」に課題として記載 | お客様 | M-03（2026-11-27） |
| 5 | [ASSUMPTION] 承認前の影響表示は E-03 / E-05 以降に追加する。本ストーリーでは表示枠のみ | ADR-004 決定 4。S1 時点でロット・出荷テーブルがない | テックリード / PM | S2 開始（2026-12-14） |
| 6 | [ASSUMPTION] 最初の接続対象は E-02-S02 の `product_versions`。温度帯（E-04-S01）と契約（E-02-S04）は各ストーリーで接続する | 同じ S1 に E-02-S02 があり、E-04-S01・E-02-S04 は本ストーリーに依存 | テックリード | S1 開始（2026-11-30） |
| 7 | [ASSUMPTION] 新しいエラー（承認待ち重複 409、過去の適用開始日 422）の文言と、画面文言全体は設計書を基にした仮訳とし、E-13-S01 で確定する | 既存のエラーコード一覧に該当なし。NFR-LOC-01 | テックリード / PM | S1 開始（2026-11-30） |
| 8 | 規模：共通の仕組み（テーブル・関数 3 本・承認待ち画面・API 4 本）に加えて最初の対象との結合があり、S1 の中で最も重い。溢れる場合は履歴タブを次スプリントへ回すかを PM が判断する（ID・名称は変更しない） | S1 には他に 6 ストーリーがある。E-04-S01 と E-02-S04 が本ストーリー完了を待つ | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-02-S03 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-002、D-011、D-014、D-015、D-019）
- 関連機能ID：FE-04（`function-list.md` は未作成のため暫定キー）
- 関連 NFR・要件：NFR-SEC-02、DR-MST-01、BR-TEMP-01、BR-EXP-01、BR-DELWIN-01、NFR-AUD-01、NFR-LOC-01、NFR-PERF-01
- ADR：[adr-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2 `change_requests`・バージョン表、§5 `decide_change_request`）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05、D-06、D-21）
- 基本設計：[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3）、[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.6.6）
- 詳細設計：[scr-05-date-reversal-alerts-and-approval.md](../../../docs/03-detail-design/scr-05-date-reversal-alerts-and-approval.md)（承認画面の構成の参考）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（§6 エラーコード）、[api-specification.md](../../../docs/03-detail-design/api-specification.md)
- 開発ロードマップ：[development-roadmap.md](../../../docs/development-roadmap.md)（P1）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
