# E-08-S01: 運用ダッシュボード（KPI）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-08-S01 |
| ストーリー名 | Tổng quan vận hành (KPI)（和訳：運用ダッシュボード（KPI）） |
| 関連Epic | E-08（ダッシュボード・帳票／F09） |
| 関連機能ID | SCR-01（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P1 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）として、シフト開始時にホーム画面を開くだけで、日付逆転でブロック中の行・承認待ちの例外・隔離ロット・消費期限到来ロット・納品期限未確定の契約といった「今日対応すべきこと」の件数を把握し、該当画面へすぐ移動したい。なぜなら、各画面を順に見て回らないと気づけない状態では、対応漏れが出荷遅延や食品事故につながるからだ。

## 3. 背景・目的

- 運用ダッシュボード（SCR-01、URL `/`）は、ログイン直後に表示されるホーム画面で、各モジュールの「要対応」件数を KPI カードとして並べる。
- 出荷待ちオーダーと日付逆転ブロック行の件数は、E-05-S02 の共通エンジン（`buildPickPlans`）を使い、一覧（SCR-12）・アラート（SCR-05）と常に一致させる（SCR-01 設計メモ）。
- 実データ（月 7,200 出荷行）では、プロトタイプのような「開くたびに行を取得して数える」方式では p95 ≤ 2 秒を守れないため、目標設計では SQL 側で件数を集計する。
- 本ストーリーは `GET /api/dashboard`（A02）と画面を実装する。読取専用である。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| manager（倉庫管理者） | 主利用者。承認待ち・ブロック・隔離・未確定契約を把握し、対応を割り振る |
| warehouse（倉庫作業者） | 当日の出荷待ち・入荷予定・ブロックを確認して作業に入る |
| qa（品質管理） | 隔離ロット・消費期限到来・入荷時温度逸脱を確認する |
| sales（営業・CS） | 納品期限未確定の契約とブロック状況を確認し、顧客と調整する |
| admin（システム管理） | 閲覧のみ |
| auditor（監査） | 画面権限表で SCR-01 は対象外（—） |

## 5. スコープ

**対象範囲**

- 見出しと業務日付（本日 JST）、ショートカット「＋入荷伝票」（`/inbound/new`）・「出荷」（`/outbound`）。
- KPI カード（クリックで遷移）：

| No. | カード | 算出方法 | 遷移先 |
| --- | --- | --- | --- |
| 4a | 出荷待ちオーダー | `status='open'` の件数（共通エンジン）。補足：除外ロット合計（最初に該当したチェーン段のみ） | `/outbound` |
| 4b | 日付逆転でブロック中の行（赤） | 出荷待ち行のうち行状態 `date_reversal` の件数 | `/alerts` |
| 4c | 例外承認待ち（紫） | `override_requests` の `status='pending'` 件数 | `/alerts` |
| 4d | 納品期限未確定の契約（橙） | 本日有効な `customer_sku_agreements` のうち `window_rule IS NULL` の件数 | `/customers` |
| 4e | 隔離中ロット（紫） | `qty_on_hand > 0` かつ `status='quarantine'` | `/inventory?view=quarantine` |
| 4f | 消費期限到来ロット（赤） | 在庫あり、SKU が消費期限品、`expiry_date ≤ 本日` | `/inventory?view=near` |
| 4g | 期限間近ロット（橙） | 在庫あり、`0 ≤ (期限 − 本日) ≤ near_expiry_days`（期限切れは含めない） | `/inventory?view=near` |
| 4h | 入荷時の温度逸脱（7 日、灰） | `inbound_lines.temp_ok = false` かつ入荷日 ≥ 本日 − 7。補足：本日の入荷伝票数 | `/inbound` |

- 直近 7 日の例外：5a ブロック件数（`allocation_exceptions` の `decision='blocked'`、赤）、5b 承認済み例外件数（`decision='overridden'`、紫）、5c 規則の注記（固定文言）。
- 6 最近の操作：`audit_logs` の最新 6 件（操作・実行者・日時）と「監査ログを見る →」（`/audit`）。
- 画面状態：読込中 → 表示／エラー（赤枠＋再試行）。

