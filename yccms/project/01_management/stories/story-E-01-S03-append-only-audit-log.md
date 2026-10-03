# E-01-S03: 追記専用（append-only）監査ログ

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-01-S03 |
| ストーリー名 | Audit log append-only（和訳：追記専用（append-only）監査ログ） |
| 関連Epic | E-01（ログイン・権限・監査 ＝ F11 の機能部分） |
| 関連機能ID | SCR-34, FE-43 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

監査担当（auditor）・管理者（manager / qa / admin）として、業務データと設定の変更について「誰が・いつ・何を・どう変えたか」を改ざんできない形で一覧・絞り込みしたい。なぜなら、期限・温度・日付逆転の判断根拠を後から説明できることが RFP の監査要件（NFR-AUD-01）であり、記録そのものが書き換えられては証拠にならないからだ。

## 3. 背景・目的

- RFP は状態・マスタ・承認・エクスポート・認証のイベントを追記専用で残すことを求める（NFR-AUD-01）。保管期間は 3 年（DR-RET-01）。
- プロトタイプでは次の穴が残っていた（設計書の差分）。
  - D-22：`profiles` を持つ全員がポリシー `audit_insert` で任意の `action`・`detail` の行を挿入できた（実行者だけは正しく刻印される）。
  - D-17：`authenticated` からの UPDATE/DELETE は剥奪済みだが、owner / service ロールは書き換えられた。
  - D-20：パーティションなし。3 年分で検索と期間削除が遅くなる。
  - ログイン・エクスポートのイベントを記録していなかった。
- `audit_logs` は後続の全ストーリー（マスタ変更、変更申請、入荷、出荷、例外承認、隔離）が書き込む共通基盤であり、S1 で先に作る必要がある（E-02-S03 が本ストーリーに依存）。

## 4. 対象ユーザー

| ロールコード | 監査ログ画面 SCR-34 | 備考 |
| --- | --- | --- |
| auditor（監査・閲覧のみ） | 閲覧可 | 主な利用者。書き込み操作は一切なし |
| manager（倉庫管理者） | 閲覧可 | 設定変更・承認の確認 |
| qa（品質管理） | 閲覧可 | 隔離判断などの確認 |
| admin（システム管理） | 閲覧可 | 運用・調査 |
| warehouse（倉庫作業者） | 閲覧不可（対象システム） | プロトタイプでは閲覧可だった |
| sales（営業・CS） | 閲覧不可 | 権限マトリクス §3.3 |

全ロールとも、監査ログを直接書き込む・修正・削除する手段は持たない。記録は DB の関数とトリガーだけが行う。

## 5. スコープ

**スコープ内**
- テーブル `audit_logs`（`id bigint`、`actor_id` → `app_users`（NULL ＝ system）、`actor_email`（スナップショット）、`action`、`entity`、`entity_id`、`detail jsonb`、`created_at`）を `created_at` で月次パーティション化して作成する。[ASSUMPTION] パーティションはマイグレーションで先行作成し、自動作成はインフラ作業（P-INFRA）で扱う。
- 追記専用の保証：`authenticated` / `anon` の INSERT・UPDATE・DELETE・TRUNCATE を剥奪（D-22 を作らない）、全ロール対象の `BEFORE UPDATE OR DELETE` トリガー `forbid_update_delete`（D-17 を作らない）。
- 書き込み経路：`SECURITY DEFINER` 関数と、トリガー `stamp_actor`（`auth.uid()` から実行者を刻印）・汎用トリガー `audit_config_change`（変更前 `before` / 変更後 `after`、`updated_at` は除外）を用意し、後続ストーリーがテーブルに付けるだけで記録できるようにする。業務処理と同一トランザクションで記録し、処理がロールバックすれば監査もロールバックされる。
- 認証イベント `auth.login` / `auth.logout` / `auth.failed` の記録（NFR-AUD-01、`scr-00-login.md` §7）。[ASSUMPTION] 取得方式（Supabase Auth Hook か Auth ログの取り込みか）は S1 開始時に決める。
- 監査ログ画面 SCR-34（`/audit`）と `GET /api/audit`：新しい順、`action` の前方一致タブ（すべて・inbound・outbound・override・quarantine・customer_sku_agreements・temperature_zones・products・seed、[ASSUMPTION] 追加で change・auth）に加え、対象システム仕様の実行者・期間・対象での絞り込みとページング（[ASSUMPTION] クエリ名 `actor`・`from`・`to`・`entity`・`page`、1 ページ 50 件）。
- 閲覧をロール（manager / qa / admin / auditor）に限定（RLS と BFF の両方）。

