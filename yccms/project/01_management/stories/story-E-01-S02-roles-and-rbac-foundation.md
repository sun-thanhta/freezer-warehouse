# E-01-S02: ロール・RBAC 基盤

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-01-S02 |
| ストーリー名 | Vai trò & RBAC nền (`app_users`, `roles`, `user_roles`; nền đã có ở P0)（和訳：ロール・RBAC 基盤（`app_users`・`roles`・`user_roles`。基盤は P0 で構築済み）） |
| 関連Epic | E-01（ログイン・権限・監査 ＝ F11 の機能部分） |
| 関連機能ID | FE-43 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

システム管理者（admin）として、利用者ごとに業務上必要な最小限のロールだけを付与し、その範囲外の画面・操作を UI・API・DB のすべての層で拒否させたい。なぜなら、作業者が自分で管理者権限に昇格して自分の例外申請を承認するといった不正を構造的に防ぐことが RFP の要件（NFR-SEC-02）だからだ。

## 3. 背景・目的

- プロトタイプは `profiles.role` に warehouse / manager の 2 値しか持てず、QA・営業・管理者・監査を表現できなかった（設計書の差分 D-01、D-02）。また初回レビューで「作業者が `profiles` を直接更新して manager になり、自分の例外を承認できる」脆弱性が再現された（ADR-001）。
- 対象設計は `app_users`（`auth.users` への FK、`on delete restrict`、`is_active` で無効化）＋ `roles`（8 ロール固定）＋ `user_roles`（多対多、`granted_by`・`granted_at`）で、`has_role(code)` が `app_role()` を置き換える（ER §4.1）。
- P0（2026-10-03）で次は実装済み：上記 3 テーブル、`current_user_roles()`・`has_role(text)`・`is_provisioned()`（すべて `SECURITY DEFINER`、`search_path` 固定）、RLS（`anon` は権限なし、`authenticated` は `select` のみ、本人または admin のみ閲覧）、`withAuth()` の 403 判定、`requireRole()`、`/api/me` がロール配列を返す、開発用アカウント作成スクリプト、pgTAP 9 件（自己昇格不可・直接更新不可など）。
- 残っているのは、画面×ロールの権限マトリクス（`03-screen-list-navigation-and-permissions.md` §3.3）を、後続の全ストーリーが同じ方法で使える「共通の仕組み」として整えることである。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの扱い |
| --- | --- |
| admin（システム管理） | 全利用者のユーザー情報・ロールを閲覧できる。ロール付与は当面スクリプト（SCR-33 は未計画） |
| warehouse（倉庫作業者） | 自分のユーザー情報・ロールのみ閲覧。管理系操作は UI で無効化・API で 403 |
| manager（倉庫管理者） | 同上。他人の例外承認・設定変更申請など manager 権限の操作が可能 |
| qa（品質管理） | 同上。隔離の release/scrap、SKU 設定の変更申請など |
| sales（営業・CS） | 同上。閲覧中心＋納品期限の変更申請 |
| auditor（監査・閲覧のみ） | 同上。監査ログなどの閲覧のみ、書き込みは一切不可 |
| driver / dispatcher | ロールとしては登録済みだが、F06 / POD 未設計のため権限は割り当てない |

1 人が複数のロールを持てる（例：開発用アカウント `quanly@yccms.local` は warehouse＋manager）。[ASSUMPTION] 複数ロールの権限は和集合（いずれかのロールで許可されていれば許可）とする。

## 5. スコープ

**スコープ内**
- [ASSUMPTION] 権限マトリクス §3.3（画面・操作 × ロール：R 閲覧／W 書き込み／A 承認）を TypeScript の単一定義にし、BFF のロールチェック（`requireRole`）と UI の表示制御（ボタンの非表示・無効化、メニュー）が同じ定義を参照する。
- 画面側で現在ユーザーのロールを取得する共通フック（`/api/me` の `roles` を利用）と、権限がない画面を開いたときの共通表示（403 の赤枠）。
- DB 側：後続テーブルの RLS で使う方針を確定する（閲覧は `is_provisioned()`、ロール限定の閲覧・書き込みは `has_role()`、書き込みは原則 `SECURITY DEFINER` 関数経由のみ）。ポリシーの書き方の雛形と pgTAP の雛形を用意する。
- 無効化（`is_active=false`）されたユーザーは即座に全 API が 403 になり、`current_user_roles()` が空配列を返すこと。
- `app_users` の行削除を許さない（`on delete restrict`）ことの確認。
- [ASSUMPTION] ロール由来の 403 メッセージの日本語化（設計書からの仮訳）：「この操作を行う権限がありません。」

