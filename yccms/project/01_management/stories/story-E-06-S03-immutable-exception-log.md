# E-06-S03: 不変の例外ログ（BR-DATE-01／BR-EXP-02）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-06-S03 |
| ストーリー名 | Nhật ký ngoại lệ bất biến (BR-DATE-01 / BR-EXP-02)（和訳：不変の例外ログ（BR-DATE-01／BR-EXP-02）） |
| 関連Epic | E-06（日付逆転アラート・メーカーチェッカー／F05・F01） |
| 関連機能ID | SCR-05, FE-14（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

監査担当（auditor）として、日付逆転と消費期限でブロックされた出荷、および承認された例外のすべてを、誰も書き換えられない記録として検索・出力したい。なぜなら、取引先からの苦情や監査の際に「いつ・誰が・どのロットを・どの基準で止めたか／誰が承認したか」を改ざんの疑いなく示す必要があるからだ。

## 3. 背景・目的

- BR-EXP-02（消費期限 = ハードストップ）と BR-DATE-01（日付逆転禁止）は、ブロックの事実を **不変の例外記録** として残すことを求める（RFP、NFR-AUD-01）。
- プロトタイプは「権限の取上げ」だけで不変性を守っており、テーブル所有者やサービスロールのスクリプトなら書き換えられた（D-17）。承認者もメールのみで識別していた（D-04）。
- 本ストーリーは `allocation_exceptions` の整合性（内容の再計算、実行者の刻印、重複防止、全ロールでの更新・削除禁止、承認との参照整合）と、閲覧ブロック（`/alerts` の [6]、目標設計の絞込・ページング・CSV 出力）を実装する。[ASSUMPTION] 書込そのものは出荷確定（E-05-S03）と例外承認（E-06-S02）のトランザクション内で行い、本ストーリーは整合性と閲覧を担当する。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| auditor（監査） | 主利用者。期間・顧客・規則で絞り込み、証跡として CSV 出力する |
| manager（倉庫管理者） | ブロック・承認の傾向を確認し、運用改善に使う |
| qa（品質管理） | 消費期限ブロックの発生状況を確認する |
| warehouse / sales / admin | 閲覧のみ |

ログへの書込操作をユーザーが直接行うことはない（システムが自動記録）。

## 5. スコープ

**対象範囲**

- 書込経路と内容（記録の仕様として本ストーリーで固定）：

| 書込元 | タイミング | `decision` |
| --- | --- | --- |
| BFF（ユーザー JWT、ポリシー `log_blocked`） | ⑤ を理由なしで出荷しようとした時、または ① のロットを送信した時 | `blocked` |
| `_perform_shipment` | 出荷のたび、引当が除外した在庫ありの消費期限ロット | `blocked`（BR-EXP-02） |
| `_perform_shipment`（承認時） | 承認済み申請に基づく ⑤ ロットの出荷 | `overridden`（BR-DATE-01） |

- 整合性：
  - トリガー `verify_blocked_exception`：クライアントが送った項目を捨て、顧客・SKU・ロット期限・基準を DB 側で再計算する。真の違反でなければ `NOT_A_VIOLATION`（422）。
  - トリガー `stamp_actor`：実行者を JWT（`auth.uid()`）から刻印する。
  - 一意制約 `allocation_exceptions_once`（`rule`, `order_id`, `lot_id`, `decision`）：同じ違反は 1 回のみ記録。
  - CHECK：`decision='overridden'` なら `override_request_id` 必須。`approver_id` は `app_users` への FK（メールの重複保存はしない）。
  - トリガー `forbid_update_delete`：アプリユーザー・テーブル所有者を含む全ロールで UPDATE / DELETE を禁止。保持期間（DR-RET-01）による削除はセッションフラグを持つアーカイブジョブのみ許可。[ASSUMPTION] 保持期間は `audit_logs` と同じ 3 年とする。
  - RLS：SELECT はロールを持つユーザーのみ。INSERT は `authenticated` に対してポリシー `log_blocked`（`blocked` のみ）に限定。`overridden` は関数経由のみ。
- 閲覧ブロック（`/alerts` の [6]「不変の例外ログ（BR-DATE-01／BR-EXP-02）」）：列は日時、規則（BR-EXP-02「消費期限」赤／BR-DATE-01「日付逆転」橙）、オーダー（リンク）、顧客、SKU／ロット、ロット期限と基準（BR-EXP-02：期限 ≤ 出荷日、BR-DATE-01：期限 < 基準日）、判断（「ブロック」赤／「例外承認済み」紫）、実行者／理由（承認者を含む）。空なら「ブロック・承認の記録はまだありません。」
- 目標設計の拡張：期間・顧客・規則での絞込、ページング、CSV 出力。

