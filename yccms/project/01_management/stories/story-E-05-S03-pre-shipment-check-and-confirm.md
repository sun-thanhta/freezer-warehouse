# E-05-S03: 出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-05-S03 |
| ストーリー名 | Kiểm trước xuất & xác nhận giao (nhiệt dải lạnh nhất, lịch sử giao bất biến)（和訳：出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴）） |
| 関連Epic | E-05（出荷・引当・出荷前検品／F05） |
| 関連機能ID | SCR-15, FE-21（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、選んだロットと出荷時の品温を入力して一度で出荷を確定し、在庫・納品履歴・監査記録が同時に正しく残るようにしたい。なぜなら、確定後に履歴が欠けたり書き換えられたりすると、次回以降の日付逆転判定とトレースの根拠が崩れるからだ。

## 3. 背景・目的

- 出荷確定は、在庫の減算・納品履歴（`delivery_history`）の追加・オーダーの出荷済み化を **1 つの SQL トランザクション** で行う必要がある（ADR-001）。納品履歴は次回の日付逆転の基準になるため、後から変更・削除できてはならない（DR-HIST-01、D-17）。
- 複数温度帯を含むオーダーでは、品温は **最も低温の温度帯**（`max_c` が最小、NULL は +∞）で測り、許容範囲は `[max(min_c), min(max_c)]` とする（業務ルール §1.4、BR-TEMP-01）。
- 同じ顧客×SKU の 2 オーダーを同時に確定しても、両方が古い基準を読んで日付逆転をすり抜けないこと（write skew 防止、ADR-003）が求められる。
- 本ストーリーは出荷前検品ブロック（SCR-15）と `POST /api/outbound/[id]/ship`（A11）の通常出荷経路、`confirm_shipment` / `_perform_shipment` を実装する。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| warehouse（倉庫作業者） | 主利用者。品温を入力し、出荷を確定する |
| manager（倉庫管理者） | warehouse と同じ操作 |
| qa / sales / admin / auditor | 出荷済みオーダーの確定内容（出荷日時・品温・ロット）の閲覧のみ。確定ボタンは表示しない |

## 5. スコープ

**対象範囲**

- 出荷前検品ブロック：品温入力（°C、0.1 刻み、必須）、「オーダーの最も低温の温度帯で測定：{範囲}」のガイド、エラーボックス、確定ボタン（送信中は「確認中…」でロック）。
- ボタン表示：⑤ 選択なし →「検品して出荷確定」（緑）。⑤ を選択し理由なし →「出荷確定（日付逆転あり）」（赤）。⑤ を選択し理由あり →「例外申請を送信」（赤、処理は E-06-S02）。
- BFF 検証（エラーを集約して 422）：V1 オーダーが `open`、V2 承認待ち申請なし、V3 行ごとの選択合計 = 必要数、V4 顧客×SKU契約あり、V5 ロットが行の候補に含まれ在庫あり、V6 数量 > 0 かつ在庫以下（同一ロットの合計も）、V7 ①、V8 ②、V9 ③、V10 行がオーダーに属する、V11 品温あり、V12 品温が最も低温の温度帯の範囲内。
- 警告（成功時に `warnings[]` で返し、ブロックしない）：④ 納品期限超過「商慣習であり実際の期限ではない」、契約の納品期限未確定「業務レビュー（既定値は当てない）」。
- ⑤ を選択し理由なしの場合：`allocation_exceptions` に BR-DATE-01 `blocked` を 1 回だけ記録し、409「ブロック：日付逆転禁止に違反。別のロットを選ぶか、理由を入力して管理者に例外申請してください」と `details.reversals[]` を返す。
- `confirm_shipment` → `_perform_shipment`（1 トランザクション）：
  1. オーダーを `FOR UPDATE`（`ORDER_NOT_FOUND`／`ORDER_NOT_OPEN`）→ 顧客×SKU のアドバイザリロック（`product_id` 昇順）→ 日付逆転の基準をスナップショット。
  2. `_validate_shipment`：品温（`SHIP_TEMP_OUT_OF_RANGE`）→ 行ごとの数量（`ALLOCATION_MISMATCH`）→ 引当ごと（`lot_id` 順にロット `FOR UPDATE`）に `INVALID_QTY`、`LINE_NOT_IN_ORDER`、`LOT_PRODUCT_MISMATCH`、`INSUFFICIENT_STOCK`、`USE_BY_EXPIRED`、`ZONE_MISMATCH`、`LOT_QUARANTINED`、⑤ の集約 → ロット合計 ≤ 在庫。通常出荷で ⑤ があれば `DATE_REVERSAL`。
  3. オーダーの SKU で、引当が除外した在庫ありの消費期限ロットごとに BR-EXP-02 `blocked` を 1 回記録。
  4. `lots.qty_on_hand` を減算し、`inventory_movements`（`ship`）を記録。
  5. `outbound_allocations`（`shipped`、④ の警告を `warnings` に保存）を記録。
  6. `delivery_history`（顧客・納品先・SKU・ロット・オーダー・`allocation_id`・数量・ロット期限・日時）を追加。これが新しい日付逆転の基準になる。
  7. `shipment_temperature_checks` に品温を記録し（[ASSUMPTION] 最も低温の温度帯の 1 行のみ。区画・シール番号は NULL 可）、オーダーを `shipped`（`shipped_at`、`shipped_by`）にする。
  8. 同オーダーの承認待ち申請を `cancelled`（「オーダーは出荷済み」）にする。
  9. `audit_logs` に `outbound.ship`（引当・品温・例外件数）を記録。
