# E-02-S02: SKU マスタ（期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン）

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-02-S02 |
| ストーリー名 | Master SKU: loại hạn (賞味/消費), ngưỡng cận hạn, lane truy xuất（和訳：SKU マスタ：期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン） |
| 関連Epic | E-02（マスタ・顧客×SKU契約 ＝ F01） |
| 関連機能ID | SCR-02, FE-01, FE-13 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）・品質管理（qa）として、SKU ごとに期限種別（賞味期限＝警告／消費期限＝出荷停止）と期限接近の警告日数を、有効日付つきのバージョンとして管理したい。なぜなら、賞味と消費を取り違えることは RFP が名指しする重大エラー（R-01）であり、どの判断がどの時点の設定に基づいたかを後から説明できなければならないからだ。

## 3. 背景・目的

- 期限種別は SKU ごとに宣言する（BR-EXP-01）。`best_before`（賞味期限）は警告、`use_by`（消費期限）は期限当日以降の入荷・引当・出荷を止めるハードストップ（BR-EXP-02、引当チェーン ①）。
- 期限種別は入荷の `EXPIRED_ON_ARRIVAL`、引当 ①、ダッシュボード「消費期限到来」に即座に効く。期限接近日数は在庫の期限接近表示・KPI に効く（`scr-32-02-settings-thresholds-sku.md` §5）。
- トレーサビリティレーン（`trace_lane`）は法定レーン（コメ＝産地・取引、牛肉＝個体識別番号 10 桁）と `internal_lot` を分ける。構造マスタであり、この画面では変更できない。
- プロトタイプは `products.expiry_type` を上書きしており、承認なしで即時反映、過去時点の設定も分からなかった（差分 D-05、D-06、D-21）。対象設計では `product_versions`（`expiry_type`、`near_expiry_days`、`effective_from`、`effective_to`、`approved_by`）に分け、参照は関数 `product_rule_at(product_id, date)` 経由に統一する（ADR-004）。

## 4. 対象ユーザー

| ロールコード | 閲覧 | 変更 | 備考 |
| --- | --- | --- | --- |
| manager（倉庫管理者） | 可 | 変更申請を作成 | 対象システムでは承認後に反映 |
| qa（品質管理） | 可 | 変更申請を作成 | 権限マトリクス §3.3 |
| admin（システム管理） | 可 | 変更申請を作成 | 同上 |
| warehouse（倉庫作業者） | 可 | 不可 | 入力欄は `disabled`、保存ボタンなし、権限の注意表示 |
| sales（営業・CS） | 可 | 不可 | |
| auditor（監査・閲覧のみ） | 可 | 不可 | |

## 5. スコープ

**スコープ内**
- テーブル `product_versions`（CHECK：`expiry_type` ∈ {best_before, use_by}、`near_expiry_days` 0〜365 の整数、同一 SKU の有効期間重複を禁じる `EXCLUDE`、`approved_by` → `app_users`）。D-21 を作らないよう、値の検証を DB の CHECK でも持つ。
- 参照関数 `product_rule_at(product_id, date)`：基準日に有効なバージョンを返す。TS と SQL が同じ定義を使い、前日・当日・翌日の境界テストを持つ。
- フィクスチャの初版バージョン投入（`seed.sql`）：AMB-001〜004 = 賞味、CHI-001 = 消費、CHI-002 = 賞味、CHI-003 = 消費、CHI-004 = 消費、FRO-001〜004 = 賞味。[ASSUMPTION] 期限接近日数は AMB・FRO = 30、CHI-001 = 3、CHI-002 = 5、CHI-003・CHI-004 = 2、`effective_from` = 2026-04-01。
- 設定画面 `/settings` の SKU 表（SCR-02 部分、WF-11 の [8]〜[11]）：SKU・名称、温度帯（名称＋現行しきい値）、トレーサビリティのバッジ（「米（産地・取引）」「牛（個体識別番号 10 桁）」は紫、`internal_lot` は灰色の文字）、期限種別（選択）、期限接近日数（数値）、保存（変更時のみ有効）。現在有効な値と、予定（未来日付）のバージョンを両方表示する。
- `GET /api/settings`（A17）の SKU 部分と、`PATCH /api/settings/products/[id]`（A19）の検証（V1〜V7）。[ASSUMPTION] 保存は値を直接上書きせず、E-02-S03 の変更申請（`entity = product_versions`）として登録する。
- 消費期限は常に赤で表示（共通ルール §3）。