**スコープ外**
- ユーザー管理画面 SCR-33（一覧・作成・ロール付与・無効化）→ スケジュール上に該当ストーリーなし（§10 で確認）。当面は `scripts/create-dev-users.mjs`（ローカル URL 以外では実行を拒否）で発行する。
- SSO・MFA → E-01-S04。
- 各画面固有のロール制御の実装（例：S13 監査ログの閲覧制限は E-01-S03、隔離の release/scrap は E-04-S04）。本ストーリーは共通の仕組みと定義まで。
- [ASSUMPTION] ロール付与・剥奪の監査記録 → `audit_logs` 作成後（E-01-S03）に接続。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. admin がスクリプトで利用者を作成し、`app_users` 1 行と `user_roles` に必要なロールを登録する（例：佐藤 = warehouse）。
2. 利用者がログインすると、`withAuth()` が `app_users`（`is_active`）と `current_user_roles()` を読み、`profile.roles` を作る。
3. 画面は `/api/me` からロールを受け取り、権限マトリクスに従ってメニュー・ボタンを出し分ける（warehouse には設定画面の入力欄が `disabled`）。
4. API は書き込み系で `requireRole(auth, 'manager', …)` を呼び、許可ロールを持たなければ 403 を返す。
5. DB は RLS と関数内の `has_role()` で最終判断する。UI・BFF を経由せず PostgREST を直接叩いても突破できない。

