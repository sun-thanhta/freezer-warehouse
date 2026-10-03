# E-05-S02: 引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-05-S02 |
| ストーリー名 | Allocation chuỗi loại trừ ①消費期限 ②dải ③隔離 ④window ⑤日付逆転 → FEFO/FIFO（和訳：引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO） |
| 関連Epic | E-05（出荷・引当・出荷前検品／F05） |
| 関連機能ID | SCR-13, FE-14, FE-15, FE-16, FE-19（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、出荷オーダーの各行について「どのロットを出せて、どのロットがなぜ除外されるか」と FEFO の引当候補を一画面で確認し、必要なら数量を手で直したい。なぜなら、消費期限到来・温度帯違い・隔離・日付逆転のロットを一つでも出荷すると、食品安全と取引先の信頼を同時に失うからだ。

## 3. 背景・目的

- RFP の FR-OUT-02 は、引当時の除外を **固定の順序** で行うことを求める：① 消費期限 到来／経過（ハードストップ）→ ② 温度帯違い → ③ 隔離中 → ④ 納品期限（delivery window）違反 → ⑤ 日付逆転 → 残りを FEFO（同じ期限なら FIFO）。
- RFP S5-03 の「重大エラー」（賞味期限と消費期限の混同、日付逆転を当日日付と比較、1/3 ルールを法令扱い、他顧客の履歴の借用）を一つも起こさないことが受入ゲート ACC-DATE-01 の条件である。
- 本ストーリーは、引当画面（SCR-13、URL `/outbound/[id]`）と、その判定を担う共通エンジン（TS：`allocation-chain-rules` / `delivery-window-rules` / `pick-plan-service`）、および最終防衛線となる SQL ガード（`_validate_shipment` の ①②③⑤ 判定）を、**同じ順序・同じ結果** で実装する。
- 一覧（E-05-S01）、日付逆転アラート（E-06-S01）、ダッシュボード（E-08-S01）はこのエンジンを再利用する。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| warehouse（倉庫作業者） | 主利用者。引当候補を確認し、ロットごとの出荷数量を入力・修正する |
| manager（倉庫管理者） | warehouse と同じ操作。例外申請の承認判断の材料として除外理由を確認する |
| qa / sales / admin / auditor | 閲覧のみ（数量入力欄は表示しない） |

## 5. スコープ

**対象範囲**

- `GET /api/outbound/[id]`（A10）とピッキング計画 `PickPlan`（行・ロット・除外コード・日付逆転の基準・候補・不足数・行状態・最も低温の温度帯）。
- ロットごとの除外チェーン判定（1 ロットが複数段に該当する場合は全バッジを表示し、候補の除外理由 `excluded[].code` には最初に該当した段のみ記録）：

| 段 | コード | 違反条件 | 自動候補 | 手動選択 | SQL ガード |
| --- | --- | --- | --- | --- | --- |
| ① | `use_by_expired` | 消費期限品（`use_by`）かつ `expiry_date ≤ refDate` | 除外 | 入力欄ロック（ハードストップ） | `USE_BY_EXPIRED` |
| ② | `zone_mismatch` | `locations.zone_id ≠ products.zone_id`、またはロケーションなし | 除外 | 入力欄ロック | `ZONE_MISMATCH` |
| ③ | `quarantine` | `lots.status ≠ 'available'`（隔離・業務レビュー・廃棄） | 除外 | 入力欄ロック | `LOT_QUARANTINED` |
| ④ | `window_violation` | `refDate > 納品期限`（契約の `window_rule` による） | 除外 | **警告のみ**（商慣習であり法令ではない） | 意図的に判定しない |
| ⑤ | `date_reversal` | 基準あり、かつ `expiry_date < 基準`（基準 = 同一顧客×SKU に納品済みの最大期限） | 除外 | 入力可。ただし出荷は例外申請経由のみ | `DATE_REVERSAL` |
| — | FEFO | 残りを期限の早い順、同じ期限なら入荷の早い順（FIFO） | 必要数まで順に引当 | — | — |