**スコープ外**
- 監査ログの CSV/PDF エクスポートとマニフェスト（SHA-256）→ E-08-S03（SCR-31、IF-ARCH-01）。エクスポートイベント `export.*` の記録もそちらで実装する。
- 保管期間経過分の削除ジョブ（パーティション DETACH）→ 運用（P-INFRA / DR-RET-01）。
- 各業務処理の監査行そのもの（`inbound.confirm`、`outbound.ship` など）→ 各機能ストーリーで記録する。本ストーリーは共通の仕組みまで。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. manager が設定を変更する（例：後続ストーリーの変更申請承認）。
2. 同じトランザクション内で、関数またはトリガーが `audit_logs` に 1 行書く。`actor_id`・`actor_email` は `stamp_actor` が JWT から刻印し、クライアントは実行者を送らない。
3. auditor が `/audit` を開くと `GET /api/audit` が呼ばれ、新しい順に表示される（日時は JST の `yyyy/mm/dd HH:mm`）。
4. auditor がタブ「customer_sku_agreements」を押すと `GET /api/audit?action=customer_sku_agreements` で前方一致の絞り込みがかかる。さらに実行者・期間・対象で絞り込み、ページを送る。
5. 各行で「日時・実行者（なければ「—」、シードは `system`）・アクション・対象（`entity`＋`entity_id` 先頭 8 文字）・詳細（JSON、セル内で横スクロール）」を確認する。
6. 利用者のログイン・ログアウト・ログイン失敗が `auth.*` として記録され、同じ画面で確認できる。

