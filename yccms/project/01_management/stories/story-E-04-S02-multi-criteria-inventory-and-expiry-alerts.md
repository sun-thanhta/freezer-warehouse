# E-04-S02: 多条件の在庫照会と期限間近・期限切れの表示

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-04-S02 |
| ストーリー名 | Tồn kho đa tiêu chí + cận hạn / quá hạn（和訳：多条件の在庫照会＋期限間近／期限切れ） |
| 関連Epic | E-04（在庫・隔離・温度帯しきい値／F03） |
| 関連機能ID | SCR-08, FE-12（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P1 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、在庫を SKU・ロット・ロケーション・温度帯で絞り込み、期限切れや期限間近のロットを SKU ごとのしきい日数で一目で把握したい。なぜなら、期限間近品を早めに出荷・処分の判断に回さないと、廃棄ロスが増え、消費期限到来品を出荷してしまう危険も高まるからだ。

## 3. 背景・目的

- SCR-08「在庫照会」は、SKU・ロット・ロケーション・温度帯ごとの在庫と、SKU 別のしきい日数による期限間近の警告を提供する（FE-12、BR-EXP-01）。同じ画面の「隔離」タブで、隔離ロットの release／scrap（E-04-S04）を行う。
- プロトタイプは全ロットを BFF に取得してから絞り込み・残日数計算をしており、API の 1,000 行上限に当たる。目標設計では SQL 側で絞り込み・ページングし、SKU・ロット番号・仕入先・ロケーションでの検索を加える（SCR-08-10 §7）。
- 期限間近の日数は SKU ごとに版管理される（`product_versions.near_expiry_days`、ADR-004）。「今日」は JST で数える。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse`（倉庫作業者） | 在庫・期限間近の確認（主利用者） | — |
| `manager`（倉庫管理者） | 同上 | 隔離タブで release／scrap 可（E-04-S04） |
| `qa`（品質管理） | 同上、隔離ロットの確認 | 隔離タブで release／scrap 可（E-04-S04） |
| `sales`（営業・CS） | 在庫・期限の確認（出荷可否の問い合わせ対応） | 閲覧のみ |
| `admin` / `auditor` | 閲覧 | 閲覧のみ |

権限マトリクス S05「在庫・期限間近・隔離の閲覧」は6ロールすべて R。

## 5. スコープ

**スコープ内**

- `/inventory?view=all|near|quarantine&zone=0|1|2|3`。タブを切り替えても `zone` を保持する（`router.replace`）。不明な `view` は `all` とする。
- 温度帯フィルタ：すべて／常温／冷蔵／冷凍。**SKU の温度帯**（`products.zone_id`）で絞り込む（ロケーションの温度帯ではない）。
- 検索（目標設計で追加）：SKU、ロット番号、仕入先、ロケーション（[ASSUMPTION] 部分一致、1ページ 50 件のページング）。
- 列：SKU（コード・名称）、ロット番号／法定 ID（紫）とレーン名、温度帯／ロケーション（隔離中は「隔離」バッジ、ロケーション温度帯 ≠ SKU 温度帯なら赤の「温度帯違い」バッジ）、期限種別バッジ（消費＝赤、賞味＝灰）、期限、残日数バッジ、在庫数／入荷数＋単位、仕入先。
- 残日数 `daysLeft = 期限 − 今日（JST）`：0未満は「期限切れ n 日」赤、`near_expiry_days` 以下は「n 日（しきい m）」橙、それ以外は「n 日」。
- 行の背景色：隔離は紫、期限切れは赤、期限間近は橙。
- 対象は `qty_on_hand > 0` のロットのみ、期限の昇順。`near` は期限間近と期限切れ、`quarantine` は隔離中のロット（[ASSUMPTION] `review` ロットも区別表示で含める）。
- 0件時：「該当するロットはありません。」。
- `GET /api/inventory`（A07）の目標版：絞り込み・残日数計算・ページングを SQL 側で行う。

**スコープ外**

- 隔離ロットの release／scrap 操作 → E-04-S04
- 在庫移動の履歴表示 → [ASSUMPTION] 扱わない（台帳は E-04-S03、画面は未定義）
- ダッシュボードの期限間近・消費期限到来の件数 → E-08-S01
- 棚卸・ロケーション移動 → E-04-S05（仮）
- CSV 出力・帳票 → E-08-S02（仮）

## 6. 主要業務フロー

**正常系**

1. 利用者がメニューの「在庫照会」から `/inventory` を開く。`GET /api/inventory?view=all&zone=0` で1ページ目を取得し、期限の早い順に表示する。
2. 「期限間近・期限切れ」タブに切り替え、温度帯を「冷蔵」に絞る。期限切れは赤、期限間近は橙で表示される。
3. SKU やロット番号で検索し、該当ロットのロケーション・在庫数・仕入先を確認する。
4. 必要に応じて「隔離」タブで隔離中のロットを確認する（操作は E-04-S04）。

**代替フロー**

- **A1** ダッシュボードの期限間近カードから `view=near` で直接開く（E-08-S01 側のリンク）。

**例外フロー**

- **E1** 不明な `view` → `all` として表示する。不明な `zone` → [ASSUMPTION] すべての温度帯として表示する。
- **E2** 検索条件の型が不正（例：ページ番号が数値でない）→ 400（共通ルール）。
- **E3** 未ログイン・セッション切れ → 401 → `/login?next=<現在のページ>`。
- **E4** `app_users` 未登録 → 403。
- **E5** DB に到達できない → 503「システムメンテナンス中」の案内。
- **E6** その他の API エラー → 赤枠のエラーボックスと「再試行」ボタン。再読み込み時は前のデータを残し、画面を点滅させない。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| SKU・名称・単位 | `products.sku`、`name`、`unit` | 表示のみ | |
| SKU の温度帯 | `products.zone_id` → `temperature_zones.name` | 表示のみ | 温度帯フィルタの基準 |
| ロット番号 | `lots.lot_no` | 表示のみ | 検索対象 |
| 法定 ID | `lot_regulated_ids.id_type`、`value`、`verification_status` | 表示のみ | `internal_lot` は表示なし |
| ロケーション | `lots.location_id` → `locations.code`、`zone_id`、`is_quarantine` | 表示のみ | 検索対象。温度帯違いの判定に使う |
| ロット状態 | `lots.status`（`available`／`quarantine`／`review`） | 表示のみ | `scrapped` は在庫0のため出ない |
| 期限種別 | `product_versions.expiry_type`（`product_rule_at(product_id, 今日JST)`） | 表示のみ | 消費＝赤 |
| 期限間近しきい日数 | `product_versions.near_expiry_days`（同上） | 表示のみ | 0〜365 |
| 製造日・期限 | `lots.mfg_date`、`expiry_date` | 表示のみ | |
| 残日数・期限区分 | SQL 算出（`expiry_date − 今日JST`、`ok`／`near`／`expired`） | 表示のみ | |
| 在庫数・入荷数 | `lots.qty_on_hand`、`qty_received` | 表示のみ | `qty_on_hand > 0` のみ |
| 仕入先 | `lots.supplier_id` → `suppliers.name` | 表示のみ | 検索対象 |
| 入荷日時 | `lots.received_at` | 表示のみ | 同じ期限内の並びに使う |

## 8. 技術的制約・非機能面の考慮

- **NFR-PERF-01**：読み取り p95 ≦ 2秒（同時 80 ユーザー）。index `lots(product_id, expiry_date, received_at)`、`lots(location_id)` を使い、BFF で全件取得しない。
- **日付**：「今日」は JST（`todayJst()`、SQL は `(now() at time zone 'Asia/Tokyo')::date`）。00:00〜09:00 JST の UTC ずれで残日数を誤らない。
- **ADR-002**：画面 → BFF → ユーザー JWT で Supabase（RLS 適用）。**ADR-004**：期限種別・期限間近日数は今日に有効な版を読む。**ADR-006**：ローカル環境のみ。性能はローカルでは参考値。
- **NFR-SEC-02**：閲覧は `has_role()` で権限のあるロールに限る。
- **NFR-LOC-01**：日本語ラベル、日付 `yyyy/mm/dd`。**NFR-ACC-01**：色だけに頼らず、バッジに必ず文字を入れる。
- **関連要件**：FE-12、FR-INV-05、FR-INV-06、BR-EXP-01。
- **端末**：PC・タブレット・スマートフォン。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] Given しきい日数 m の SKU、When 期限が今日−1日・今日+m日・今日+(m+1)日のロットを表示する、Then それぞれ「期限切れ 1 日」赤・「m 日（しきい m）」橙・「m+1 日」通常で表示される（unit + E2E）〔D-001〕
- [ ] 時刻を UTC 前日にあたる JST 00:00〜09:00 に固定しても、残日数は JST の日付で計算される（unit、固定時計）〔D-019〕
- [ ] `near` は期限間近と期限切れのみ、`quarantine` は隔離中（と `review`）のみ、`all` は在庫ありの全ロットを返し、いずれも期限の昇順に並ぶ（API テスト + pgTAP）
- [ ] 温度帯フィルタは SKU の温度帯で絞り込まれ、ロケーション温度帯が SKU 温度帯と違うロットに「温度帯違い」バッジが付く（E2E）〔D-002〕
- [ ] SKU・ロット番号・仕入先・ロケーションで検索できる（API テスト + E2E）
- [ ] SKU の期限間近日数を新しい版に切り替えると、適用開始日以降の表示に反映される（pgTAP）
- [ ] 6ロール（warehouse／manager／qa／sales／admin／auditor）は閲覧でき、`app_users` なしは 403、未ログインは 401 になる（API テスト + pgTAP RLS）〔D-011〕
- [ ] 絞り込み・ページングが SQL 側で行われ（BFF で全件取得しない）、3年分相当のロットで p95 が 2秒以内（ローカルは参考値、本計測は D-010 の環境）〔D-010〕
- [ ] ラベル・バッジ・メッセージが日本語、日付が `yyyy/mm/dd` で表示される（E2E）〔D-014〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 「隔離」タブに `review` ロット（牛個体識別番号 9桁）も区別表示で含める | 目標設計に `review` 状態はあるが、在庫照会での見せ方が未定義（Q3 に関連） | テックリード／お客様 | M-02（2026-10-30） |
| 2 | [ASSUMPTION] ページングは 50 件／ページ、検索は部分一致 | 設計は検索項目のみ定義 | テックリード | S2 開始（2026-12-14） |
| 3 | [ASSUMPTION] 不明な `zone` はすべての温度帯として扱う | 仕様は不明な `view` の扱いのみ定義 | テックリード | S2 開始（2026-12-14） |
| 4 | [ASSUMPTION] 在庫移動の履歴は本画面に表示しない | FE-09 は台帳のみで画面 ID がない | PM／お客様 | M-03（2026-11-27） |
| 5 | 未決：優先度 P1 のため、同じスプリント（S2）では P0 ストーリーを優先し、遅れたら次スプリントへ回す | RFP の機能・画面一覧で SCR-08／FE-12 は P1 | PM | S2 開始（2026-12-14） |
| 6 | [ASSUMPTION] メッセージ・空表示の日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 7 | 未決：同一スプリント内で E-03-S01（ロットの作成）に依存する | schedule.md §3 | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-04-S02 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-010, D-011, D-014, D-019）
- 関連機能ID：SCR-08, FE-12（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-PERF-01, NFR-SEC-02, NFR-LOC-01, NFR-ACC-01, FR-INV-05, FR-INV-06, BR-EXP-01
- 画面仕様：[scr-08-10-inventory-and-quarantine.md](../../../docs/03-detail-design/scr-08-10-inventory-and-quarantine.md)（§1, §2, §4, §7）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A07）
- 基本設計：[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3 S05）
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-05）
- ADR：[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2, §4.3）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05, D-18）
- 関連ストーリー：[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-04-S04](story-E-04-S04-quarantine-release-and-scrap.md)、E-02-S02、E-08-S01

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