- `delivery_history` に全ロール対象の UPDATE/DELETE 禁止トリガー（`forbid_update_delete`）を付ける。
- 出荷済みオーダーの表示：検品ブロックの代わりに「出荷済み」カード（出荷日時・品温・SKU／ロット／期限／数量）。
- POST の `Idempotency-Key` ヘッダー対応（目標設計）。

**対象外**

- 例外申請の作成・承認・却下（E-06-S02）。例外ログの整合性トリガー・閲覧画面（E-06-S03）。[ASSUMPTION] `allocation_exceptions` への書込自体は出荷トランザクション内のため本ストーリーで行う。
- 車両の区画ごとの測温・シール番号・積込検品（E-09-S01）、POD（E-09-S02）。
- 品温逸脱時の逸脱ケース作成（E-11-S02）。
- 顧客別納品履歴画面（E-02-S05）。

## 6. 主要業務フロー

**正常フロー**

1. 作業者が引当画面（E-05-S02）で候補を確認し、検品ブロックで品温を入力する。例：OUT-261003-03 は FRO-003（冷凍）を含むため、ガイドは「≤ −18 °C」。
2. 「検品して出荷確定」を押す。画面が `POST /api/outbound/{id}/ship { allocations[], ship_temp_c }` を送る。
3. BFF が V1〜V12 を検証し、`rpc confirm_shipment` を呼ぶ。
4. SQL がロック → スナップショット → 最終検証 → 書込（§5 の 1〜9）を 1 トランザクションで行う。
5. 200 `{ requested: false, warnings[] }` が返り、「出荷を確定しました。顧客の納品履歴を更新し、在庫を減算しました。」と警告一覧（橙）を表示する。画面は「出荷済み」表示に切り替わる。

**代替・例外フロー**