**代替・例外フロー**
- 未ログイン：401「ログインしていません」。
- ユーザー情報なし・無効化・ロールなし：403「アカウントに権限が付与されていません（ユーザー情報なし・無効化・ロール未設定）。」
- ロールが足りない操作を API で直接実行：403「この操作を行う権限がありません。」。画面は入力内容を保持したまま赤枠で表示する。
- PostgREST を直接叩いて `user_roles` に自分の admin 行を追加しようとする：権限エラー（SQLSTATE `42501`）で拒否。
- `app_users` を直接更新・削除しようとする：`42501` で拒否。`auth.users` 側の削除も FK（`restrict`）で拒否。
- 無効化された利用者が操作中：次の API 呼び出しから 403。
- DB 接続不可：503。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 利用者 ID | `app_users.id`（＝`auth.users.id`） | 表示なし | FK `on delete restrict` |
| メール | `app_users.email` | 表示のみ | 一意 |
| 氏名 | `app_users.full_name` | 表示のみ | ヘッダーに表示 |
| 有効フラグ | `app_users.is_active` | 表示なし（スクリプトで変更） | 削除ではなく無効化 |
| ロールマスタ | `roles.code`・`roles.name` | 表示のみ | 8 行固定（マイグレーションで投入） |
| 付与ロール | `user_roles.role_code` | 表示のみ（スクリプトで変更） | 複数可 |
| 付与者・付与日時 | `user_roles.granted_by`・`user_roles.granted_at` | 表示なし | 監査用 |
| 現在ロール | `current_user_roles()` | 表示のみ | 無効・未登録なら空配列 |
| 権限マトリクス | コード上の定義（§3.3 を転記） | 表示なし | UI と BFF が共通参照 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR：NFR-SEC-02（RBAC 最小権限＋メーカー・チェッカー分離）、NFR-SEC-03（サービスロールキーをアプリで使わない）、NFR-AUD-01（ロール変更は監査対象。E-01-S03 で接続）。
- ADR-001：RLS は拒否が既定。`authenticated` の insert/update/delete/truncate は全テーブルで剥奪し、書き込みは `SECURITY DEFINER` 関数（`search_path = public, pg_temp`）のみ。関数は自分で `auth.uid()`・ユーザー情報・ロールを確認する。
- ADR-002：権限判定の最終責任は DB。UI はあくまで誤操作防止。
- ADR-006：ローカル実行のみ。アカウント作成スクリプトはローカル URL 以外では動かない。
- 設計原則 P5：実行者を記録する列はすべて `app_users` への FK にする（後続テーブルで遵守）。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] 権限マトリクス §3.3 の全行（S01〜S13 の閲覧・書き込み・承認）が単一の定義にあり、その定義と §3.3 の対応を確認する単体テストがある（単体、D-001・D-011）。
- [ ] Given warehouse のみのユーザー、When manager 限定の API を呼ぶ、Then 403「この操作を行う権限がありません。」が返る。Given warehouse＋manager のユーザー、Then 同じ API が許可される（単体＋E2E、D-011）。
- [ ] `anon` は `app_users`・`user_roles`・`roles` を読めない。warehouse は自分の行だけ読め、admin は全員を読める（pgTAP、D-011）。
- [ ] `authenticated` が `user_roles` に自分の admin 行を insert しようとすると `42501` で失敗する。`app_users` の update/delete も `42501` で失敗する（pgTAP、D-011）。
- [ ] Given `is_active=false` のユーザー、Then `current_user_roles()` は空配列、`is_provisioned()` は false、全業務 API は 403 になる（pgTAP＋E2E、D-011）。
- [ ] `auth.users` から `app_users` に紐づく行を削除しようとすると FK 違反で失敗する（pgTAP、D-011）。
- [ ] warehouse でログインすると、manager 用の操作ボタン（例：設定変更・承認）が非表示または `disabled` になる（E2E、D-001）。
- [ ] 後続ストーリー向けの RLS ポリシー雛形と pgTAP 雛形が `yccms/supabase/tests/` 配下にあり、`05-database/03-implementation-status.md` と `code-standards.md` に使い方が記載されている（レビュー、D-015）。
- [ ] `npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` がすべて成功する（D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 権限マトリクスは TypeScript の単一定義（UI・BFF 共通）と SQL のポリシー／関数内チェックの二重実装とし、両者の一致を単体テストと pgTAP で担保する | ADR-001 が「ルールは TS と SQL の 2 か所に書き、両方テストする」方針。マトリクスの実装形式は設計書に記載なし | テックリード | S1 開始（2026-11-30） |
| 2 | [ASSUMPTION] 複数ロール保持時の権限は和集合（いずれかのロールで許可されていれば許可）とする | 設計書は「1 人が複数ロールを持てる」とだけ記載し、合成規則は未定義 | テックリード / PM | S1 開始（2026-11-30） |
| 3 | 未決：ユーザー管理画面 SCR-33（RFP 画面一覧 P0）に対応するストーリーがスケジュールにない。追加するか、スクリプト運用を継続するか | `03-implementation-status.md` は「ビルドでユーザー管理関数（SCR-33）を追加」と記載するが WBS に行なし | PM | M-03（2026-11-27） |
| 4 | 未決：driver / dispatcher の権限範囲（F06・POD はアーキテクチャ設計のみ） | `01-system-overview-and-scope.md` §1.2 で範囲外と明記 | PM / お客様 | F06 詳細設計時（M-03 前） |
| 5 | [ASSUMPTION] ロール付与・剥奪の監査記録は E-01-S03 完了後に接続する（本ストーリーでは記録しない） | `audit_logs` は E-01-S03 で作成され、依存は S02 → S03 の順 | テックリード | S1 開始（2026-11-30） |
| 6 | [ASSUMPTION] 403 などのメッセージは設計書（ベトナム語）の和訳を仮文言として使い、最終文言は E-13-S01 で確定する | NFR-LOC-01 は日本語 UI を要求。確定文言なし | PM / お客様 | M-03（2026-11-27） |
| 7 | 規模：テーブル・関数・基本 RLS は P0 で実装済み。残りは共通定義と雛形で、1 スプリントに収まる（INVEST 適合） | §3 の既存実装一覧 | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-01-S02 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-011、D-015、D-019）
- 関連機能ID：FE-43（`function-list.md` は未作成のため、RFP の機能コードを暫定キーとして使用）
- 関連 NFR：NFR-SEC-02、NFR-SEC-03、NFR-AUD-01
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.2 ロール）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3 権限マトリクス、§3.4 実施箇所）、[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.5）
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.1）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-01〜D-04）、[03-implementation-status.md](../../../docs/05-database/03-implementation-status.md)
- ADR：[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- 既存コード：[20261003060000_identity_and_roles.sql](../../../supabase/migrations/20261003060000_identity_and_roles.sql)、[identity_rls_test.sql](../../../supabase/tests/identity_rls_test.sql)、[api-route-helpers.ts](../../../src/lib/api/api-route-helpers.ts)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