- `refDate = max(ship_date, 本日 JST)`（遅れた出荷は実出荷日で判定）。
- 納品期限：`ONE_THIRD` = `mfg_date + ⌊(expiry − mfg) × 1/3⌋`、`ONE_HALF` = `⌊× 1/2⌋`、`LABEL_DATE_ONLY` = `expiry_date`。`window_rule IS NULL` は計算せず「業務レビュー（business-review）」として警告し、**既定値を自動で当てない**（AGR-008 / AGR-014）。
- 行状態：`ok`（不足 0）／`date_reversal`（不足あり、かつ ⑤ のみが理由のロット数量 > 0）／`insufficient`（不足あり、⑤ のみのロットなし）。
- 日付逆転の基準表示：「ロット {lot_no}（期限 {expiry}、{delivered_at}）を納品済み → 期限 {expiry} 以上のロットのみ出荷可」。履歴なしの場合は「この顧客はこの SKU の納品実績なし → 制約なし（他顧客の履歴は借用しない）」。
- 行カード UI：SKU・名称、温度帯・期限種別・契約（`AGR-xxx`・受渡条件・納品期限ルール）、行状態、必要数、選択合計、日付逆転警告、ロット表（FEFO → FIFO 順）、「取出」数量欄（初期値 = 候補数量、①②③ はロック）。
- 最も低温の温度帯の算出（`max_c` が最小の帯、NULL は +∞）と許容範囲 `[max(min_c), min(max_c)]` を計画に含める（入力と判定は E-05-S03）。
- SQL 側：`last_deliveries(customer_ids, product_ids)` と、`_validate_shipment` 内の ①②③⑤ 判定・コード順序を TS と一致させる。
- 設定の版管理（ADR-004）：契約・SKU 規則・温度帯は `agreement_at` / `product_rule_at` / `zone_range_at` で有効な版を読む。[ASSUMPTION] 有効版の判定日は `refDate` とする。
- [ASSUMPTION] 引当計画は保存せず、画面を開くたびに算出する。`outbound_allocations` への書込は出荷確定時（E-05-S03）に行う。

**対象外**

- 出荷前検品（出荷温度の入力・判定）と出荷確定・履歴書込（E-05-S03）。
- 日付逆転アラート画面（E-06-S01）、例外申請・承認（E-06-S02）、例外ログ（E-06-S03）。
- ピッキング工程の分離と `outbound_allocations` の `planned` 状態（E-09-S01）。
- 納品期限ルールの確定・変更（E-02-S04）、温度帯しきい値の版管理（E-04-S01）、隔離の解除・廃棄（E-04-S04）。

## 6. 主要業務フロー

**正常フロー**

1. 作業者が一覧（SCR-12）からオーダーを開く。画面が `GET /api/outbound/{id}` を呼ぶ。
2. BFF の `buildPickPlans(orderId)` が、オーダー・行・在庫ありロット・有効な契約・`last_deliveries()`・承認待ち申請をまとめて読む（バッチ取得）。
3. 各ロットに `evaluateLot` を適用して ①→⑤ の除外コードを付け、残りを FEFO → FIFO に並べて必要数まで候補を作る。行状態と不足数を算出する。
4. 画面は行カードを表示する。例：OUT-261003-03（CUS-003）では、CHI-002 の LOT-CHI002-A／B が「⑤ 日付逆転（< 基準 LOT-CHI002-C の期限）」で行状態「日付逆転で停止」、CHI-004 の LOT-CHI004-A が「③ 隔離中」でロック、LOT-CHI004-B が「FEFO 候補」、AGR-008 は「納品期限未確定 → 業務レビュー」。
5. 作業者は候補をそのまま使うか、数量を修正する。④ のロットを手動で選ぶと警告が出るが入力はできる。
6. 選択結果は E-05-S03 の出荷前検品・出荷確定へ渡される。

**代替・例外フロー**