**スコープ外**
- 変更申請の承認・却下・承認待ち一覧・バージョン生成の仕組み → E-02-S03。
- 温度帯しきい値（SCR-32 部分）→ E-04-S01。
- [ASSUMPTION] 承認前の影響表示（在庫ロット数・未出荷の注文明細数）→ ロット・出荷テーブルができる E-03 / E-05 以降に追加。
- SKU の新規登録・JAN・規格・単位の編集（SCR-02 の完全版）→ ER に列がなく、スケジュールにも行がない（§10）。
- 温度帯・`trace_lane`・SKU コードの変更（構造マスタ。在庫・ロケーションに影響するためこの画面では不可）。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. qa が `/settings` を開く。`GET /api/settings` と `GET /api/me` が呼ばれ、12 SKU が `sku` 順に表示される。
2. qa が CHI-002 の期限種別を「賞味期限」から「消費期限」に変え、適用開始日を入れる。行は「変更あり」状態になり保存ボタンが有効になる。
3. 保存を押すと `PATCH /api/settings/products/{id} {expiry_type, near_expiry_days}` が呼ばれ、BFF が検証したうえで変更申請を登録する。
4. 画面に「CHI-002 の変更申請を登録しました（承認後、適用開始日から有効）」（[ASSUMPTION] 文言は仮訳）が緑で表示され、行に「承認待ち」が付く。
5. 別の manager が E-02-S03 の承認画面で承認すると、新しいバージョンができ、前のバージョンの `effective_to` が閉じられる。監査に `products` 系の変更と `change.approve` が記録される。
6. 適用開始日以降、入荷・引当・ダッシュボードは `product_rule_at` で新しい種別を読む。過去の入荷・出荷の判定根拠は当時のバージョンで説明できる。