**代替・例外フロー**
- 該当なし：「記録がありません。」を灰色で表示。
- 存在しない `action` 接頭辞：空の一覧（エラーにしない）。
- 期間指定の日付が不正：400「日付フィルタが不正です」。
- warehouse / sales が `/audit` を開く、または API を呼ぶ：403「この操作を行う権限がありません。」。メニューにも出さない。
- 未ログイン：401 → `/login?next=/audit`。
- DB 接続不可：503（再試行ボタン付きの赤枠）。
- `authenticated` が PostgREST で `audit_logs` に直接 INSERT / UPDATE / DELETE：`42501` で拒否。
- owner / service ロールでも UPDATE / DELETE：トリガーが例外を送出して拒否。
- 業務処理が途中で失敗：処理と一緒に監査行もロールバックされ、「幽霊」監査は残らない。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 日時 | `audit_logs.created_at` | 表示のみ | JST 表示、新しい順。パーティションキー |
| 実行者 | `audit_logs.actor_email`（`actor_id` → `app_users.id`） | 表示のみ | `stamp_actor` が刻印。NULL は「—」、シードは `system` |
| アクション | `audit_logs.action` | 表示のみ | 例：`products.update`、`change.approve`、`auth.login` |
| 対象 | `audit_logs.entity`・`audit_logs.entity_id` | 表示のみ | ID は先頭 8 文字 |
| 詳細 | `audit_logs.detail` | 表示のみ | 設定変更は `before` / `after` |
| 絞り込み：アクション接頭辞 | 画面入力 → `GET /api/audit?action=` | 編集可（入力） | 前方一致 |
| 絞り込み：実行者・期間・対象・ページ | 画面入力 → `GET /api/audit` のクエリ | 編集可（入力） | 期間は JST の日付 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR：NFR-AUD-01（追記専用・認証イベント）、NFR-SEC-02（閲覧を最小権限に）、NFR-PERF-01（閲覧 p95 ≤ 2 秒）、NFR-LOC-01（JST 表示、内部は ISO 8601 / `timestamptz`）、DR-RET-01（3 年保管）。
- ADR-001：書き込みは `SECURITY DEFINER` 関数とトリガーのみ。関数は `search_path = public, pg_temp` 固定、内部ヘルパーには execute を付与しない。
- 設計原則 P4（不変テーブルは権限とトリガーの両方で UPDATE/DELETE を防ぐ）、P5（`actor_id` は `app_users` への FK、`audit_logs` だけがメールのスナップショットを持つ）、P8（`timestamptz`）。
- ADR-006：ローカル実行のみ。Supabase Auth の認証イベントの取得方法はローカルの GoTrue で確認できる方式に限る。
- 3 年分のデータ量に備え、`created_at` 降順と絞り込み列にインデックスを張る。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] `authenticated` から `audit_logs` への INSERT・UPDATE・DELETE・TRUNCATE がすべて `42501` で失敗する（ポリシー `audit_insert` 相当の経路が存在しない）（pgTAP、D-011）。
- [ ] owner ロールで `audit_logs` の行を UPDATE / DELETE するとトリガーが例外を送出する（pgTAP、D-011）。
- [ ] Given 設定テーブルに `audit_config_change` を付けた状態、When manager が 1 列を更新する、Then `before` / `after` を持つ 1 行が記録され、`actor_id` はクライアントが何を送っても `auth.uid()` になる（pgTAP、D-011）。
- [ ] 業務関数が途中で例外を出したとき、その関数が書いた監査行も残らない（pgTAP、D-011）。
- [ ] ログイン成功・ログアウト・ログイン失敗がそれぞれ `auth.login` / `auth.logout` / `auth.failed` として記録される（E2E または pgTAP、D-011）。
- [ ] auditor・manager・qa・admin は `/audit` を閲覧でき、warehouse・sales は画面・API とも 403 になる（pgTAP＋E2E、D-011）。
- [ ] タブ「products」で `products.` で始まる行だけが新しい順に表示され、期間指定は JST の 00:00〜23:59:59 で判定される（E2E、D-001・D-014）。
- [ ] `audit_logs` が月次パーティションになっており、開発期間〜本番開始以降のパーティションが用意されている（pgTAP またはマイグレーションのレビュー、D-010・D-015）。
- [ ] SCR-34 の文言が日本語（[ASSUMPTION] 設計書からの仮訳）で、`05-database/03-implementation-status.md`・`scr-34-audit-log.md` の差分表・`project-changelog.md` を更新している（レビュー、D-014・D-015）。
- [ ] `npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` がすべて成功する（D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 認証イベントの取得方式（Supabase Auth Hook か、Auth のログ読み取りか）は S1 開始時にテックリードが決める。ログイン失敗はフックで取れない可能性があり、その場合は Auth ログからの取り込みとする | 設計書は「Supabase の auth hook を使うか Auth ログを読む」とだけ記載 | テックリード | S1 開始（2026-11-30） |
| 2 | [ASSUMPTION] 拡張絞り込みのクエリ名を `actor`・`from`・`to`・`entity`・`page` とし、1 ページ 50 件とする | 設計書は「実行者・期間・対象で絞り込み、ページング」とだけ記載し、API 仕様（A21）は `action` のみ | テックリード | S1 開始（2026-11-30） |
| 3 | [ASSUMPTION] 月次パーティションはマイグレーションで先行作成し、以降の自動作成はインフラ作業（P-INFRA）で扱う | 設計書はパーティション化のみ記載し、作成方式は未定義 | テックリード | S1 開始（2026-11-30） |
| 4 | [ASSUMPTION] 変更申請（E-02-S03）のアクション `change.request` / `change.approve` / `change.reject` 用にタブ「change」を追加し、認証イベント用にタブ「auth」を追加する | ADR-004 が `change.*`、SCR-00 対象仕様が `auth.*` を定義。SCR-34 のタブ一覧には未記載 | テックリード | S1 開始（2026-11-30） |
| 5 | 未決：auditor ロールを付与する人（内部監査の担当者・人数）と、外部監査人へのアクセス可否 | RFP 上のロール一覧で人数が「—」 | お客様 | M-02（2026-10-30） |
| 6 | [ASSUMPTION] 画面文言は設計書（ベトナム語）の和訳を仮文言として使い、最終文言は E-13-S01 で確定する | NFR-LOC-01。確定文言なし | PM / お客様 | M-03（2026-11-27） |
| 7 | 規模：パーティション・不変化トリガー・認証イベント・画面拡張を 1 スプリントで行うため重め。溢れる場合は認証イベントを次スプリントへ回すかを PM が判断する（ID・名称は変更しない） | S1 には他に 6 ストーリーがある | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-01-S03 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-010、D-011、D-014、D-015、D-019）
- 関連機能ID：SCR-34、FE-43（`function-list.md` は未作成のため暫定キー）
- 関連 NFR：NFR-AUD-01、NFR-SEC-02、NFR-PERF-01、NFR-LOC-01、DR-RET-01
- 詳細設計：[scr-34-audit-log.md](../../../docs/03-detail-design/scr-34-audit-log.md)、[scr-00-login.md](../../../docs/03-detail-design/scr-00-login.md)（§7 認証イベント）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)（§7 自動監査）、[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A21）
- ワイヤーフレーム：[wireframe-04-master-trace-audit.md](../../../docs/02-wireframes/wireframe-04-master-trace-audit.md)（WF-13）
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.5、§5）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-17、D-20、D-22）
- ADR：[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)（`change.*`）、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
