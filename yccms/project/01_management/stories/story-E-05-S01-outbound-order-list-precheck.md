# E-05-S01: 出荷オーダー一覧と除外チェーンによる出荷前事前チェック

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-05-S01 |
| ストーリー名 | Danh sách đơn xuất + kiểm trước theo chuỗi（和訳：出荷オーダー一覧と除外チェーンによる出荷前事前チェック） |
| 関連Epic | E-05（出荷・引当・出荷前検品／F05） |
| 関連機能ID | SCR-12, FE-18（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、出荷待ちオーダーの一覧で各オーダーが「そのまま出荷できるか／どの行が何で止まっているか」を開く前に把握したい。なぜなら、日付逆転・有効ロット不足・納品期限未確定のオーダーを出荷直前に見つけると、配車と積込みが遅れるからだ。

## 3. 背景・目的

- 現状、Yuki では出荷可否を紙と表計算で確認しており、日付逆転（BR-DATE-01）や 消費期限 到来ロットの見落としが重大事故につながる。
- 本ストーリーは、出荷オーダー一覧（SCR-12、URL `/outbound`）に、FR-OUT-02 の除外チェーン（①消費期限 → ②温度帯 → ③隔離 → ④納品期限 → ⑤日付逆転）で事前評価した結果を、オーダー単位のバッジとして表示する。
- 判定ロジックそのものは E-05-S02 の共通ピッキング計画エンジン（`pick-plan-service`）を使い、一覧・引当画面・アラート画面・ダッシュボードの数値が常に一致することを目的とする（SCR-01 設計メモ）。
- これにより、作業者はシフト開始時に「出荷可」「日付逆転で停止」「承認待ち」「業務レビュー待ち」を一目で振り分けられる。

## 4. 対象ユーザー

| ロール | 本ストーリーでの利用 |
| --- | --- |
| warehouse（倉庫作業者） | 主利用者。一覧を見て、処理すべきオーダーを開く |
| manager（倉庫管理者） | warehouse と同じ閲覧。加えて「承認待ち」オーダーを見つけて承認へ進む |
| qa（品質管理） | 閲覧のみ（隔離ロットが原因の除外を確認） |
| sales（営業・CS） | 閲覧のみ（顧客問い合わせ対応） |
| admin（システム管理） | 閲覧のみ |
| auditor（監査） | 閲覧のみ |

権限は画面一覧・権限表（S06/S07 閲覧：全ロール R）に従う。本ストーリーに書込操作はない。

## 5. スコープ

**対象範囲**

- `/outbound` 一覧画面（タブ：出荷待ち〈既定〉／出荷済み）と `GET /api/outbound`（A09）。
- 列：オーダー番号（`/outbound/{id}` へのリンク）、出荷日、顧客（コード＋名称）、行数／合計数量、出荷前チェック。
- 出荷前チェックのバッジ（出荷待ちのみ算出）：
  - 「日付逆転で停止 n 行」赤（`reversalLines`）
  - 「例外承認待ち」紫（`pendingOverride`）
  - 「有効ロット不足 n 行」橙（`shortLines`）
  - 「納品期限未確定の契約 n 件」橙（`reviewLines`。顧客×SKU契約が存在しない行も含む）
  - 「除外ロット n 件」灰（`excludedLots`）
  - 「出荷可」緑（停止・不足の行がなく、承認待ちもない場合）
  - 出荷済みオーダーは「出荷済み」のみ表示
- 並び順：出荷日、オーダー番号。空のとき「オーダーはありません。」を表示。
- 共通画面状態（読込中／エラー＋再試行／空／表示）と日本語・JST 表示。

**対象外**

- 引当計画の算出ロジックと除外チェーンの判定（E-05-S02）。
- 出荷前検品・出荷確定（E-05-S03）、例外申請・承認（E-06-S02）。
- ERP からのオーダー取込とキャンセル連携（E-12-S01、IF-ERP-01 待ち）。
- 配送ルート作成への連携（E-10-S01）。

## 6. 主要業務フロー

**正常フロー**