**対象外**

- 12 種の運用帳票と標準 KPI ダッシュボード（E-08-S02）、監査エクスポート（E-08-S03）。
- 温度ロガー・POD・配送ルートの KPI（F06・F07 が範囲に入った時点で追加）。
- KPI の目標値設定・推移グラフ（設計に記載なし）。

## 6. 主要業務フロー

**正常フロー**

1. 管理者がログインすると `/` が表示され、画面が `GET /api/dashboard` を呼ぶ。
2. BFF は、件数集計（SQL 関数）と共通エンジン `buildPickPlans({ openOnly: true })` を並行実行し、`{ today, inboundToday, openOrders, reversalBlocked, pendingApprovals, excludedLots, quarantineLots, nearExpiryLots, useByExpiredLots, reviewAgreements, tempFailures7d, blockedEvents7d, overrides7d, recentAudit[] }` を返す。
3. シード（R-06）では、4b に OUT-261003-03（CUS-003 / CHI-002）の 1 行、4d に AGR-008・AGR-014 の 2 件、4e に CHI-004 カットサラダ LOT-CHI004-A などの隔離ロットが計上される。
4. 管理者は 4c「例外承認待ち」をクリックして `/alerts` へ移動し、承認作業に入る。

**代替・例外フロー**

- すべて 0 件：各カードに 0 を表示する（エラーにしない）。
- API エラー：赤枠の共通エラーと「再試行」。
- 未ログイン：`/login` へ遷移（401）。ロール未付与：403。DB 接続不可：503「システムメンテナンス中」。
- 期限切れの賞味期限品：4f（消費期限）にも 4g（期限間近）にも含めない（在庫画面の「期限間近・期限切れ」ビューで確認）。
- [ASSUMPTION] 「最近の操作」は監査ログの閲覧権限を持つロール（manager・qa・admin）にのみ表示し、warehouse・sales には表示しない。
- [ASSUMPTION] auditor はダッシュボードの対象外のため、ログイン後のホームを監査ログ（`/audit`）とする。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 業務日付 | `(now() at time zone 'Asia/Tokyo')::date` | 表示のみ | JST |
| 出荷待ちオーダー数・除外ロット数 | `outbound_orders.status`、共通エンジン | 表示のみ | 一覧と一致 |
| 日付逆転ブロック行数 | 共通エンジンの行状態 `date_reversal` | 表示のみ | アラート画面と一致 |
| 例外承認待ち数 | `override_requests.status` | 表示のみ | |
| 納品期限未確定数 | `customer_sku_agreements.window_rule`（本日有効な版） | 表示のみ | NULL = 業務レビュー |
| 隔離中ロット数 | `lots.status`, `qty_on_hand` | 表示のみ | |
| 消費期限到来ロット数 | `lots.expiry_date`, `qty_on_hand`、`product_versions.expiry_type`（本日有効） | 表示のみ | 消費期限品のみ |
| 期限間近ロット数 | `lots.expiry_date`、`product_versions.near_expiry_days` | 表示のみ | 期限切れは除く |
| 入荷時温度逸脱数（7 日）・本日入荷数 | `inbound_lines.temp_ok`、`inbound_receipts.arrival_date` | 表示のみ | |
| ブロック件数・承認済み例外数（7 日） | `allocation_exceptions.decision`, `created_at` | 表示のみ | |
| 最近の操作 | `audit_logs.action`, `actor_email`, `created_at`（最新 6 件） | 表示のみ | `actor_email` は記録時点の写し |

## 8. 技術的制約・非機能面の考慮

- NFR-PERF-01：p95 読取 ≤ 2 秒（同時 80 ユーザー）。件数は SQL で `count` し、行を BFF に取得しない（プロトタイプの 1,000 行上限問題を避ける）。
- 集計方式：件数は SQL 集計関数で返す（画面仕様 §8）。[ASSUMPTION] 4a・4b は共通エンジンで都度算出し、マテリアライズドビュー（5 分更新）は負荷試験で p95 を満たせない場合のみ導入する。
- 一致性：4a・4b は共通エンジンを使い、一覧・アラートと同じ数値にする。
- NFR-SEC-02：閲覧は RLS。監査ログの表示はロール権限に従う（§10 #1）。
- NFR-LOC-01：日本語・JST。NFR-ACC-01：カードは色だけでなく見出しと数値で意味を示し、キーボードで遷移できる。
- ADR-002：BFF 経由。ADR-006：ローカル Supabase で開発し、80 ユーザーでの性能測定はクラウド環境（P5）で行う。

