# E-01-S01: ログイン・アクセスゲート

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-01-S01 |
| ストーリー名 | Đăng nhập & cổng truy cập (nền đã dựng ở P0 ngày 2026-10-03; S1 hoàn thiện theo đặc tả)（和訳：ログイン・アクセスゲート（基盤は P0 で 2026-10-03 に構築済み、S1 で設計書どおりに仕上げる）） |
| 関連Epic | E-01（ログイン・権限・監査 ＝ F11 の機能部分） |
| 関連機能ID | SCR-00 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者・管理者などの社内利用者（warehouse / manager / qa / sales / admin / auditor）として、自分のアカウントでログインしてから業務画面に入りたい。なぜなら、ログインしていない第三者に在庫・出荷・監査の内容を一切見せないことが RFP の前提（NFR-SEC-01）だからだ。

## 3. 背景・目的

- YCCMS は期限・温度・日付逆転など、誤ると法的・商取引上の影響が出る情報を扱う。設計書では「部外者は内容を見られない」ことを最初の防御層（L1 ページゲート・L2 API ゲート）としている（`02-architecture-and-data-flow.md` §2.5）。
- P0（2026-10-03）で次の基盤はすでに動いている。
  - `src/proxy.ts`：`/login` 以外の全ページを、セッションがなければ `307 → /login?next=<パス>` に送る。ログイン済みで `/login` を開くと `/` に戻す。Supabase 未設定は `?error=config`、接続不可は `?error=db`。
  - `src/lib/auth/safe-next-path.ts`：`?next=` は `/` で始まり `//`・`/\`・制御文字を含まないパスのみ許可（オープンリダイレクト防止）。単体テストあり。
  - `src/lib/api/api-route-helpers.ts` の `withAuth()`：セッションなし → 401、`app_users` なし・無効化・ロールなし → 403、DB 接続不可 → 503。
  - ログインフォーム（メール＋パスワード、`autocomplete`、送信中はボタンを無効化）、ヘッダーのログアウト、`/api/me`、`/api/health`、`supabase/config.toml` の `enable_signup = false`、E2E `e2e/login-gate.spec.ts`（3 ケース）。
- 本ストーリーの目的は、この基盤を詳細設計 `scr-00-login.md` と共通ルール `00-common-screen-rules.md` の「対象システム」側の仕様まで仕上げることである。

## 4. 対象ユーザー

> `role-list.md` は未作成のため、設計書と `20261003060000_identity_and_roles.sql` のロールコードを使う。

| ロールコード | 利用のしかた | 差異 |
| --- | --- | --- |
| warehouse（倉庫作業者） | ログインして入荷・出荷業務へ | なし（全員同じログイン画面） |
| manager（倉庫管理者） | 同上 | 対象システムでは MFA 必須（E-01-S04 で対応） |
| qa（品質管理） | 同上 | 同上（MFA 必須） |
| sales（営業・CS） | 同上 | なし |
| admin（システム管理） | 同上 | MFA 必須（E-01-S04） |
| auditor（監査・閲覧のみ） | 同上 | なし |
| driver / dispatcher | 本ストーリー対象外（F06 / POD はアーキテクチャ設計のみ） | — |

アカウントは admin が発行する。自己登録はできない。

## 5. スコープ

**スコープ内**
- [ASSUMPTION] ログイン画面 SCR-00 の文言を日本語化（文言は設計書からの仮訳。タイトル・項目名「メールアドレス」「パスワード」・ボタン「ログイン」・送信中「ログイン中…」・エラー文言）。
- `?next=` でパスだけでなくクエリも保持する（`/inventory?view=quarantine` → ログイン後も同じ URL）。`proxy.ts` と、401 時のクライアント側リダイレクト（`use-api.ts`）の両方を対象とする。
- ログイン成功後にユーザー情報（`app_users` の有無・`is_active`・ロール）を確認し、権限が付与されていない利用者には空のページではなく「権限が付与されていません」専用画面を出す（`scr-00-login.md` §7）。[ASSUMPTION] 専用画面は業務レイアウト外の固定パスに置き、ログアウトボタンだけを持つ。
- 共通エラーハンドリングの整備：API が 401 → `/login?next=<現在のページ>`、503 → 「システムに接続できません」案内（`00-common-screen-rules.md` §5）。
- ログアウト後は `/login` に戻り、戻るボタンで業務画面が見えないこと。
- 自己登録が無効であることの確認手順を開発手順書に残す（`enable_signup = false`）。

**スコープ外**
- SSO（OIDC/SAML）と MFA → E-01-S04（IF-IDP-01 待ち）。
- [ASSUMPTION] ログイン・ログアウト・ログイン失敗の監査イベント（`auth.login` / `auth.logout` / `auth.failed`）→ E-01-S03。
- ロール別の画面・操作制御 → E-01-S02。
- アプリ側のログイン試行回数制限（設計どおり Supabase Auth 標準のレート制限に任せる）。
- 全画面の i18n 基盤と WCAG 2.2 AA 監査 → E-13-S01。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. 未ログインの利用者が任意の URL（例：`/inventory?view=quarantine`）を開く。
2. `proxy.ts` が `307 → /login?next=%2Finventory%3Fview%3Dquarantine` を返す（`next` が `/` のときは付けない）。
3. 利用者がメールアドレスとパスワードを入力し「ログイン」を押す。ボタンは「ログイン中…」になり無効化される。
4. Supabase Auth `signInWithPassword` が成功する。
5. 画面は `safeNextPath(next)` の結果（この例では `/inventory?view=quarantine`）へ遷移し、`router.refresh()` で新しい Cookie を `proxy.ts` に読ませる。
6. 遷移先が `GET /api/me` を呼び、氏名・メール・ロールを取得してヘッダーに表示する。

**代替・例外フロー**
- 入力漏れ：メール・パスワードが空ならブラウザ標準の必須チェックで送信を止める。
- 認証失敗（`Invalid login credentials`）：「メールアドレスまたはパスワードが正しくありません。」を `role=alert` で表示。入力したメールは残し、送信中状態を解除する。
- その他の Auth エラー：Auth のメッセージをそのまま表示する。
- `?error=config`：「Supabase の設定がありません（環境変数が未設定です）。」
- `?error=db` または Auth に接続できない：「データベースに接続できません。」と復旧手順の案内（[ASSUMPTION] ローカル開発時のみ Docker（Colima）と `npm run db:start` の手順）。
- 不正な `next`（`//evil.com`、`https://…`、`javascript:` など）：`/` に遷移する。
- ログイン済みで `/login` を開く：`307 → /`。
- ログインはできたがユーザー情報がない・無効化・ロールなし：API は 403「アカウントに権限が付与されていません（ユーザー情報なし・無効化・ロール未設定）。」を返し、画面は「権限が付与されていません」専用画面（ログアウトのみ可能）を表示する。
- 業務中にセッションが切れる：API が 401「ログインしていません」→ クライアントは `/login?next=<現在のパスとクエリ>` へ移動する。
- DB に到達できない：API は 503、画面は赤枠で接続不可の案内を出す。DB のエラー本文はクライアントに返さない（500 は「〜に失敗しました。もう一度お試しください。」）。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| メールアドレス | 入力（Supabase Auth `auth.users.email`） | 編集可（入力） | `type=email`、`autocomplete=username`、必須 |
| パスワード | 入力（Supabase Auth） | 編集可（入力） | `type=password`、`autocomplete=current-password`、必須、非表示 |
| 遷移先 | URL `?next=` | 表示なし | `safeNextPath` で検証。パス＋クエリを保持 |
| エラー種別 | URL `?error=config\|db` | 表示のみ | `proxy.ts` が付与 |
| 氏名・メール | `app_users.full_name`・`app_users.email`（`GET /api/me`） | 表示のみ | ヘッダーに表示 |
| ロール | `user_roles.role_code`（`current_user_roles()` 経由） | 表示のみ | 複数可 |
| 有効フラグ | `app_users.is_active` | 表示なし | `false` なら 403 |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR：NFR-SEC-01（認証・SSO/MFA は E-01-S04 で完成）、NFR-SEC-03（秘密情報をソースに置かない。ブラウザに渡すのは公開キーのみ）、NFR-LOC-01（日本語 UI・JST）、NFR-ACC-01（ラベル・フォーカス・エラー通知 `role=alert`）。
- ADR-002：ブラウザから DB を直接読まない。Supabase Auth クライアントはログイン・ログアウトのみに使う。
- ADR-006：当面はローカル実行のみ（Supabase CLI＋Docker、`127.0.0.1` のみで待ち受け）。SSO・SAML などクラウドでしか確認できない項目はこのストーリーでは検証しない。
- Next.js 16：ミドルウェアは `src/proxy.ts`。`matcher` は `api/` を除外し、API は各ルートが自分で 401 を返す。
- ファイルは 200 行未満・kebab-case（`code-standards.md`）。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] Given 未ログイン、When `/inventory?view=quarantine` を開く、Then `307` で `/login?next=%2Finventory%3Fview%3Dquarantine` に送られ、ログイン後に同じパスとクエリへ戻る（E2E、D-001・D-011）。
- [ ] 未ログインで `GET /api/me` を呼ぶと `401` と `{"error": …}` が返る（E2E、D-011）。
- [ ] `safeNextPath` が `//evil.com`・`/\evil.com`・`https://evil.com`・`javascript:alert(1)`・制御文字入りを `/` に置き換え、`/x?y=1` はそのまま返す（単体、D-011）。
- [ ] 誤ったパスワードで「メールアドレスまたはパスワードが正しくありません。」が `role=alert` で表示され、メール欄の値が残り、URL は `/login` のまま（E2E、D-014）。
- [ ] Given Auth ユーザーはあるが `app_users` がない（または `is_active=false`、またはロールなし）、When ログインする、Then 「権限が付与されていません」専用画面が表示され、業務 API はすべて `403` を返す（E2E＋pgTAP `identity_rls_test.sql`、D-011）。
- [ ] ログイン中にセッションを削除してから API を呼ぶと、`/login?next=<元のパスとクエリ>` に移動する（E2E、D-001）。
- [ ] Supabase を停止した状態でページを開くと `/login?error=db` になり接続不可の案内が出る。API は `503` を返し、DB のエラー本文を含まない（E2E または手動確認の記録、D-011）。
- [ ] SCR-00 の表示文言（見出し・項目名・ボタン・エラー）が日本語で、ベトナム語が残っていない。プロトタイプのデモアカウント注記がない（E2E のテキスト検証、D-014）。
- [ ] `npm run typecheck`・`lint`・`test`・`db:test`・`test:e2e`・`build` がすべて成功し、`yccms/docs/` の該当箇所（`scr-00-login.md` §7 プロトタイプ差分表の解消状況）を更新している（D-015・D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 画面文言・エラーメッセージは設計書（ベトナム語）の和訳を仮文言として実装し、最終文言は E-13-S01 で確定する | NFR-LOC-01 は日本語 UI を要求。設計書の文言はベトナム語で、日本語の確定文言がない | PM / お客様 | M-03（2026-11-27） |
| 2 | [ASSUMPTION] 503 の案内は対象システム向け文言（接続不可・メンテナンスの可能性）を基本とし、ローカル開発時のみ Docker 起動手順を併記する | 設計書は「プロトタイプ：Resume project／対象：メンテナンス中」とだけ記載。ADR-006 で当面ローカル実行 | テックリード | S1 開始（2026-11-30） |
| 3 | [ASSUMPTION] ログイン関連の監査イベント（`auth.login` / `auth.logout` / `auth.failed`）は `audit_logs` を作る E-01-S03 で実装し、本ストーリーでは扱わない | `audit_logs` は E-01-S03 で作成。依存関係上 S01 → S02 → S03 の順 | テックリード | S1 開始（2026-11-30） |
| 4 | [ASSUMPTION] 「権限が付与されていません」画面は業務レイアウト外の固定パスに置き、ログアウトボタンだけを持つ | 設計書は「専用画面を出す」とだけ記載し、URL・構成は未定義 | テックリード | S1 開始（2026-11-30） |
| 5 | 未決：SSO/MFA の開始時期は IdP 仕様（IF-IDP-01、質問 Q-03）次第。それまでメール＋パスワード認証で運用してよいか | E-01-S04 は日付 TBD。D-008 も IdP 仕様待ち | お客様 | M-02（2026-10-30） |
| 6 | 規模：基盤は P0 で完成しており残作業は小さい。1 スプリントに十分収まる（INVEST 適合） | §3 の既存実装一覧 | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-01-S01 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-008、D-011、D-014、D-015、D-019）
- 関連機能ID：SCR-00（`function-list.md` は未作成のため、画面コードを暫定キーとして使用）
- 関連 NFR：NFR-SEC-01、NFR-SEC-03、NFR-LOC-01、NFR-ACC-01
- 詳細設計：[scr-00-login.md](../../../docs/03-detail-design/scr-00-login.md)、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)、[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A01）
- 基本設計：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.5 セキュリティ層、§2.6.1、§2.8）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.2）
- ワイヤーフレーム：[wireframe-01-layout-login-dashboard.md](../../../docs/02-wireframes/wireframe-01-layout-login-dashboard.md)（WF-00）
- ADR：[adr-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- 既存コード：[proxy.ts](../../../src/proxy.ts)、[api-route-helpers.ts](../../../src/lib/api/api-route-helpers.ts)、[safe-next-path.ts](../../../src/lib/auth/safe-next-path.ts)、[login-gate.spec.ts](../../../e2e/login-gate.spec.ts)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