1. 作業者がサイドメニューから「出荷」を開く（ログイン済み、`app_users` と `user_roles` あり）。
2. 画面が `GET /api/outbound` を呼ぶ。BFF はユーザーの JWT で Supabase を参照し、出荷待ちオーダーについて共通エンジン `buildPickPlans({ openOnly: true })` を実行して行ごとの状態を集計する。
3. 一覧が「出荷待ち」タブで表示され、各オーダーにバッジが付く。例：OUT-261003-03（CUS-003）は「日付逆転で停止 1 行」「納品期限未確定の契約 1 件」「除外ロット 3 件」。
4. 作業者は「出荷可」のオーダーから処理し、停止中のオーダーはオーダー番号から引当画面（SCR-13）を開いて原因を確認する。
5. 「出荷済み」タブに切り替えると、出荷済みオーダーが「出荷済み」バッジ付きで表示される。

**代替・例外フロー**

- 未ログイン／セッション切れ：API が 401 を返し、`/login?next=/outbound` へ遷移する。
- `app_users` またはロール未付与：403「アカウントに権限が付与されていません」を赤枠で表示する。
- DB に接続できない：503。共通ルールに従い「システムメンテナンス中」を表示し、再試行ボタンを出す。
- 出荷待ちオーダーが 0 件：空状態の文言を表示する。
- 顧客×SKU契約がない行：「納品期限未確定の契約」に計上し、バッジで知らせる（出荷確定時に E-05-S03 で 422 となる）。
- [ASSUMPTION] ステータス `cancelled`（ERP 取消、目標設計で追加）のオーダーは「出荷待ち」に出さず、事前チェックの対象外とする。表示方法（別タブ等）は E-12-S01 で確定する。
- [ASSUMPTION] 「出荷済み」タブは件数が増え続けるため、サーバー側で出荷日の期間指定とページングを行う（既定：直近 7 日）。プロトタイプのクライアント側フィルタはそのまま採用しない。

## 7. データ要件

| 項目 | 取得元 | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| オーダー番号 | `outbound_orders.code` | 表示のみ | 引当画面へのリンク |
| 出荷日 | `outbound_orders.ship_date` | 表示のみ | JST の業務日付 |
| ステータス | `outbound_orders.status` | 表示のみ | `open` / `shipped` / `cancelled` |
| 顧客 | `customers.code`, `customers.name` | 表示のみ | |
| 納品先 | `customer_sites.code`, `name`（`outbound_orders.site_id`） | 表示のみ | Q1 の回答次第で表示（§10） |
| 行数／合計数量 | `outbound_lines`（件数、`qty` 合計） | 表示のみ | |
| 日付逆転停止行数 | 共通エンジンの行状態 `date_reversal` の件数 | 表示のみ | E-05-S02 の算出結果 |
| 有効ロット不足行数 | 行状態 `insufficient` の件数 | 表示のみ | |
| 納品期限未確定件数 | `customer_sku_agreements.window_rule IS NULL`（`agreement_at` で有効な版）＋契約なし行 | 表示のみ | 既定値は絶対に当てない |
| 除外ロット件数 | 各行の `suggestion.excluded[]`（最初に該当したチェーン段のみ計上） | 表示のみ | |
| 承認待ち | `override_requests.status = 'pending'` の有無 | 表示のみ | 1 オーダー最大 1 件 |

## 8. 技術的制約・非機能面の考慮

- 構成：画面 → `fetch('/api/outbound')` → Route Handler（BFF、ADR-002）→ ユーザー JWT で Supabase（RLS、ADR-001）。サービスロールキーは使わない。
- 一覧・引当画面・アラート・ダッシュボードは同一の `pick-plan-service` を使い、数値の不一致を作らない。
- NFR-PERF-01：p95 読取 ≤ 2 秒（同時 80 ユーザー）。ピッキング計画は出荷待ちオーダーの SKU に限定してロットを読み、索引 `lots(product_id, expiry_date, received_at)` を使う（N+1 禁止）。
- NFR-LOC-01：画面文言は日本語、日時は JST 表示・ISO 8601 保存。NFR-ACC-01（WCAG 2.2 AA）：バッジは色だけでなく文言で状態を示す。
- NFR-SEC-02：閲覧は RLS（`has_role()`）で制御し、書込 API は持たない。
- ADR-006：開発・テストはローカルの Supabase CLI（Docker、Postgres 17）で行う。80 ユーザーでの性能測定はクラウド環境（P5）まで実施できない。

