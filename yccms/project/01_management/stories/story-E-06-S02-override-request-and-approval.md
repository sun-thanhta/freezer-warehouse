# E-06-S02: 日付逆転の例外申請と承認（起票者 ≠ 承認者）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-06-S02 |
| ストーリー名 | Đề nghị ngoại lệ & duyệt (người lập ≠ người duyệt)（和訳：日付逆転の例外申請と承認（起票者 ≠ 承認者）） |
| 関連Epic | E-06（日付逆転アラート・メーカーチェッカー／F05・F01） |
| 関連機能ID | SCR-05, FE-04（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、顧客が書面で同意した場合に限り、日付逆転となるロットの出荷を理由付きで申請し、自分以外の管理者に承認してもらいたい。なぜなら、日付逆転の例外は二人の目で確認しなければ認められず（NFR-SEC-02）、承認者が「何を承認したか」を正確に把握している必要があるからだ。

## 3. 背景・目的

- 日付逆転禁止（BR-DATE-01）には正当な例外（顧客の書面同意など）があるが、RFP は起票者と承認者を分けるメーカー・チェッカーを必須としている（NFR-SEC-02）。
- ADR-003 の決定：申請時に **引当（行×ロット×数量）と品温を固定して保存** し、承認と同時にその内容どおりに出荷する。承認時は最新データでロック付きの全検証をやり直す。承認と出荷の間に起票者がロットを差し替えられる隙間（不採用案 G）をなくす。
- 本ストーリーは、例外申請（`request_override`）、承認パネル（SCR-05 の S07a）、承認／却下（`decide_override`、A12）、承認待ち一覧（`/alerts` のブロック [5]）を実装する。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| warehouse（倉庫作業者） | 起票者。理由を入力して例外申請を送る。承認はできない |
| manager（倉庫管理者） | 起票者にもなれる。**自分以外が起票した** 申請のみ承認・却下できる |
| qa / sales / admin / auditor | 承認待ち一覧・承認パネルの閲覧のみ。申請・承認はできない |

## 5. スコープ

**対象範囲**

- 申請：引当画面で ⑤ のロットに数量 > 0 を入れたときのみ「日付逆転の例外申請理由」欄を表示。理由ありで送信すると `POST /api/outbound/[id]/ship { allocations[], ship_temp_c, override_reason }` → `rpc request_override`。
  - `request_override`：プロファイルとロール、理由必須（`REASON_REQUIRED`）、オーダー `open`（`ORDER_NOT_OPEN`）、⑤ が実際に含まれる（`NO_REVERSAL`）、`_validate_shipment(p_lock=false)` で ⑤ 以外の検証（ロックなし）。
  - `override_requests`（`pending`、`reason`、`ship_temp_c`、`requested_by`、`expires_at`）と `override_request_items`（`order_line_id`、`lot_id`、`qty`）を保存。`audit_logs` に `override.request`。
  - 1 オーダーにつき `pending` は最大 1 件（条件付き一意索引）。重複は 409「このオーダーには承認待ちの例外申請があります。」
  - 成功時 200 `{ requested: true, requestId }`、「例外申請を送信しました。別の管理者の承認を待っています。」
- 承認パネル（`/outbound/[id]` 内、申請中のみ表示）：起票者・日時・品温、理由、出荷予定の引当一覧（SKU・ロット・期限・数量、⑤ に「日付逆転」表示、ロットが変更・在庫切れなら「（ロット変更あり）」）、判断メモ（却下時必須）、「承認して出荷」「却下」ボタン。
  - ボタンは `manager` かつ起票者本人でない場合のみ表示。起票者には「起票者は自分で承認できません。別の管理者が必要です。」、それ以外には「起票者以外の管理者のみ承認できます。」
- `decide_override(p_request_id, p_approve, p_note)`（A12）：