**代替・例外フロー**
- V1 ロール不足（warehouse・sales・auditor）：403「SKU 設定の変更申請を行う権限がありません。」。画面上も入力欄は `disabled`。
- V5 期限種別が値域外：422「期限種別が不正です」（BFF と DB の CHECK）。
- V6 期限接近日数が 0〜365 の整数でない：422「期限接近しきい値は 0〜365 の日数で指定してください」。
- V7 SKU が存在しない・ID 形式不正：404。
- JSON 不正：400「リクエストの JSON が不正です。」。
- 同じ SKU に承認待ちの申請がある：409（E-02-S03 の制約）。
- 送信失敗時：入力中の値を保持し、赤枠でエラーを表示する（共通ルール §5）。
- 未ログイン：401 → `/login?next=/settings`。DB 接続不可：503。
- 一覧の読み込み中は「読み込み中…」、エラー時は再試行ボタン付きの赤枠。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| SKU・名称 | `products.sku`・`products.name` | 表示のみ | `sku` 順 |
| 単位 | `products.unit` | 表示のみ | |
| 温度帯・現行しきい値 | `products.zone_id` → `temperature_zones.name`、しきい値は `zone_range_at()`（E-04-S01） | 表示のみ | 構造マスタ |
| トレーサビリティ | `products.trace_lane` | 表示のみ | rice / beef は紫バッジ |
| 期限種別 | `product_versions.expiry_type`（`product_rule_at(product_id, 今日)`） | 編集可（manager / qa / admin、変更申請） | 消費期限は赤 |
| 期限接近日数 | `product_versions.near_expiry_days` | 編集可（同上） | 0〜365 の整数 |
| 適用開始日 | `product_versions.effective_from`（申請時は `change_requests.effective_from`） | 編集可（申請時） | JST の日付 |
| 適用終了日 | `product_versions.effective_to` | 表示のみ | NULL ＝ 現在有効 |
| 承認者 | `product_versions.approved_by` → `app_users.full_name` | 表示のみ | |
| 承認待ち表示 | `change_requests.status = 'pending'` | 表示のみ | E-02-S03 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR・要件：BR-EXP-01 / BR-EXP-02、DR-MST-01（有効日付管理＋メーカー・チェッカー）、NFR-SEC-02、NFR-AUD-01（変更前後を監査）、NFR-LOC-01（日付は `yyyy/mm/dd`、「今日」は JST）、NFR-ACC-01（色だけに頼らずバッジに文字を入れる）、NFR-PERF-01。
- ADR-004：高リスク設定はバージョン表で持ち、参照は必ず `*_at(date)` 関数経由。参照の書き忘れを防ぐため境界日テストを必須にする。
- ADR-001：`authenticated` に `product_versions` への直接書き込み権限を与えない（プロトタイプの列単位 GRANT UPDATE は作らない＝D-06、D-21）。
- 業務ルールの二重実装：期限種別の判定は TS（`src/lib/rules/`）と SQL の両方に置き、両方をテストする（`CLAUDE.md`）。
- ADR-006：ローカル実行のみ。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] `npm run db:reset` 後、12 SKU すべてに初版バージョンがあり、CHI-001・CHI-003・CHI-004 だけが `use_by`、他の 9 件は `best_before` である（pgTAP、D-002）。
- [ ] `product_rule_at` が `effective_from` の前日は旧バージョン、当日と翌日は新バージョンを返す（pgTAP＋単体、D-002）。
- [ ] `product_versions` に `expiry_type = 'x'` または `near_expiry_days = 366` を入れようとすると CHECK で失敗し、同一 SKU の有効期間重複は `EXCLUDE` で失敗する（pgTAP、D-011）。
- [ ] `authenticated` が `product_versions` / `products` を直接 UPDATE すると `42501` で失敗する（pgTAP、D-011）。
- [ ] Given warehouse、When `/settings` を開く、Then 期限種別・期限接近日数は `disabled` で保存ボタンがなく、API を直接呼ぶと 403 になる（E2E、D-011）。
- [ ] Given qa、When CHI-002 の期限種別を変えて保存、Then 値は即時には変わらず「承認待ち」になり、別の manager が承認した後に新バージョンが有効になる（E2E、E-02-S03 と結合、D-001・D-011）。
- [ ] V5・V6・V7 の入力でそれぞれ 422・422・404 が返り、画面は入力値を保持する（API テスト＋E2E、D-001）。
- [ ] コメ・牛肉のバッジが紫で文字付き、消費期限が赤で表示され、画面文言にベトナム語が残っていない（E2E、D-014）。
- [ ] `05-database/03-implementation-status.md`・`scr-32-02-settings-thresholds-sku.md` の差分表を更新し、`npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` が成功する（D-015・D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] SKU 設定の保存は E-02-S03 の変更申請として登録する。E-02-S03 が同じスプリントで完了するまでは保存ボタンを出さず、閲覧と DB 側の検証だけを先に仕上げる。スケジュール上は E-02-S02 → E-02-S03 の依存が書かれていない | ADR-004・DR-MST-01 は変更申請経由を要求。WBS の依存列は E-02-S01 のみ | テックリード / PM | S1 開始（2026-11-30） |
| 2 | [ASSUMPTION] 期限接近日数のフィクスチャ値（AMB・FRO = 30、CHI-001 = 3、CHI-002 = 5、CHI-003・CHI-004 = 2）と初版の `effective_from` = 2026-04-01 はプロトタイプの値を流用する | RFP フィクスチャに期限接近日数の公式値がない。ADR-004 は初版を契約日 2026-04-01 または本番開始日と記載 | お客様 | M-03（2026-11-27） |
| 3 | [ASSUMPTION] 承認前の影響表示（在庫ロット数・未出荷明細数）は、ロット・出荷テーブルができる E-03 / E-05 以降に追加する | ADR-004 決定 4 は影響表示を求めるが、S1 時点では対象テーブルが存在しない | テックリード / PM | S2 開始（2026-12-14） |
| 4 | 未決：SKU 期限種別の変更を承認できるロール（manager のみか、qa も可か）。賞味 ↔ 消費はハードストップの切り替えで高リスク | ADR-004・権限マトリクスは「申請者 ≠ 承認者」のみ規定し、承認ロールは未定義 | お客様 | M-02（2026-10-30） |
| 5 | 未決：SCR-02 の完全版（SKU 新規登録、JAN、規格、単位編集）を本プロジェクトで作るか。ER に JAN 列がなく、スケジュールにも行がない | `scr-32-02` のプロトタイプ差分表に「SCR-02 完全版」とあるのみ | お客様 / PM | M-03（2026-11-27） |
| 6 | [ASSUMPTION] 画面文言・エラーメッセージは設計書（ベトナム語）の和訳を仮文言として使い、最終文言は E-13-S01 で確定する | NFR-LOC-01。確定文言なし | PM / お客様 | M-03（2026-11-27） |
| 7 | 規模：テーブル 1 本＋参照関数＋画面の SKU 部分。変更申請の仕組みは E-02-S03 が持つため 1 スプリントに収まる（INVEST 適合。ただし #1 の通り E-02-S03 と結合テストが必要） | — | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-02-S02 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-002、D-011、D-014、D-015、D-019）
- 関連機能ID：SCR-02、FE-01、FE-13（`function-list.md` は未作成のため暫定キー）
- 関連 NFR・要件：BR-EXP-01、BR-EXP-02、DR-MST-01、NFR-SEC-02、NFR-AUD-01、NFR-LOC-01、NFR-ACC-01、NFR-PERF-01
- 詳細設計：[scr-32-02-settings-thresholds-sku.md](../../../docs/03-detail-design/scr-32-02-settings-thresholds-sku.md)、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-EXP-01/02）、[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A17、A19）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- ワイヤーフレーム：[wireframe-04-master-trace-audit.md](../../../docs/02-wireframes/wireframe-04-master-trace-audit.md)（WF-11）
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2 `products`・`product_versions`、§5）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05、D-06、D-21）
- ADR：[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