- 品温未入力・範囲外：422（V11／V12、SQL は `SHIP_TEMP_OUT_OF_RANGE`）。「出荷時品温 X °C は範囲外です。コールドチェーンの是正後に出荷してください。」入力値は保持する。
- 数量不一致・契約なし・在庫超過：422（V3／V4／V6、SQL は `ALLOCATION_MISMATCH` 等）。行ごとのエラーを一覧表示する。
- ① / ② / ③ のロットを API で直接送信：422（`USE_BY_EXPIRED`／`ZONE_MISMATCH`／`LOT_QUARANTINED`）。① は BR-EXP-02 の `blocked` を記録する。
- ⑤ を選択し理由なし：409 と `details.reversals[]`。BR-DATE-01 `blocked` を 1 回記録（重複送信しても 1 件）。
- 表示後に他者が同じロットを出荷し在庫不足：409 `INSUFFICIENT_STOCK`「在庫が変わりました。再読込してください。」
- 二重確定・他者が先に確定：409 `ORDER_NOT_OPEN`。
- 同じ顧客×SKU の 2 オーダーを同時確定：後のトランザクションはロック待ちの後、新しい基準で判定され、違反なら 409 `DATE_REVERSAL`。
- 承認待ち申請があるオーダー：検品ブロックを表示しない。API でも 422（V2）。
- 未ログイン 401、ロール未付与・権限なし（qa 等）403、オーダーなし 404、DB 接続不可 503。
- [ASSUMPTION] 品温逸脱時は 422 でブロックするのみとし、逸脱ケース（目標設計）は F07（E-11-S02）実装時に連携する。
- [ASSUMPTION] 同じ `Idempotency-Key` の再送は、初回の結果をそのまま返し二重書込しない。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 出荷時品温 | 画面入力 → `shipment_temperature_checks.temp_c` | 編集可 | 必須、0.1 刻み |
| 測温対象の温度帯 | 算出：オーダー SKU の `zone_range_at(zone_id, refDate)` のうち `max_c` 最小 → `shipment_temperature_checks.zone_id` | 表示のみ | NULL は +∞ |
| 許容範囲 | `[max(min_c), min(max_c)]`（最も低温の帯の行） | 表示のみ | |
| 測定日時・測定者 | `shipment_temperature_checks.measured_at`, `actor_id` | 表示のみ | `actor_id` は JWT から |
| 引当（行×ロット×数量） | 画面選択 → `outbound_allocations.order_line_id`, `lot_id`, `qty`, `status`, `warnings` | 編集可（確定前） | UK（`order_line_id`, `lot_id`） |
| 在庫 | `lots.qty_on_hand`、`inventory_movements` | 表示のみ | 負在庫禁止 |
| 納品履歴 | `delivery_history`（`customer_id`, `site_id`, `product_id`, `lot_id`, `order_id`, `allocation_id`, `qty`, `expiry_date`, `delivered_at`） | 表示のみ（追加のみ） | 更新・削除禁止トリガー |
| オーダー状態 | `outbound_orders.status`, `shipped_at`, `shipped_by` | 表示のみ | `open` → `shipped` |
| 例外記録 | `allocation_exceptions`（`rule`, `decision='blocked'`, `lot_expiry`, `reference_date`） | 表示のみ（追加のみ） | 閲覧は E-06-S03 |
| 監査 | `audit_logs`（`action='outbound.ship'`, `detail`） | 表示のみ | DB が自動記録 |
| 警告 | API レスポンス `warnings[]` | 表示のみ | ④・業務レビュー |

## 8. 技術的制約・非機能面の考慮

- ADR-001：書込は `SECURITY DEFINER` 関数のみ（`search_path = public, pg_temp`、`auth.uid()` とロールを自己検査）。`_validate_shipment` / `_perform_shipment` は誰にも実行権限を与えない。テーブルへの直接書込は RLS で拒否。
- ADR-003：オーダー `FOR UPDATE` → アドバイザリロック `pg_advisory_xact_lock(customer_id, product_id)`（`product_id` 昇順でデッドロック回避）→ 基準スナップショット → ロット `FOR UPDATE`（`lot_id` 順）。2 引数のアドバイザリロックは出荷モジュール専用とする。
- 書込中の基準変化：基準は書込ループ前に変数へ取得し、同じ出荷で追加した行と比較しない。
- NFR-PERF-01：書込 p95 ≤ 3 秒。NFR-AUD-01：`audit_logs`・`delivery_history`・`allocation_exceptions` は追記のみ（D-17 のように権限の取上げだけに頼らず、トリガーで全ロール禁止）。
- NFR-SEC-02：確定は warehouse / manager のみ（`has_role()`）。NFR-LOC-01：日時は JST 表示・ISO 8601 保存。
- 避けるべき既知の差異：D-04（メールで人を識別）、D-08（引当未保存）、D-12（品温 1 値のみ）、D-17（不変性をトリガーで守っていない）。
- ADR-006：ローカル Supabase で pgTAP を実行。2 セッション同時実行テストは pgTAP の 1 トランザクション内では再現できないため、Node の `pg` クライアント 2 本で並行実行するスクリプトで検証する。

## 9. 受入基準