**対象外**

- 監査ログ（`audit_logs`）画面と監査エクスポートのマニフェスト・チェックサム（E-01-S03、E-08-S03）。
- 例外申請・承認の操作（E-06-S02）、出荷確定（E-05-S03）。
- 入荷時の消費期限到来（`EXPIRED_ON_ARRIVAL`）の扱い（E-03-S01。入荷は受け付けないため本ログの対象外）。

## 6. 主要業務フロー

**正常フロー**

1. 作業者が OUT-261003-03 で ⑤ ロットを理由なしで出荷しようとする → 409 と同時に BR-DATE-01 `blocked` が記録される（トリガーが基準を再計算、実行者を刻印）。
2. OUT-261003-02（CUS-002）を出荷すると、引当が除外した CHI-003（絹ごし豆腐）の消費期限ロットについて BR-EXP-02 `blocked` が記録される。
3. 別の管理者が OUT-261003-03 の例外申請を承認 → BR-DATE-01 `overridden`（申請 ID・承認者・理由付き）が記録される。
4. 監査担当が `/alerts` の [6] を開き、期間「直近 30 日」・規則「日付逆転」で絞り込み、該当行を確認して CSV を出力する。

**代替・例外フロー**

- 同じ違反での再送（ボタン連打）：一意制約により 2 件目は記録されず（BFF は重複を無視）、ログが溢れない。
- 違反でない内容を直接 INSERT：`NOT_A_VIOLATION`（422）で拒否。
- 実行者や期限を偽装した INSERT：トリガーが JWT と DB の値で上書きする。
- `overridden` を `authenticated` が直接 INSERT：RLS で拒否。`override_request_id` なしは CHECK で拒否。
- UPDATE / DELETE：全ロールでトリガーにより拒否（テーブル所有者も含む）。
- 記録 0 件・絞込結果 0 件：空状態の文言を表示。
- 未ログイン 401、ロール未付与 403、DB 接続不可 503（再試行ボタン）。
- [ASSUMPTION] CSV 出力は manager / qa / admin / auditor のみ可能とし、出力操作を `audit_logs` に記録する。
- [ASSUMPTION] 絞込の既定は直近 30 日、1 ページ 50 件。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 日時 | `allocation_exceptions.created_at` | 表示のみ | JST 表示 |
| 規則 | `allocation_exceptions.rule` | 表示のみ | `BR-EXP-02` / `BR-DATE-01` |
| オーダー | `allocation_exceptions.order_id` → `outbound_orders.code` | 表示のみ | 引当画面へのリンク |
| 顧客 | `allocation_exceptions.customer_id` → `customers` | 表示のみ | トリガーが再計算 |
| SKU／ロット | `product_id` → `products.sku`、`lot_id` → `lots.lot_no` | 表示のみ | |
| ロット期限 | `allocation_exceptions.lot_expiry` | 表示のみ | トリガーが再計算 |
| 基準日 | `allocation_exceptions.reference_date` | 表示のみ | BR-DATE-01：基準期限、BR-EXP-02：判定日 |
| 判断 | `allocation_exceptions.decision` | 表示のみ | `blocked` / `overridden` |
| 理由 | `allocation_exceptions.reason` | 表示のみ | 承認時の理由 |
| 実行者 | `allocation_exceptions.actor_id` → `app_users` | 表示のみ | JWT から刻印 |
| 承認者 | `allocation_exceptions.approver_id` → `app_users` | 表示のみ | `overridden` のみ |
| 例外申請 | `allocation_exceptions.override_request_id` → `override_requests` | 表示のみ | `overridden` で必須 |
| 絞込条件 | 画面入力（期間・顧客・規則） | 編集可 | 保存しない |

## 8. 技術的制約・非機能面の考慮

