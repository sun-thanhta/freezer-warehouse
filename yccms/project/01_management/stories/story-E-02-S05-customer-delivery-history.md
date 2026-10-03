# E-02-S05: 顧客別配送履歴（DR-HIST-01）

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-02-S05 |
| ストーリー名 | Lịch sử giao theo khách (DR-HIST-01)（和訳：顧客別配送履歴（DR-HIST-01）） |
| 関連Epic | E-02（マスタ・顧客×SKU契約 ＝ F01） |
| 関連機能ID | SCR-03 (S10) |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

営業・CS（sales）・倉庫作業者（warehouse）として、顧客ごとに「いつ・どの SKU の・どのロットを・どの期限で・何個納品したか」を改ざんできない履歴として確認し、SKU ごとの日付逆転の基準（納品済みの最大期限）がどれかを見分けたい。なぜなら、日付逆転禁止（BR-DATE-01）は顧客×SKU の納品履歴だけを基準に判定するため、顧客からの問い合わせや例外申請の判断で、その根拠を画面で示せなければならないからだ。

## 3. 背景・目的

- 受け入れ済みの納品明細（顧客＋SKU＋期限＋完了）は不変で、日付逆転判定の基礎である（DR-HIST-01）。日付逆転は「今日」と比べるのではなく、**同じ顧客×SKU** に納品した最大期限と比べる。他の顧客の履歴は借りない（例：CUS-004 / CUS-005 は CUS-003 の CHI-002 履歴に影響されない）。
- `delivery_history` は出荷確定（E-05-S03）が書き込む。本ストーリーはそれを読む閲覧画面 S10（`/customers/[id]`）と API A15 を作るため、E-05-S03 に依存し、S4 に置かれている。
- 期限（`expiry_date`）は **納品時点の値を別に保存** したもので、ロットから読み直さない。返品は修正ではなく、返品モジュール（SCR-17）が補正行を作る。
- プロトタイプとの差分で回避すべき点：期間フィルタの開始日を UTC の 00:00（＝JST 09:00）で比べていたため、JST 0〜9 時の納品が漏れた。SKU は完全一致のみ、ページングなし（`scr-03-customer-agreements-and-history.md` §5・§8）。

## 4. 対象ユーザー

| ロールコード | 閲覧 | 使い方 |
| --- | --- | --- |
| sales（営業・CS） | 可 | 顧客からの問い合わせ対応、契約見直しの根拠 |
| warehouse（倉庫作業者） | 可 | 出荷前に日付逆転の基準を確認、例外申請の根拠 |
| manager（倉庫管理者） | 可 | 例外承認の判断材料 |
| qa（品質管理） | 可 | 品質問題時の納品先確認 |
| admin（システム管理） | 可 | 調査 |
| auditor（監査・閲覧のみ） | 可 | 監査 |

全ロールとも閲覧のみ。履歴を修正・削除する画面・API は存在しない。

## 5. スコープ

**スコープ内**
- 顧客別配送履歴画面 S10（WF-10）：見出し「配送履歴 — {顧客名}」＋顧客コードのバッジ、「← 顧客一覧」リンク（`/customers`）。
- 絞り込み：SKU（大文字化）、開始日（JST 00:00 以降＝`from 00:00 +09:00`）、終了日（JST 23:59:59 まで）。条件を変えると即時に再取得する。
- 一覧（新しい順）：納品日時（JST）、注文（`outbound_orders.code` → `/outbound/{id}`、移行データで NULL のときは「—」）、SKU・名称、ロット番号、期限（納品時点）、数量。
- 日付逆転の基準バッジ：SKU ごとに期限が最大の行に紫の「日付逆転の基準」を表示。期間で絞り込んでいるときは非表示（期間外に最大期限があり得るため）。
- 対象システム仕様：[ASSUMPTION] SKU の部分一致検索、ページング（1 ページ 50 件）。
- `GET /api/customers/[id]?sku=&from=&to=`（A15）。S09 の顧客カードの「配送履歴（n）→」リンクと件数（`customer_delivery_summary()`）が実データで動くことを確認する。
- 不変性の確認：`delivery_history` に UPDATE / DELETE の経路がない（権限剥奪＋トリガー `forbid_update_delete`）ことを pgTAP で検証する（テーブルと書き込みは E-05-S03 が作る）。