| # | 検証 | エラー |
| --- | --- | --- |
| V1 | 呼出者が `manager` | `FORBIDDEN` 403 |
| V2 | 申請が存在し `pending`（`FOR UPDATE`） | `REQUEST_NOT_PENDING` 409「申請は処理済みです。」 |
| V3 | 承認者 ≠ `requested_by` | `SELF_APPROVAL` 403 |
| V4 | 却下時はメモ必須 | `REASON_REQUIRED` 422 |
| V5 | 承認時：最新データで出荷チェーン全体（ロック、品温、数量、①②③、在庫）を再実行 | `_validate_shipment` の各コード（例：`INSUFFICIENT_STOCK` 409、`USE_BY_EXPIRED` 422）。失敗時は申請は `pending` のまま |
| V6 | ID が UUID | 404（BFF） |

- 承認時：固定された `override_request_items` どおりに `_perform_shipment` を実行（新しい候補は使わない）。`allocation_exceptions` に BR-DATE-01 `overridden`（`override_request_id`、`approver_id`、理由）を記録。申請は `approved`（`decided_by`、`decided_at`、`decision_note`）、オーダーは `shipped`、`audit_logs` に `override.approve`。
- 却下時：申請は `rejected`、オーダーは `open` のまま、`audit_logs` に `override.reject`。起票者は別ロットを選び直せる。
- 期限：`expires_at` を過ぎた申請は承認できず、`cancelled` として扱う。
- 取消：起票者が自分の `pending` 申請を取り消せる（`cancelled`）。
- 承認待ち一覧（`/alerts` の [5]）：最新 50 件、全状態。列：日時、オーダー／顧客、起票者、理由、状態（承認待ち 紫／承認済み → 出荷 緑／却下 赤／取消 灰）、承認者とメモ。空なら「申請はまだありません。」

**対象外**

- 2 段階承認（Q4 の回答待ち。現設計は 1 段階）。
- 新規申請・承認遅延のメール通知（IF-MAIL-01、E-12-S02）。
- マスタ変更のメーカー・チェッカー（`change_requests`、E-02-S03）。
- 例外ログの不変化・閲覧画面（E-06-S03）、出荷確定の通常経路（E-05-S03）。

## 6. 主要業務フロー

**正常フロー**

1. 作業者が OUT-261003-03（CUS-003）を開くと、CHI-002 が「日付逆転で停止」。顧客の書面同意を確認したうえで LOT-CHI002-A に 24 を入れ、品温 −20 °C、理由「顧客の書面同意あり」を入力して「例外申請を送信」を押す。
2. `request_override` が検証し、申請（`pending`）と引当明細（CHI-002 LOT-CHI002-A × 24、CHI-004 LOT-CHI004-B × 10、FRO-003 LOT-FRO003-A × 20）を保存する。引当画面は読取専用になり、承認パネルが表示される。
3. 別の管理者が `/alerts` の承認待ち一覧またはオーダー画面を開き、承認パネルで出荷される明細を確認する。
4. 「承認して出荷」を押すと `decide_override(true)` が、申請をロック → 承認者 ≠ 起票者を確認 → 固定明細で全検証をロック付きで再実行 → 出荷・履歴・例外ログ（`overridden`）・監査を 1 トランザクションで記録する。
5. オーダーは `shipped`、申請は `approved` になり、承認待ち一覧に「承認済み → 出荷」が表示される。

**代替・例外フロー**