- [ ] Given OUT-261003-01（一覧で「出荷可」）、When FEFO 候補のまま範囲内の品温で確定、Then 在庫が減算され、`delivery_history`・`outbound_allocations`（`shipped`）・`shipment_temperature_checks`・`audit_logs`（`outbound.ship`）が 1 トランザクションで追加され、オーダーが `shipped` になる。（pgTAP＋E2E）
- [ ] OUT-261003-03 の測温ガイドが冷凍帯（≤ −18 °C）になり、−15 °C では 422 `SHIP_TEMP_OUT_OF_RANGE` で何も書き込まれない。（ユニット＋pgTAP）
- [ ] CHI-003（絹ごし豆腐）の消費期限到来ロットを API で直接送ると 422 `USE_BY_EXPIRED`、BR-EXP-02 `blocked` が 1 件記録される。遅れた出荷でも本日 JST 基準で判定される。（pgTAP）
- [ ] CHI-004 の隔離ロット LOT-CHI004-A を送ると 422 `LOT_QUARANTINED`。（pgTAP）
- [ ] CUS-003 / CHI-002 の ⑤ ロットを理由なしで送ると 409、`details.reversals[]` に該当ロット、BR-DATE-01 `blocked` は 2 回送っても 1 件。（pgTAP＋E2E）
- [ ] 同じ顧客×SKU の 2 オーダーを 2 セッションで同時に確定すると、後のセッションは新しい基準で判定され、違反なら `DATE_REVERSAL` で拒否される（両方すり抜けない）。（並行実行スクリプト）
- [ ] `delivery_history` への UPDATE / DELETE は、アプリユーザーでもテーブル所有者でも拒否される。（pgTAP）
- [ ] 確定済みオーダーの再確定は 409 `ORDER_NOT_OPEN`、qa ロールの確定は 403。（pgTAP＋統合テスト）
- [ ] ④ 違反ロット（例：AGR-001 の LOT-AMB001-A）を手動で選んで確定すると成功し、警告が `warnings[]` と `outbound_allocations.warnings` の両方に残る。（pgTAP）
- [ ] DoD D-002（SQL 最終判定）・D-003（同時出荷の防止）・D-011（追記のみ）の証跡を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] `shipment_temperature_checks` は本ストーリーでは最も低温の温度帯の 1 行のみ記録（`compartment`・`seal_no` は NULL 可）。区画ごと・シール番号は E-09-S01 で追加 | 目標設計は区画・シール・時刻を持つが、車両・シール情報は本ストーリーの範囲にない。D-12 の移行方針も「最も低温の帯で 1 行」 | テックリード | S3 開始（2027-01-04） |
| 2 | [ASSUMPTION] 品温逸脱は 422 でブロックのみ。逸脱ケースの自動作成は E-11-S02 で連携 | 画面仕様の目標設計に「逸脱 → deviation case」とあるが、F07 は設計未了 | PM | M-03（2026-11-27） |
| 3 | [ASSUMPTION] 同じ `Idempotency-Key` の再送は初回結果を返し二重書込しない | API 仕様は目標で `Idempotency-Key` を採用するとあるが、再送時の挙動は未記載 | テックリード | M-03（2026-11-27） |
| 4 | [ASSUMPTION] 境界：`allocation_exceptions` への書込（出荷時の BR-EXP-02、409 時の BR-DATE-01 `blocked`）は本ストーリー、整合性トリガー・不変化・閲覧は E-06-S03 | E-06-S03 が本ストーリーに依存しており、出荷トランザクション内の書込は分離できない | テックリード | S3 開始（2027-01-04） |
| 5 | Q1：納品先（`customer_sites`）単位で日付逆転を判定する場合、アドバイザリロックのキーと `delivery_history.site_id` の必須化を変更 | 基本設計 §1.7 Q1 | お客様 | M-02（2026-10-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-05-S03）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-003, D-004 の一部, D-011, D-019）
- 画面仕様（§3.3 検品ブロック、§5 検証、§6 書込、§7 状態）：[scr-12-13-15-outbound-allocation-shipping.md](../../../docs/03-detail-design/scr-12-13-15-outbound-allocation-shipping.md)
- 業務ルール（§1.4 出荷時温度帯、§3 ロック、§6 エラーコード）：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)
- API：[api-specification.md（A11）](../../../docs/03-detail-design/api-specification.md)
- データフロー §2.6.3、同時実行 §2.7、エラー処理 §2.8：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)
- ワイヤーフレーム：[wireframe-03-outbound-alerts.md（WF-07）](../../../docs/02-wireframes/wireframe-03-outbound-alerts.md)
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-003](../../../docs/04-adr/adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md §4.4](../../../docs/05-database/01-er-diagram-and-table-design.md)、既知の差異：[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)
- 関連要件：FR-OUT-02、FR-OUT-05（一部）、BR-TEMP-01/02、BR-EXP-02、BR-DATE-01、DR-HIST-01、US-05、NFR-PERF-01、NFR-SEC-02、NFR-AUD-01、NFR-LOC-01
- 関連機能ID：SCR-15、FE-21（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
