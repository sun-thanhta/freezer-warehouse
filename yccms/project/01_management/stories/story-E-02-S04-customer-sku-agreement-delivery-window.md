# E-02-S04: 顧客×SKU 契約（納品期限 1/3・1/2・ラベル期限のみ の確定）

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-02-S04 |
| ストーリー名 | Hợp đồng khách-SKU: chốt delivery window 1/3 · 1/2 · chỉ hạn nhãn（和訳：顧客×SKU 契約：納品期限（delivery window）1/3・1/2・ラベル期限のみ の確定） |
| 関連Epic | E-02（マスタ・顧客×SKU契約 ＝ F01） |
| 関連機能ID | SCR-03, FE-02, FE-17 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

営業・CS（sales）・倉庫管理者（manager）として、顧客×SKU 契約ごとに納品期限ルール（1/3・1/2・ラベル期限のみ）を有効日付つきで確定・変更し、未合意の契約は business-review のまま残したい。なぜなら、納品期限は法律ではなく取引慣行（商慣習）であり、契約ごとに正しいルールを当て、未合意の行を推測で埋めないことが RFP の要件（BR-DELWIN-01、US-04）だからだ。

## 3. 背景・目的

- 納品期限（納品期限ルール）は顧客×SKU 契約（`customer_sku_agreements`、R-04）ごとに決まる：`ONE_THIRD`（1/3）・`ONE_HALF`（1/2）・`LABEL_DATE_ONLY`（ラベル期限のみ）。**法律ではない**。引当チェーンの ④ では違反ロットを提案から外すが、手動選択時は警告だけで止めない（BR-DELWIN-01）。「1/3 ルールを法律と呼ぶ・強制停止する」ことは RFP の重大エラー R-03。
- 期限の計算式：`deadline = mfg_date + floor((expiry_date − mfg_date) × r)`（r = 1/3 または 1/2）、`LABEL_DATE_ONLY` は `deadline = expiry_date`。基準日 > deadline で違反（`business-rules-and-state-machines.md` §1.3）。この計算と ④ の判定は E-05-S02 が使う。
- フィクスチャでは AGR-008（CUS-003 × CHI-004）と AGR-014（CUS-005 × CHI-002）が未合意（NULL）。NULL は business-review として扱い、**既定値を絶対に自動適用しない**（US-04）。一度確定したら NULL には戻さない（状態遷移 §2.5）。
- プロトタイプでは manager が `window_rule` を上書きし即時反映していた。DB の CHECK は NULL を通していた（D-21）。対象設計では変更申請（E-02-S03）で新しい契約バージョン（`effective_from` / `effective_to`）を作り、別の人が承認する。計画済みの出荷の引当が黙って変わらないようにする（ADR-004、DR-MST-01）。

## 4. 対象ユーザー

| ロールコード | 閲覧（S09） | 納品期限の変更 | 備考 |
| --- | --- | --- | --- |
| sales（営業・CS） | 可 | 変更申請を作成 | 契約の主担当（RFP US-04 は Sales/Admin） |
| manager（倉庫管理者） | 可 | 変更申請を作成・他人の申請を承認 | 権限マトリクス §3.3 |
| warehouse（倉庫作業者） | 可 | 不可（選択欄は無効） | |
| qa（品質管理） | 可 | 不可 | |
| admin（システム管理） | 可 | 不可（§10 で確認） | RFP 画面一覧は Sales/Admin を想定 |
| auditor（監査・閲覧のみ） | 可 | 不可 | |

## 5. スコープ

**スコープ内**
- 顧客・契約一覧画面 S09（`/customers`、WF-09）：見出しに「納品期限は取引慣行であり法律ではない」旨を明示。顧客カード（`code`・`name`、`code` 順）、配送履歴件数へのリンク（`customer_delivery_summary()`、件数は E-02-S05 以降に実データ）、最終納品日時、契約行（契約コード・SKU＋期限種別バッジ・納品条件 軒先渡し／車上渡し・納品期限・有効期間）。
- 納品期限の表示：「1/3」「1/2」「ラベル期限のみ」。NULL のときは先頭に「未確定（business-review）」を出し、オレンジの枠と背景で強調する。
- 変更操作：選択を変えると [ASSUMPTION] 確認ダイアログで適用開始日を入れ、E-02-S03 の変更申請（`entity = customer_sku_agreements`）として登録する。申請中の行には「承認待ち」を表示。承認されると新しい契約バージョンができ、前バージョンの `effective_to` が閉じる。
- 現在有効なバージョンと、予定（未来日付）のバージョンを両方表示する（ADR-004）。
- 参照関数 `agreement_at(customer_id, product_id, date)`：基準日に有効な契約を返す（E-05 の引当が出荷の基準日で使う）。前日・当日・翌日の境界テスト。
- DB 側の保護：確定済み（非 NULL）の後継バージョンを NULL にすることを禁じるトリガー（D-21 を作らない）。値域 CHECK（3 値＋未確定の NULL のみ）。
- `GET /api/customers`（A14）と `PATCH /api/agreements/[id]`（A16）の検証（V1〜V4）。PATCH は直接上書きせず変更申請を登録する。
- 監査：`customer_sku_agreements` の変更前後（`audit_config_change`）と `change.*`。