- NFR-AUD-01：追記のみ。不変性はトリガー（全ロール）で守り、権限の取上げだけに頼らない（D-17）。
- ADR-001：既定拒否の RLS。書込は関数とポリシー `log_blocked` のみ。トリガーで内容を再計算し、クライアントの値を信用しない。
- 参照整合：実行者・承認者は `app_users` への FK（D-03、D-04）。索引 `allocation_exceptions(order_id)` を追加（D-18）、絞込用に `(created_at)` 等の索引を検討。
- NFR-PERF-01：p95 読取 ≤ 2 秒。全件取得せずページングする。
- NFR-SEC-02：閲覧はロール保持者のみ。anon は読めない。
- NFR-LOC-01：日本語・JST、CSV は UTF-8 で日時は ISO 8601。
- ADR-006：ローカル Supabase で pgTAP を実行（テーブル所有者による UPDATE / DELETE 拒否も pgTAP で検証）。

## 9. 受入基準

- [ ] 違反していないロットで `blocked` 行を直接 INSERT すると `NOT_A_VIOLATION` で拒否される。（pgTAP）
- [ ] クライアントが送った `actor_id`・`customer_id`・`lot_expiry` は無視され、JWT のユーザーと DB の再計算値で記録される。（pgTAP）
- [ ] UPDATE / DELETE は `authenticated` でもテーブル所有者でも拒否される。（pgTAP）
- [ ] 同じ（規則・オーダー・ロット・判断）は 1 件のみ記録され、409 を 2 回発生させても行数は増えない。（pgTAP）
- [ ] `authenticated` による `overridden` の直接 INSERT は拒否され、`override_request_id` のない `overridden` は CHECK で拒否される。（pgTAP）
- [ ] R-06 の流れ（OUT-261003-03 の理由なし送信 → OUT-261003-02 の出荷 → OUT-261003-03 の例外承認）の後、[6] に BR-DATE-01 `blocked`（CUS-003 / CHI-002、期限 < 基準）、BR-EXP-02 `blocked`（CUS-002 / CHI-003、期限 ≤ 出荷日）、BR-DATE-01 `overridden`（承認者・理由付き）が表示される。（E2E）
- [ ] 期間・顧客・規則の絞込とページングが機能し、CSV の内容が絞込結果と一致する。（E2E）
- [ ] anon とロール未付与ユーザーはログを読めない。（pgTAP）
- [ ] DoD D-003（不変の例外ログ）・D-011（追記のみ、NFR-AUD-01）の証跡を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] CSV 出力は manager / qa / admin / auditor のみ、出力操作を `audit_logs` に記録 | 画面仕様は目標で CSV 出力を追加とするのみ。アーキテクチャ §2.9 は目標でファイル出力イベントの記録を追加するとしている | PM／お客様 | M-03（2026-11-27） |
| 2 | [ASSUMPTION] 絞込の既定は直近 30 日、1 ページ 50 件 | 画面仕様はプロトタイプの 100 件固定を目標で絞込・ページングに変えるとのみ記載 | PM | S3 開始（2027-01-04） |
| 3 | [ASSUMPTION] `allocation_exceptions` の保持期間は `audit_logs` と同じ 3 年（DR-RET-01）、削除はアーカイブジョブのみ | D-17 の対策でアーカイブジョブのみ削除可とあるが、本テーブルの保持年数は未記載 | お客様 | M-02（2026-10-30） |
| 4 | [ASSUMPTION] 境界：ログの書込は E-05-S03 / E-06-S02 のトランザクション内、整合性トリガー・不変化・閲覧は本ストーリー | 本ストーリーは E-05-S03 に依存し、書込を出荷トランザクションから切り離せない | テックリード | S3 開始（2027-01-04） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-06-S03）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-003, D-011, D-019）
- 画面仕様（§3 要素 [6]、§8 不変の例外ログ）：[scr-05-date-reversal-alerts-and-approval.md](../../../docs/03-detail-design/scr-05-date-reversal-alerts-and-approval.md)
- 共通画面ルール（§7 自動監査）：[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- 監査ログ画面：[scr-34-audit-log.md](../../../docs/03-detail-design/scr-34-audit-log.md)
- 業務ルール・エラーコード：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)
- セキュリティの層 §2.5：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)
- ワイヤーフレーム：[wireframe-03-outbound-alerts.md（WF-08 [6]）](../../../docs/02-wireframes/wireframe-03-outbound-alerts.md)
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-003](../../../docs/04-adr/adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md §4.4・§5](../../../docs/05-database/01-er-diagram-and-table-design.md)、既知の差異：[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)
- 関連要件：BR-DATE-01、BR-EXP-02、DR-HIST-01、NFR-AUD-01、NFR-SEC-02、NFR-PERF-01、NFR-LOC-01
- 関連機能ID：SCR-05、FE-14（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