## 9. 受入基準

- [ ] Given シード（R-06）、When manager が `/` を開く、Then 4b が 1（OUT-261003-03 / CHI-002）、4d が 2（AGR-008・AGR-014）となり、4b の数値が `/alerts` の [3] と `/outbound` の「日付逆転で停止」合計に一致する。（E2E＋統合テスト）
- [ ] 例外申請を 1 件送ると 4c が 1 増え、承認すると 0 に戻り、5b（7 日の承認済み例外）が 1 増える。（E2E）
- [ ] 4e に隔離中の CHI-004 LOT-CHI004-A が計上され、4f に CHI-003（絹ごし豆腐）の消費期限到来ロットが計上される。賞味期限品の期限切れロットは 4f に入らない。（統合テスト）
- [ ] 4g は期限まで 0 日以上 `near_expiry_days` 以内のロットのみで、期限切れロットを含まない。（ユニット）
- [ ] 各カードのクリックで指定の URL に遷移する。（E2E）
- [ ] 件数取得で行を BFF に取得していない（SQL の `count` を使用、ロット 1,000 行超のデータでも件数が正しい）。（統合テスト）
- [ ] warehouse・qa・sales・admin が閲覧でき、未ログインは 401、ロール未付与は 403、DB 停止時は 503 と再試行ボタンが出る。（E2E＋統合テスト）
- [ ] 全件 0 のデータでもエラーにならず 0 が表示される。（E2E）
- [ ] DoD D-009（ダッシュボード KPI）・D-010（p95 ≤ 2 秒、測定は NFR ワークストリーム）・D-001（SCR-01）の証跡を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 「最近の操作」は manager・qa・admin にのみ表示し、warehouse・sales には表示しない | 画面権限表で監査ログ（S13）は warehouse・sales が目標で閲覧不可。ダッシュボードから監査内容が見えると権限表と矛盾する | PM | M-03（2026-11-27） |
| 2 | [ASSUMPTION] auditor はダッシュボード対象外のため、ログイン後のホームを `/audit` とする | 画面権限表で S01 の auditor は「—」。ログイン後の既定遷移先が `/` のため遷移先の決定が必要 | PM | M-03（2026-11-27） |
| 3 | [ASSUMPTION] 4a・4b は共通エンジンで都度算出し、その他の件数は SQL 集計関数で算出する。マテリアライズドビュー（5 分更新）は負荷試験で p95 を満たせない場合のみ導入 | 画面仕様は「集計関数またはマテリアライズドビュー」とし、同時に「一覧と常に一致」を求めている。5 分遅延は一致性と両立しない | テックリード | M-03（2026-11-27） |
| 4 | NFR-PERF-01 の 80 ユーザー測定環境がない（ADR-006 でローカルのみ） | DoD 冒頭の未決事項（D-010 と ADR-006 の矛盾） | PM／お客様 | M-03（2026-11-27） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-08-S01）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-009, D-010, D-014, D-019）
- 画面仕様：[scr-01-dashboard.md](../../../docs/03-detail-design/scr-01-dashboard.md)
- 共通画面ルール：[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API：[api-specification.md（A02）](../../../docs/03-detail-design/api-specification.md)
- 画面一覧・権限：[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)
- 非機能への対応 §2.9：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)
- ワイヤーフレーム：[wireframe-01-layout-login-dashboard.md（WF-01）](../../../docs/02-wireframes/wireframe-01-layout-login-dashboard.md)
- ADR：[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)
- 関連要件：SCR-01（F09）、US-02、FR-OUT-02、FR-INV-05、NFR-PERF-01、NFR-SEC-02、NFR-LOC-01、NFR-ACC-01
- 関連機能ID：SCR-01（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