**スコープ外**
- 変更申請の承認画面・承認関数 → E-02-S03（本ストーリーは接続のみ）。
- 引当チェーン ④ の判定・期限計算の利用 → E-05-S02。
- 顧客別配送履歴 S10 → E-02-S05。
- 顧客マスタ画面（SCR-04）と契約の新規追加 → スケジュールに行なし（§10）。
- 納品先（店舗）単位の契約 → Q1 の回答後。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. sales が `/customers` を開く。`GET /api/customers` と `GET /api/me` が呼ばれ、5 顧客と 15 契約が表示される。AGR-008 と AGR-014 は「未確定（business-review）」でオレンジ表示。
2. Yuki と CUS-003 の合意が取れたので、sales が AGR-008 の納品期限を「1/2」に変え、適用開始日 2026-12-21 を入れて申請する。
3. BFF が V1〜V4 を検証し、変更申請を登録する。画面に「AGR-008：納品期限の変更申請を登録しました（承認後、適用開始日から有効）」（[ASSUMPTION] 文言は仮訳）が緑で表示され、行に「承認待ち」が付く。
4. sales 以外の manager が承認待ち一覧（E-02-S03）で承認する。AGR-008 に `ONE_HALF`・`effective_from` = 2026-12-21 のバージョンができ、NULL のバージョンは 2026-12-21 で閉じる。
5. 2026-12-21 以降に出荷する注文の引当は `agreement_at()` で `ONE_HALF` を読む。それより前に出荷する注文は business-review のまま。