**スコープ外**
- `delivery_history` の作成・書き込み、日付逆転判定そのもの → E-05-S03、E-05-S02、E-06。
- [ASSUMPTION] CSV エクスポート → エクスポート監査（`export.*`）と合わせて E-08-S03 で扱う。
- 納品先（店舗）列・店舗単位の絞り込み → Q1 の回答後（`site_id`）。
- 返品の補正行 → 返品モジュール（E-09-S03、SCR-17）。
- 3 年分の正方向・逆方向トレース → E-07-S01。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. sales が `/customers` で CUS-003 のカードの「配送履歴（n）→」を押す。
2. `/customers/{id}` が開き、`GET /api/customers/{id}` で CUS-003 の全履歴が新しい順に表示される。CHI-002 の行のうち期限が最大の行に「日付逆転の基準」バッジが付く。
3. sales が SKU に「chi-002」と入れると「CHI-002」に変わり、`?sku=CHI-002` で再取得される。
4. 開始日・終了日を入れると、JST の日付境界で絞り込まれ、基準バッジは非表示になる。
5. 注文コードを押すと `/outbound/{id}`（出荷画面）に移動する。

**代替・例外フロー**
- 該当なし：「該当する配送履歴はありません。」を灰色で表示。
- 顧客 ID が存在しない・形式不正：404「顧客が見つかりません」。
- 日付の形式不正・存在しない日付（例：`2026-13-45`）：400「日付フィルタが不正です」（500 にしない）。
- 移行データ（注文なし）：注文列は「—」、リンクなし。[ASSUMPTION] 移行の実データが来る前は、シードの注文 NULL 行で検証する。
- 読み込み失敗：再試行ボタン付きの赤枠（共通ルール §2。プロトタイプにはなかったボタンを追加）。
- 未ログイン：401 → `/login?next=/customers/{id}`（クエリ含む）。ユーザー情報なし：403。DB 接続不可：503。
- PostgREST で `delivery_history` を直接 UPDATE / DELETE：`42501`。owner でもトリガーで拒否。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 顧客コード・名称 | `customers.code`・`customers.name` | 表示のみ | 見出し |
| 納品日時 | `delivery_history.delivered_at` | 表示のみ | JST `yyyy/mm/dd HH:mm`、新しい順 |
| 注文 | `delivery_history.order_id` → `outbound_orders.code` | 表示のみ（リンク） | NULL ＝ 移行データ |
| SKU・名称 | `delivery_history.product_id` → `products.sku`・`products.name` | 表示のみ | |
| ロット | `delivery_history.lot_id` → `lots.lot_no` | 表示のみ | |
| 期限（納品時点） | `delivery_history.expiry_date` | 表示のみ | ロットから読み直さない |
| 数量 | `delivery_history.qty` | 表示のみ | 右寄せ・単位付き |
| 日付逆転の基準 | `delivery_history` の SKU ごとの最大 `expiry_date`（`last_deliveries()` と同じ定義） | 表示のみ | 期間絞り込み中は非表示 |
| 納品先 | `delivery_history.site_id` → `customer_sites` | 表示なし | Q1 待ち |
| 絞り込み：SKU・開始日・終了日・ページ | 画面入力 → A15 のクエリ | 編集可（入力） | 日付は JST |
| 配送件数・最終納品日時（S09） | `customer_delivery_summary()` | 表示のみ | |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR・要件：DR-HIST-01（不変）、BR-DATE-01（顧客×SKU 単位）、NFR-PERF-01（閲覧 p95 ≤ 2 秒 @ 80 ユーザー）、NFR-PERF-02（3 年分 300,000 明細を想定したインデックス `(customer_id, delivered_at)`・`(customer_id, product_id, expiry_date desc)`）、NFR-LOC-01（JST の日付境界、内部は `timestamptz`）、NFR-ACC-01（バッジに文字）、DR-RET-01（3 年保管）。
- 設計原則 P4：不変テーブルは権限とトリガーの両方で UPDATE / DELETE を防ぐ（D-17 を作らない）。P8：日付境界は `+09:00` で計算する。
- ADR-002：ブラウザから直接 DB を読まず、A15 を経由する。ADR-003：基準（最大期限）の定義は `last_deliveries()` と一致させる。
- ADR-006：ローカル実行のみ。300,000 行での性能測定はクラウド環境（P5）で行う。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] Given CUS-003 に CHI-002 の納品が複数ある、When S10 を開く、Then 新しい順に表示され、期限が最大の 1 行だけに「日付逆転の基準」バッジが付く（E2E、D-003）。
- [ ] CUS-005 の S10 に CUS-003 の CHI-002 履歴が表示されない（顧客をまたいで履歴を借りない）（E2E＋pgTAP、D-003）。
- [ ] Given 開始日 = D、When JST で D 日 00:30 に納品された行がある、Then その行が結果に含まれ、終了日 = D なら D 日 23:59 の行も含まれる（API テスト、D-014）。
- [ ] 期間で絞り込むと基準バッジが非表示になり、SKU に小文字を入れると大文字に変換されて絞り込まれる（E2E、D-001）。
- [ ] 存在しない顧客は 404、`from=2026-13-45` は 400 で、500 にならない（API テスト、D-001）。
- [ ] 注文 NULL の行は注文列が「—」でリンクがない（E2E、D-001）。
- [ ] `delivery_history` への UPDATE / DELETE は `authenticated` で `42501`、owner でもトリガーで失敗し、履歴を変更する API が存在しない（pgTAP＋コードレビュー、D-003・D-011）。
- [ ] 一覧取得が `(customer_id, delivered_at)` のインデックスを使う（`EXPLAIN` の確認記録）。ページングで 1 回の応答件数が上限を超えない（pgTAP または API テスト、D-010）。
- [ ] 画面文言にベトナム語が残っておらず（[ASSUMPTION] 文言は設計書からの仮訳）、`scr-03-customer-agreements-and-history.md` の差分表・`03-implementation-status.md`・`project-changelog.md` を更新、`npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` が成功する（D-014・D-015・D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] SKU は部分一致、ページングは 1 ページ 50 件とする | 設計書の対象仕様は「部分一致・ページング・CSV」とだけ記載し、件数は未定義 | テックリード | S4 開始（2027-01-18） |
| 2 | [ASSUMPTION] CSV エクスポートは本ストーリーに含めず、エクスポート監査（`export.*`）と合わせて E-08-S03 で扱う | NFR-AUD-01 はエクスポートの監査を要求し、その仕組みは E-08-S03（監査エクスポート）にある | PM / お客様 | M-03（2026-11-27） |
| 3 | 未決 Q1：日付逆転を顧客単位で判定するか、店舗（納品先）単位か。店舗単位なら S10 に納品先列と絞り込みを追加する | `01-system-overview-and-scope.md` §1.7 Q1 | お客様 | M-02（2026-10-30） |
| 4 | 未決 Q2：「最後に受け入れた配送」の基準は「直近の納品」か「納品済みの最大期限」か。設計の暫定は最大期限で、基準バッジもそれに従う | §1.7 Q2、ADR-003 | お客様 | M-02（2026-10-30） |
| 5 | [ASSUMPTION] 移行データ（注文なし）の表示は、P-MIG の実データが来る前にシードの注文 NULL 行で検証する | 移行リハーサル #1 は M-05（2027-03-19）で S4 より後 | テックリード | S4 開始（2027-01-18） |
| 6 | [ASSUMPTION] 画面文言・エラーメッセージは設計書（ベトナム語）の和訳を仮文言として使い、最終文言は E-13-S01 で確定する | NFR-LOC-01。確定文言なし | PM / お客様 | M-03（2026-11-27） |
| 7 | 規模：閲覧画面 1 枚＋読み取り API 1 本で、1 スプリント（S4）に十分収まる（INVEST 適合）。E-05-S03 が S3 で完了していることが前提 | WBS の依存列 E-05-S03 | PM | S4 開始（2027-01-18） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-02-S05 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-003、D-010、D-011、D-014、D-015、D-019）
- 関連機能ID：SCR-03 (S10)（`function-list.md` は未作成のため暫定キー）
- 関連 NFR・要件：DR-HIST-01、BR-DATE-01、NFR-PERF-01、NFR-PERF-02、NFR-LOC-01、NFR-ACC-01、DR-RET-01
- 詳細設計：[scr-03-customer-agreements-and-history.md](../../../docs/03-detail-design/scr-03-customer-agreements-and-history.md)（§5 S10、§8）、[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A14、A15）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-DATE-01、§1.1 基準日）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- ワイヤーフレーム：[wireframe-04-master-trace-audit.md](../../../docs/02-wireframes/wireframe-04-master-trace-audit.md)（WF-10）
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.7 Q1・Q2）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（S10）
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.4 `delivery_history`、§1 原則 P4・P8）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-17、D-18）
- ADR：[adr-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[adr-003](../../../docs/04-adr/adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