- ① 消費期限到来ロット（例：CUS-002 宛て CHI-003 絹ごし豆腐 LOT-CHI003-A）：入力欄ロック。API を直接呼んでも SQL が `USE_BY_EXPIRED`（422）で拒否する。遅れた出荷（`ship_date` < 本日）は本日基準で判定する。
- ② 温度帯違い／ロケーションなし：入力欄ロック。SQL は `ZONE_MISMATCH`（422）。
- ③ 隔離中（例：CHI-004 カットサラダ LOT-CHI004-A、C-Q-01）：入力欄ロック。SQL は `LOT_QUARANTINED`（422）。
- ⑤ を含む選択で出荷しようとした場合：E-05-S03／E-06-S02 の流れ（409 ブロック、または例外申請）へ進む。SQL 最終判定は `DATE_REVERSAL`（409）。
- 顧客×SKU契約がない行：「顧客×SKU契約なし」を赤で表示し、出荷確定時に 422 となる（E-05-S03 の V4）。
- 計画表示後に在庫が変わった場合：出荷確定時に SQL が `INSUFFICIENT_STOCK`（409）を返し、再読込を促す。
- 承認待ちの申請があるオーダー：行カードを読取専用にし（数量欄・行状態・選択合計・警告を隠す）、承認パネル（E-06-S02）を表示する。
- オーダーが存在しない／ID 形式不正：404。未ログイン 401、ロール未付与 403、DB 接続不可 503（共通ルール）。
- [ASSUMPTION] 賞味期限品（`best_before`）で期限を過ぎたロットは ① の対象にせずハードストップしない。④ の判定に加え、行カードに警告バッジ「賞味期限超過」を表示するのみとする（BR-EXP-01：賞味期限 = 警告）。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| オーダー見出し | `outbound_orders.code`, `ship_date`, `customers.code`, `name` | 表示のみ | |
| SKU・名称・単位 | `products.sku`, `name`, `unit` | 表示のみ | |
| 温度帯 | `products.zone_id` → `temperature_zones` ／ `zone_range_at(zone_id, refDate)` | 表示のみ | しきい値は版管理、コードに直書きしない |
| 期限種別 | `product_rule_at(product_id, refDate).expiry_type` | 表示のみ | 賞味期限 = 警告、消費期限 = ハードストップ |
| 契約・納品期限ルール | `agreement_at(customer_id, product_id, refDate)`：`code`, `delivery_term`, `window_rule` | 表示のみ | NULL = 業務レビュー、既定値なし |
| 必要数 | `outbound_lines.qty` | 表示のみ | |
| ロット番号・製造日・期限・入荷日時 | `lots.lot_no`, `mfg_date`, `expiry_date`, `received_at` | 表示のみ | FEFO → FIFO の並び順に使用 |
| 在庫数 | `lots.qty_on_hand` | 表示のみ | |
| ロケーション | `locations.code`, `zone_id`, `is_quarantine` | 表示のみ | ② の判定 |
| ロット状態 | `lots.status` | 表示のみ | `available` 以外は ③ |
| 日付逆転の基準 | `last_deliveries()`：`delivery_history` の同一（`customer_id`, `product_id`）の `max(expiry_date)` と該当ロット・日時 | 表示のみ | Q1 / Q2 の回答で単位・定義が変わる |
| 除外コード | 算出（`exclusions[]`、`suggestion.excluded[].code`） | 表示のみ | |
| 取出数量 | 画面入力（初期値 = FEFO 候補） | 編集可（①②③ はロック） | `0 ≤ qty ≤ qty_on_hand` |
| 承認待ち申請 | `override_requests`（`status='pending'`）＋ `override_request_items` | 表示のみ | |

## 8. 技術的制約・非機能面の考慮

- 二層判定（ADR-003、ADR-001）：TS は候補作成と事前警告、SQL（`SECURITY DEFINER`、`search_path` 固定）が最終防衛線。ルールを変える場合は TS と SQL の両方を変更し、両方にテストを書く（業務ルール文書 §1）。
- コード順序の一致：TS の最初の除外コードと SQL の最初のエラーコードが同じになるよう、①→②→③→⑤ の順で評価する（④ は SQL で判定しない）。
- 同時実行：基準の読取は出荷確定時に SQL 側で、オーダーの `FOR UPDATE` → 顧客×SKU のアドバイザリロック（`product_id` 昇順）→ 基準のスナップショット取得の順で行う（実装は E-05-S03、本ストーリーは `_validate_shipment` の判定部を担当）。
- NFR-PERF-01：p95 読取 ≤ 2 秒。ロットはオーダーの SKU に限定してバッチ取得し、索引 `lots(product_id, expiry_date, received_at)`、`delivery_history(customer_id, product_id, expiry_date desc)` を使う（D-18 の索引不足を作らない）。
- NFR-SEC-02：数量入力・出荷は warehouse / manager のみ。閲覧は RLS。
- NFR-LOC-01：日付は JST（SQL：`(now() at time zone 'Asia/Tokyo')::date`）。NFR-ACC-01：除外バッジは色と文言の両方で示す。
- ADR-006：ローカル Supabase（Postgres 17）上で pgTAP を実行。性能測定は P5 以降。
- 避けるべき既知の差異：D-05（設定を上書きで持つ）、D-08（引当の保存先がない）、D-18（子側 FK 索引の不足）。

## 9. 受入基準