- 起票者本人（manager）が承認：403 `SELF_APPROVAL`。UI ではボタン自体を表示しない。
- warehouse / qa が API で承認：403 `FORBIDDEN`。
- 既に承認・却下・取消済み：409 `REQUEST_NOT_PENDING`。
- 却下でメモなし：422 `REASON_REQUIRED`。メモありなら `rejected`、オーダーは `open` に戻り検品ブロックが再表示される。
- 承認時に在庫が変わっていた：409 `INSUFFICIENT_STOCK`、申請は `pending` のまま。起票者が取り消して申請し直す。
- 申請後にロットが消費期限に到達：承認時に 422 `USE_BY_EXPIRED`、申請は `pending` のまま。
- ⑤ を含まない選択で理由付き送信：422 `NO_REVERSAL`。理由が空白のみ：422 `REASON_REQUIRED`。
- 同じオーダーへ 2 件目の申請：409。オーダーが別経路で出荷済み：409 `ORDER_NOT_OPEN`。
- 申請中にオーダーが通常経路で出荷された場合：申請は `cancelled`（「オーダーは出荷済み」）。
- 未ログイン 401、ロール未付与 403、申請 ID 不正 404、DB 接続不可 503。
- [ASSUMPTION] `expires_at` の既定値は申請当日の 23:00 JST（業務時間 05:00〜23:00 の終わり）。期限切れの申請は承認時に `REQUEST_NOT_PENDING` を返し、一覧では「取消（期限切れ）」と表示する。
- [ASSUMPTION] 取消できるのは起票者本人のみ。取消理由は任意とし、`audit_logs` に `override.cancel` を記録する。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 例外申請理由 | 画面入力 → `override_requests.reason` | 編集可（申請時のみ） | trim 後必須 |
| 申請時の品温 | `override_requests.ship_temp_c` | 表示のみ | 承認時の出荷に使用 |
| 申請状態 | `override_requests.status` | 表示のみ | `pending` → `approved` / `rejected` / `cancelled` |
| 起票者 | `override_requests.requested_by` → `app_users.email`, `full_name` | 表示のみ | メールの重複保存はしない（D-04） |
| 承認者・判断日時・メモ | `override_requests.decided_by`, `decided_at`, `decision_note` | メモのみ編集可（判断時） | CHECK `decided_by <> requested_by` |
| 有効期限 | `override_requests.expires_at` | 表示のみ | §10 #1 |
| 固定された引当明細 | `override_request_items.order_line_id`, `lot_id`, `qty` | 表示のみ | jsonb は使わない（D-07） |
| 明細の SKU・ロット・期限 | `outbound_lines` → `products.sku`、`lots.lot_no`, `expiry_date` | 表示のみ | ⑤ の印は共通エンジンで算出 |
| 例外記録（承認） | `allocation_exceptions`（`rule='BR-DATE-01'`, `decision='overridden'`, `override_request_id`, `approver_id`, `reason`） | 表示のみ（追加のみ） | 閲覧は E-06-S03 |
| 監査 | `audit_logs`（`override.request` / `override.approve` / `override.reject`） | 表示のみ | DB が自動記録 |

## 8. 技術的制約・非機能面の考慮

- NFR-SEC-02（メーカー・チェッカー）を 3 層で担保：UI（ボタン非表示）、SQL 関数（`FORBIDDEN`・`SELF_APPROVAL`）、DB 制約（CHECK `decided_by <> requested_by`）。ロールは `has_role('manager')`（D-02）。
- ADR-003：申請時は `_validate_shipment(p_lock=false)`（在庫を書かないためロックしない）。承認時に `FOR UPDATE`（申請）→ オーダー → 顧客×SKU のアドバイザリロック（`product_id` 昇順）→ ロットの順でロックして再検証。
- ADR-001：`request_override` / `decide_override` は `SECURITY DEFINER`、`search_path` 固定、`auth.uid()` を自己検査。`override_requests` への直接書込は RLS で拒否。
- NFR-AUD-01：申請・承認・却下・取消を監査ログに残す。NFR-PERF-01：書込 p95 ≤ 3 秒。
- NFR-LOC-01：日本語・JST。
- 避けるべき既知の差異：D-04（承認者をメールのみで識別）、D-07（明細を jsonb で保存）。
- ADR-006：ローカル Supabase で pgTAP。承認者・起票者の 2 アカウントで E2E を実行。

## 9. 受入基準