## 9. 受入基準

- [ ] Given シード（R-06 フィクスチャ）投入済み、When warehouse が `/outbound` を開く、Then 出荷待ちの 5 オーダーが出荷日・オーダー番号順に表示される。（E2E）
- [ ] OUT-261003-03（CUS-003）に「日付逆転で停止 1 行」「納品期限未確定の契約 1 件」（AGR-008 / CHI-004）が表示される。（E2E）
- [ ] OUT-261004-05（CUS-005）は日付逆転の停止がなく、AGR-014 が「納品期限未確定」として計上される（CUS-003 の CHI-002 履歴を借用しない）。（E2E）
- [ ] 一覧の各バッジ件数が、同じオーダーの引当画面（SCR-13）と日付逆転アラート画面（SCR-05）の件数と一致する（同一エンジンを使っていることを API レスポンス比較で確認）。（統合テスト）
- [ ] 例外申請中のオーダーには「例外承認待ち」が付き、「出荷可」は付かない。（E2E）
- [ ] 出荷済みタブでは事前チェックを算出せず「出荷済み」のみ表示する。（E2E）
- [ ] 未ログインで `GET /api/outbound` を呼ぶと 401、ロール未付与ユーザーは 403 となる。（統合テスト、pgTAP で RLS 読取を確認）
- [ ] auditor・sales・qa でも一覧を閲覧でき、書込系のボタンは表示されない。（E2E）
- [ ] DoD D-001（SCR-12 の完成）・D-002（チェーン結果の表示）・D-014（日本語＋JST）に紐づく証跡として、上記テスト結果を残す。

## 10. 前提・未決事項

| # | `[ASSUMPTION]`／未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] `cancelled` オーダーは出荷待ちに出さず事前チェック対象外 | 目標設計で `cancelled` を追加したが、一覧での扱いは仕様に記載なし | テックリード | S3 開始（2027-01-04） |
| 2 | [ASSUMPTION] 出荷済みタブはサーバー側の期間指定＋ページング（既定 直近 7 日） | 月 7,200 出荷行で件数が増え続け、NFR-PERF-01 を守れない | テックリード | M-03（2026-11-27） |
| 3 | 本ストーリーは E-05-S02 の共通エンジンに依存する。同一スプリント内で並行開発するため、ピッキング計画の集計インターフェース（行状態・除外件数）をスプリント計画時に合意する | schedule.md 上の依存は E-02-S04 のみだが、バッジの算出は S02 のエンジンを使う | テックリード | S3 開始（2027-01-04） |
| 4 | Q1：日付逆転の比較単位は顧客か、店舗（納品先）か。店舗単位なら一覧に納品先列を追加 | 基本設計 §1.7 Q1 | お客様 | M-02（2026-10-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-05-S01）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-014, D-019）
- 画面仕様：[scr-12-13-15-outbound-allocation-shipping.md §2](../../../docs/03-detail-design/scr-12-13-15-outbound-allocation-shipping.md)
- 共通画面ルール：[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API：[api-specification.md（A09）](../../../docs/03-detail-design/api-specification.md)
- ワイヤーフレーム：[wireframe-03-outbound-alerts.md（WF-06）](../../../docs/02-wireframes/wireframe-03-outbound-alerts.md)
- 画面一覧・権限：[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)
- 未決事項 Q1：[01-system-overview-and-scope.md §1.7](../../../docs/01-basic-design/01-system-overview-and-scope.md)
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md §4.4](../../../docs/05-database/01-er-diagram-and-table-design.md)
- 関連要件：FR-OUT-02、US-01、NFR-PERF-01、NFR-SEC-02、NFR-LOC-01、NFR-ACC-01
- 関連機能ID：SCR-12、FE-18（function-list.md 未作成のため schedule.md の値を使用）

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