- [ ] Given CUS-003 に CHI-002 の LOT-CHI002-C を納品済み、When OUT-261003-03 を開く、Then LOT-CHI002-A／B に「⑤ 日付逆転」が付き、CHI-002 行の状態が `date_reversal`、基準ロットと期限が表示される。（ユニット＋E2E）
- [ ] OUT-261004-05（CUS-005 / CHI-002）では ⑤ が一つも付かない（CUS-003 の履歴を借用しない）。CUS-004 宛ての計画も CUS-003 の履歴に影響されない。（ユニット＋pgTAP）
- [ ] 期限が基準と同日のロットは ⑤ にならない。日付逆転を本日日付と比較するロジックが存在しない（ユニット：基準なし・同日・1 日前の 3 ケース）。
- [ ] CHI-003（絹ごし豆腐）の消費期限到来ロットは ① で入力欄がロックされ、`ship_date` が過去のオーダーでも本日 JST 基準で ① となる。SQL は `USE_BY_EXPIRED` を返す。（ユニット＋pgTAP＋E2E）
- [ ] CHI-004（カットサラダ）の LOT-CHI004-A（隔離中）は ③ でロック、候補は LOT-CHI004-B になる。SQL は `LOT_QUARANTINED` を返す。（E2E＋pgTAP）
- [ ] AGR-008 / AGR-014（`window_rule` NULL）は「業務レビュー」と表示され、1/3・1/2 等の既定値で納品期限を計算しない。（ユニット）
- [ ] ④：AGR-001（ONE_THIRD）で LOT-AMB001-A は候補から除外されるが、手動で数量を入れられ、警告のみで SQL は拒否しない。（ユニット＋pgTAP）
- [ ] 残りロットは期限昇順、同じ期限なら `received_at` 昇順で候補になる（FEFO/FIFO）。（ユニット）
- [ ] TS と SQL の一致テスト：R-06 の各ロットについて、`evaluateLot` の最初の除外コードと `_validate_shipment` のエラーコード（`USE_BY_EXPIRED`／`ZONE_MISMATCH`／`LOT_QUARANTINED`／`DATE_REVERSAL`）が対応し、④ は両方とも拒否しない。（表駆動の統合テスト）
- [ ] DoD D-002（チェーン順序・TS/SQL 一致・ACC-DATE-01）と D-003（顧客×SKU 単位の日付逆転）の証跡として、ユニット・pgTAP・E2E の結果を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 賞味期限超過ロットは ① 対象外。④ に加えて警告バッジ「賞味期限超過」のみ表示 | BR-EXP-01（賞味期限 = 警告）。チェーン表に賞味期限超過の扱いが明記されていない | PM／お客様 | M-02（2026-10-30） |
| 2 | [ASSUMPTION] 版管理された設定（契約・SKU 規則・温度帯）は `refDate` 時点で有効な版を読む | ADR-004 で `*_at(date)` に切替えるとあるが、どの日付で読むかは未記載。消費期限の判定基準日と揃えるのが自然 | テックリード | M-03（2026-11-27） |
| 3 | [ASSUMPTION] 本ストーリーでは引当計画を保存せず、開くたびに算出する。`outbound_allocations` への書込は出荷確定時（E-05-S03）、`planned` 状態はピッキング工程（E-09-S01）で使う | 設計は `planned/shipped` を定義するが、ピッキング分離（SCR-14）は範囲外 | テックリード | S3 開始（2027-01-04） |
| 4 | 規模リスク：エンジン（TS）・画面・SQL ガード・一致テストを 1 スプリント（2 週間）に収めるのは重い。分割・改番はせず、S2 の空き工数で TS ルールのユニットテストを先行する、ペア作業にする等の対策を S3 計画で判断する | 引当エンジンはビルド中で最もルールが集中する箇所（ロードマップ P3） | PM | S2 終了（2026-12-25） |
| 5 | Q1：日付逆転の比較単位は顧客か、店舗（納品先 `customer_sites`）か。店舗単位ならグルーピングキーとアドバイザリロックのキーを変更 | 基本設計 §1.7 Q1、ADR-003 | お客様 | M-02（2026-10-30） |
| 6 | Q2：基準は「納品済みの最大期限」か「直近の納品」か。設計は最大期限（より厳格）を採用。直近を選ぶ場合は `last_deliveries` とスナップショット部を変更 | 基本設計 §1.7 Q2、ADR-003 | お客様 | M-02（2026-10-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-05-S02）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-003, D-010, D-019）
- 画面仕様（§3 引当、§4 除外チェーン、§4.1 納品期限、§4.2 行状態、§5.3 SQL 検証）：[scr-12-13-15-outbound-allocation-shipping.md](../../../docs/03-detail-design/scr-12-13-15-outbound-allocation-shipping.md)
- 業務ルール・状態遷移・エラーコード：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)
- API：[api-specification.md（A10）](../../../docs/03-detail-design/api-specification.md)
- データフロー §2.6.3、同時実行 §2.7：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)
- ワイヤーフレーム：[wireframe-03-outbound-alerts.md（WF-07）](../../../docs/02-wireframes/wireframe-03-outbound-alerts.md)
- 未決事項 Q1／Q2：[01-system-overview-and-scope.md §1.7](../../../docs/01-basic-design/01-system-overview-and-scope.md)
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-003](../../../docs/04-adr/adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md §4.2・§4.4](../../../docs/05-database/01-er-diagram-and-table-design.md)、既知の差異：[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)
- テスト計画：[test-plan.md](../../05_test/test-plan.md)
- 関連要件：FR-OUT-02、BR-EXP-01/02、BR-TEMP-01/02、FR-INV-05、BR-DELWIN-01、BR-DATE-01、BR-FEFO-01、US-01、US-02、ACC-DATE-01、NFR-PERF-01、NFR-SEC-02、NFR-LOC-01
- 関連機能ID：SCR-13、FE-14、FE-15、FE-16、FE-19（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