**代替・例外フロー**
- V1 ロール不足（warehouse・qa・auditor など）：403「納品期限の変更申請を行う権限がありません。」。画面上も選択欄は無効。
- V2 値が 3 値以外、または NULL（「未確定」に戻す）：422「ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY のみ指定できます」。DB でもトリガーで拒否。
- V3 契約が存在しない：404「契約が見つかりません」。
- V4 ID が正の整数でない：404。
- 申請者本人が承認しようとする：`SELF_APPROVAL`（403）。同じ契約に承認待ちがある：409。適用開始日が過去：422（E-02-S03 の規則）。
- 送信失敗時：画面を再読み込みすると選択は元の値に戻り、赤枠でエラーを表示する。
- 一覧が空・読み込み失敗：共通ルールどおり（読み込み中…／再試行ボタン付き赤枠）。
- 未ログイン：401 → `/login?next=/customers`。DB 接続不可：503。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 顧客コード・名称 | `customers.code`・`customers.name` | 表示のみ | `code` 順 |
| 配送件数・最終納品日時 | `customer_delivery_summary().deliveries`・`last_delivered_at`（`delivery_history` 集計） | 表示のみ | S10 へのリンク |
| 契約コード | `customer_sku_agreements.code` | 表示のみ | AGR-001〜015 |
| SKU・名称・期限種別 | `products.sku`・`products.name`、`product_rule_at()` の `expiry_type` | 表示のみ | 消費期限は赤 |
| 納品条件 | `customer_sku_agreements.delivery_term` | 表示のみ | 軒先渡し／車上渡し |
| 納品期限 | `customer_sku_agreements.window_rule`（`agreement_at(customer_id, product_id, 今日)`） | 編集可（sales / manager、変更申請） | NULL ＝ 未確定（business-review） |
| 適用開始日・終了日 | `customer_sku_agreements.effective_from`・`effective_to` | 適用開始日は申請時に編集可 | 予定バージョンも表示 |
| 承認者 | `customer_sku_agreements.approved_by` → `app_users.full_name` | 表示のみ | |
| 承認待ち | `change_requests.status = 'pending'`（`entity = customer_sku_agreements`） | 表示のみ | E-02-S03 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR・要件：BR-DELWIN-01、US-04（未合意行を推測しない、ルール追加でデータ構造を変えない）、DR-MST-01、NFR-SEC-02（申請者 ≠ 承認者）、NFR-AUD-01、NFR-LOC-01（日付 `yyyy/mm/dd`、JST）、NFR-ACC-01（オレンジ表示に文字を併記）、NFR-PERF-01。
- ADR-004：契約は複数バージョン行（一意 (`customer_id`, `product_id`, `effective_from`)、期間重複を禁じる `EXCLUDE`）。参照は必ず `agreement_at()` 経由。
- ADR-001：`authenticated` に契約テーブルへの書き込み権限を与えない（プロトタイプの列単位 GRANT は作らない＝D-06）。
- 業務ルールの二重実装：納品期限の値域・NULL 禁止は TS（BFF 検証）と SQL（CHECK・トリガー）の両方に置く。
- ADR-006：ローカル実行のみ。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] `/customers` で 15 契約が表示され、AGR-008 と AGR-014 は「未確定（business-review）」がオレンジ（文字付き）で表示される。どの経路でも NULL に既定値が補われない（E2E＋pgTAP、D-002）。
- [ ] Given sales、When AGR-008 を「1/2」・適用開始日付きで申請、Then 値は即時には変わらず「承認待ち」になり、別の manager の承認後に `ONE_HALF` のバージョンが作られる（E2E、E-02-S03 と結合、D-001・D-011）。
- [ ] `agreement_at` が適用開始日の前日は旧バージョン（NULL を含む）、当日・翌日は新バージョンを返す（pgTAP＋単体、D-002）。
- [ ] 確定済みの契約を NULL に戻す申請は BFF で 422、DB 直接でもトリガーで失敗する（API テスト＋pgTAP、D-011）。
- [ ] 値域外の `window_rule`、同一顧客×SKU の期間重複は CHECK / `EXCLUDE` で失敗する。`authenticated` の直接 UPDATE は `42501`（pgTAP、D-011）。
- [ ] warehouse・qa・auditor では納品期限の選択欄が無効で、API を直接呼ぶと 403。存在しない契約は 404、ID 形式不正は 404（API テスト＋E2E、D-011）。
- [ ] 画面見出しに「納品期限は取引慣行であり法律ではない」旨が表示され、文言にベトナム語が残っていない（E2E、D-002・D-014）。
- [ ] 契約変更の前後が `audit_logs` に記録される（`customer_sku_agreements.update`、`change.approve`）（pgTAP、D-011）。
- [ ] `scr-03-customer-agreements-and-history.md` の差分表・`03-implementation-status.md`・`project-changelog.md` を更新し、`npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` が成功する（D-015・D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | 未決 Q5：AGR-008 / AGR-014 の納品期限を誰がいつ確定するか。設計上の暫定案は「manager が SCR-03 で、対象システムではメーカー・チェッカー経由」。回答までは NULL（business-review）のまま | `01-system-overview-and-scope.md` §1.7 Q5。WBS の依存列にも Q5 | お客様 | M-02（2026-10-30） |
| 2 | 未決：納品期限の変更申請を誰が承認するか（manager のみか）。sales と manager が申請でき、承認者は申請者以外の manager とする案 | 権限マトリクス §3.3 は申請側のみ記載。ADR-004 は承認者 ≠ 申請者のみ規定 | お客様 | M-02（2026-10-30） |
| 3 | [ASSUMPTION] 選択の変更は即時送信ではなく、確認ダイアログで適用開始日を入れてから申請する | プロトタイプは選択変更で即時送信。対象設計は適用開始日つきのバージョンを要求 | テックリード / PM | S2 開始（2026-12-14） |
| 4 | 未決：admin に納品期限の変更申請権を与えるか（RFP 画面一覧は SCR-03 の利用者を Sales/Admin とする） | RFP 画面一覧と設計書の権限マトリクスが一致しない | お客様 / PM | M-03（2026-11-27） |
| 5 | 未決：契約の新規追加（新しい顧客×SKU）と顧客マスタ画面 SCR-04 に対応するストーリーがスケジュールにない | `scr-03` の差分表に「顧客マスタ画面＋契約追加」とあるが WBS に行なし | PM | M-03（2026-11-27） |
| 6 | [ASSUMPTION] 画面文言・エラーメッセージは設計書（ベトナム語）の和訳を仮文言として使い、最終文言は E-13-S01 で確定する | NFR-LOC-01。確定文言なし | PM / お客様 | M-03（2026-11-27） |
| 7 | 規模：画面 1 枚＋参照関数＋保護トリガー。変更申請の仕組みは E-02-S03 にあるため 1 スプリント（S2）に収まる（INVEST 適合）。ただし Q5 の回答が S2 開始までにない場合も、NULL を保つ前提で実装は進められる | — | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-02-S04 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-002、D-011、D-014、D-015、D-019）
- 関連機能ID：SCR-03、FE-02、FE-17（`function-list.md` は未作成のため暫定キー）
- 関連 NFR・要件：BR-DELWIN-01、US-04、DR-MST-01、NFR-SEC-02、NFR-AUD-01、NFR-LOC-01、NFR-ACC-01、NFR-PERF-01
- 詳細設計：[scr-03-customer-agreements-and-history.md](../../../docs/03-detail-design/scr-03-customer-agreements-and-history.md)（S09）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-DELWIN-01、§1.3 計算式、§2.5 状態遷移）、[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A14、A16）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- ワイヤーフレーム：[wireframe-04-master-trace-audit.md](../../../docs/02-wireframes/wireframe-04-master-trace-audit.md)（WF-09）
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.7 Q5）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3）
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2 `customer_sku_agreements`、§5 `agreement_at`）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05、D-06、D-21）
- ADR：[adr-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