- [ ] Given OUT-261003-03、When warehouse が ⑤ ロットを選び理由付きで送信、Then `override_requests`（`pending`）と `override_request_items` 3 行が保存され、`audit_logs` に `override.request`、画面は読取専用＋承認パネル表示になる。（pgTAP＋E2E）
- [ ] 同じオーダーへの 2 件目の申請は 409、⑤ を含まない申請は 422 `NO_REVERSAL`、理由なしは 422 `REASON_REQUIRED`。（pgTAP）
- [ ] 起票者本人の manager が承認すると 403 `SELF_APPROVAL`、warehouse と qa は 403 `FORBIDDEN`。UI では起票者に承認ボタンが表示されない。（pgTAP＋E2E）
- [ ] 別の manager が承認すると、固定明細どおりに出荷され（オーダー `shipped`、申請 `approved`）、`allocation_exceptions` に `overridden`（`override_request_id`・`approver_id`・理由付き）が 1 件追加される。（pgTAP＋E2E）
- [ ] 承認前に在庫を減らすと承認は 409 `INSUFFICIENT_STOCK`、ロットが消費期限に到達していれば 422 `USE_BY_EXPIRED` となり、いずれも申請は `pending` のまま。（pgTAP）
- [ ] 却下でメモなしは 422 `REASON_REQUIRED`、メモありで `rejected`、オーダーは `open` のまま。処理済み申請への再判断は 409 `REQUEST_NOT_PENDING`。（pgTAP）
- [ ] `decided_by = requested_by` となる行は DB の CHECK 制約で拒否される（関数を経由しない書込でも）。（pgTAP）
- [ ] `expires_at` を過ぎた申請は承認できない。（pgTAP）
- [ ] 承認待ち一覧に 4 種の状態が正しい色と文言で表示される。（E2E）
- [ ] DoD D-003（メーカー・チェッカー）・D-011（NFR-SEC-02）・D-020（ACC-DATE-01）の証跡を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] `expires_at` の既定値は申請当日 23:00 JST。期限切れは承認不可で「取消（期限切れ）」扱い | 画面仕様は「例：シフト終了」としか記載なし。NFR-AVL-01 の業務時間（05:00〜23:00 JST）の終わりに合わせた | お客様／PM | M-02（2026-10-30） |
| 2 | [ASSUMPTION] 申請の取消は起票者本人のみ、理由任意、`override.cancel` を監査記録 | ADR-003 は目標で取消操作を追加するとあるが、実行者と記録内容は未記載 | PM | M-03（2026-11-27） |
| 3 | Q4：承認は 1 段階か 2 段階か、誰が承認できるか。現設計は 1 段階・manager・起票者以外。2 段階の場合は状態遷移と画面の追加が必要で、本スプリントの範囲を超える | 基本設計 §1.7 Q4 | お客様 | M-02（2026-10-30） |
| 4 | Q1／Q2：比較単位（顧客／店舗）と基準の定義（最大期限／直近）が変わると、承認後の次回判定が変わる | 基本設計 §1.7、ADR-003 | お客様 | M-02（2026-10-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-06-S02）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-003, D-011, D-019, D-020）
- 画面仕様（§4 承認パネル、§5 検証、§7 状態遷移、§9 権限）：[scr-05-date-reversal-alerts-and-approval.md](../../../docs/03-detail-design/scr-05-date-reversal-alerts-and-approval.md)
- 申請の分岐（§5.2）：[scr-12-13-15-outbound-allocation-shipping.md](../../../docs/03-detail-design/scr-12-13-15-outbound-allocation-shipping.md)
- API：[api-specification.md（A11、A12）](../../../docs/03-detail-design/api-specification.md)
- エラーコード・ロック：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)
- データフロー §2.6.4：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)
- ワイヤーフレーム：[wireframe-03-outbound-alerts.md（WF-07a、WF-08）](../../../docs/02-wireframes/wireframe-03-outbound-alerts.md)
- 未決事項 Q4：[01-system-overview-and-scope.md §1.7](../../../docs/01-basic-design/01-system-overview-and-scope.md)
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-003](../../../docs/04-adr/adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md §4.4](../../../docs/05-database/01-er-diagram-and-table-design.md)、既知の差異：[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)
- 関連要件：BR-DATE-01、US-02、NFR-SEC-02、NFR-AUD-01、ACC-DATE-01、NFR-PERF-01、NFR-LOC-01
- 関連機能ID：SCR-05、FE-04（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
