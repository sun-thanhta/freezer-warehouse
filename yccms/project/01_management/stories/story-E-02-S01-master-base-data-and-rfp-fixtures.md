# E-02-S01: 基礎データ（仕入先・顧客・納品先・ロケーション（-Q））＋ RFP フィクスチャ

## 1. ストーリー情報

| 項目 | 値 |
| --- | --- |
| ストーリーID | E-02-S01 |
| ストーリー名 | Dữ liệu nền: NCC, khách, điểm giao, vị trí (-Q) + fixture RFP (12 SKU, CUS-001…005, AGR-001…015)（和訳：基礎データ：仕入先・顧客・納品先・ロケーション（-Q）＋ RFP フィクスチャ（12 SKU、CUS-001…005、AGR-001…015）） |
| 関連Epic | E-02（マスタ・顧客×SKU契約 ＝ F01） |
| 関連機能ID | FE-03 |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）・倉庫管理者（manager）として、仕入先・顧客・温度帯・ロケーション（隔離用 -Q を含む）・SKU・顧客×SKU 契約の基礎データが RFP どおりの値で最初から揃っていてほしい。なぜなら、入荷検品・在庫・引当・日付逆転の判定はすべてこのマスタを参照しており、マスタが RFP の検証データ（R-06）と食い違うと受け入れ試験の結果も食い違うからだ。

## 3. 背景・目的

- 後続の入荷（E-03）・在庫移動（E-04-S03）・出荷（E-05）は、本ストーリーで作るマスタテーブルを外部キーで参照する。S1 で最初に揃える必要がある。
- RFP の検証データ（フィクスチャ）は次のとおり固定されている（`CLAUDE.md`・`seed-mock-data.sql` 参照）。
  - SKU 12 件：常温 AMB-001〜004、冷蔵 CHI-001〜004、冷凍 FRO-001〜004。法定トレーサビリティはコメ AMB-001（産地・取引）と牛肉 CHI-001（個体識別番号 10 桁）のみ、他は `internal_lot`。
  - 顧客 5 件：CUS-001〜CUS-005。
  - 顧客×SKU 契約 15 件：AGR-001〜AGR-015（`effective_from` = 2026-04-01）。AGR-008（CUS-003 × CHI-004）と AGR-014（CUS-005 × CHI-002）は納品期限が未合意（NULL）で、**既定値を決して自動適用しない**（business-review のまま）。
- 温度帯は 3 つ（常温 ambient・冷蔵 chilled・冷凍 frozen）。しきい値（常温 15〜25°C・冷蔵 0〜5°C・冷凍 ≤ −18°C）は Yuki が自ら公表した値で、バージョン付きで E-04-S01 が管理する。
- 隔離ロケーションは冷蔵 C-Q・冷凍 F-Q のみで、常温には -Q がない。
- プロトタイプとの差分で回避すべき点：D-19（納品先なし）、D-23（仕入先の二重保持は lots 側の話で後続）、`is_active` 列なし。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの扱い |
| --- | --- |
| warehouse（倉庫作業者） | マスタを閲覧（入荷検品の仕入先・SKU・ロケーション選択に使う） |
| manager（倉庫管理者） | 同上 |
| qa（品質管理） | 同上（隔離ロケーションの確認） |
| sales（営業・CS） | 顧客・契約の閲覧 |
| admin（システム管理） | 同上。マスタ保守画面（SCR-04）は本ストーリーでは作らない |
| auditor（監査・閲覧のみ） | 閲覧のみ |

本ストーリーには利用者が操作する画面はなく、データと読み取り API が成果物になる。

## 5. スコープ

**スコープ内**
- テーブル作成（ER §4.2 の対象設計どおり、RLS は拒否が既定・閲覧は `is_provisioned()`）。
  - `suppliers`（`code` 一意、`name`、`is_active`）
  - `customers`（`code` 一意、`name`、`is_active`）
  - `customer_sites`（`customer_id`、`code` 一意、`name`）— Q1 待ちのためテーブルのみ、データなし
  - `temperature_zones`（`id smallint`、`code` ∈ {ambient, chilled, frozen}、`name`）— しきい値は持たない
  - `locations`（`code` 一意、`zone_id`、`is_quarantine`、`is_active`）
  - [ASSUMPTION] `products` の構造列（`sku` 一意、`name`、`unit`、`zone_id`、`trace_lane` ∈ {rice, beef, internal_lot}、`is_active`）と、`customer_sku_agreements`（`code`、`customer_id`、`product_id`、`delivery_term` ∈ {軒先渡し, 車上渡し}、`window_rule` ∈ {ONE_THIRD, ONE_HALF, LABEL_DATE_ONLY, NULL}、`effective_from`、`effective_to`、`approved_by`、一意 (`customer_id`, `product_id`, `effective_from`)・(`code`, `effective_from`)、期間重複を禁じる `EXCLUDE`）もここで作る。期限種別などのバージョン列は E-02-S02、納品期限の変更フローは E-02-S04 が担う。
- `authenticated` には `select` のみ付与（書き込みはマイグレーション・シードと、後続の変更申請関数だけ）。全外部キーの子側にインデックス（設計原則 P7）。
- 参照データ（温度帯 3 行）はマイグレーションに入れ、検証データ（フィクスチャ）は `supabase/seed.sql` に入れる（`seed.sql` 冒頭の方針どおり）。
- フィクスチャ投入：SKU 12 件・顧客 CUS-001〜005・契約 AGR-001〜015（AGR-008 / AGR-014 は `window_rule` NULL）・[ASSUMPTION] 仕入先 SUP-01〜05・ロケーション（A-01-01〜A-03-01、C-01-01〜C-03-01、C-Q-01、F-01-01〜F-04-01、F-Q-01）。
- 読み取り API `GET /api/master`（A03：仕入先・SKU・ロケーション・温度帯）。期限種別・しきい値は担当ストーリーの完了後に応答へ加わる。
- [ASSUMPTION] マスタ変更の監査：E-01-S03 の汎用トリガー `audit_config_change` を本ストーリーのテーブルに付ける（同じスプリント内で E-01-S03 の完了後）。

**スコープ外**
- マスタ保守画面 SCR-04（仕入先・ロケーション・機器の一覧・登録・変更）と契約の新規追加 → スケジュールに該当ストーリーなし（§10）。
- 機器（device）マスタ → ER に未定義。[ASSUMPTION] FE-03 のライフサイクル（created → active → retired）は `is_active` だけで表す。
- 温度帯しきい値のバージョン（`temperature_zone_versions`）→ E-04-S01。
- SKU の期限種別・期限接近しきい値（`product_versions`）と設定画面 → E-02-S02。
- 納品期限の確定・変更 → E-02-S04。
- 納品先単位の日付逆転判定 → Q1 の回答後。

## 6. 主要業務フロー

**正常系（ハッピーパス）**
1. 開発者が `npm run db:reset` を実行する。
2. マイグレーションがマスタテーブル・RLS・権限・温度帯 3 行を作る。
3. `seed.sql` が RFP フィクスチャ（SKU 12、CUS 5、AGR 15、仕入先・ロケーション）を投入する。AGR-008 / AGR-014 の `window_rule` は NULL のまま入る。
4. 開発用アカウント作成スクリプトが続けて実行される。
5. ログインした利用者の画面が `GET /api/master` を呼び、仕入先・SKU・ロケーション・温度帯を受け取る（例：入荷検品で冷蔵 SKU を選ぶと、冷蔵ロケーションと C-Q-01 だけが候補になる）。

**代替・例外フロー**
- 未ログイン：401。ユーザー情報なし・無効化・ロールなし：403。DB 接続不可：503。
- `authenticated` が PostgREST でマスタに INSERT / UPDATE / DELETE：`42501` で拒否。
- 常温に -Q ロケーションを作ろうとする、未定義の温度帯コード、`trace_lane` の不正値、`window_rule` の不正値：CHECK 違反でマイグレーション・シードが失敗する。
- 同じ顧客×SKU で有効期間が重なる契約：`EXCLUDE` 制約違反。
- 契約の NULL を「仮に ONE_THIRD」などで埋める処理：存在してはならない（受け入れ基準で検証）。
- `seed.sql` を本番相当環境で実行しない（フィクスチャは開発・テスト用。ADR-006 によりスクリプトはローカル URL 以外では動かない）。

## 7. データ要件

| 項目 | 取得元 | 表示のみ/編集可 | 備考 |
| --- | --- | --- | --- |
| 仕入先コード・名称・有効 | `suppliers.code`・`name`・`is_active` | 表示のみ | フィクスチャ SUP-01〜05 |
| 顧客コード・名称・有効 | `customers.code`・`name`・`is_active` | 表示のみ | CUS-001〜005 |
| 納品先 | `customer_sites.customer_id`・`code`・`name` | 表示のみ | Q1 待ち、データなし |
| 温度帯 | `temperature_zones.id`・`code`・`name` | 表示のみ | 3 行固定 |
| ロケーション | `locations.code`・`zone_id`・`is_quarantine`・`is_active` | 表示のみ | -Q は冷蔵・冷凍のみ |
| SKU | `products.sku`・`name`・`unit`・`zone_id`・`trace_lane`・`is_active` | 表示のみ | 12 件。期限種別は `product_versions`（E-02-S02） |
| 顧客×SKU 契約 | `customer_sku_agreements.code`・`customer_id`・`product_id`・`delivery_term`・`window_rule`・`effective_from`・`effective_to` | 表示のみ | 15 件。AGR-008 / AGR-014 は `window_rule` NULL |
| 契約承認者 | `customer_sku_agreements.approved_by` → `app_users.id` | 表示のみ | フィクスチャは NULL |

## 8. 技術的制約・非機能面の考慮

- 関連 NFR・データ要件：DR-MST-01（マスタは有効日付管理とメーカー・チェッカー。高リスク設定のみバージョン化し、名称などは監査で足りる＝ADR-004 の不採用案 E）、NFR-SEC-02（書き込み経路を限定）、NFR-AUD-01（マスタ変更の監査）、NFR-PERF-01（引当で多用する外部キーにインデックス）。
- ADR-001：RLS 拒否が既定、`authenticated` は `select` のみ。ADR-004：契約は最初からバージョン行の形（`effective_from` / `effective_to`）で作り、`btree_gist` 拡張を有効化する。
- 設計原則 P1（マスタは数値キー）、P2（業務コードを一意）、P6（固定の小さな値域は CHECK）、P7（子側 FK にインデックス）。
- ADR-006：ローカル実行のみ。`npm run db:reset` でいつでも同じ状態に戻せること（D-016 の「クリーンな環境から再構築できる」に直結）。

## 9. 受入基準

> **このセクションは空にしないこと** — 設計作業と `pm-create-tasks` の基礎になる。

- [ ] `npm run db:reset` 後、SKU 12 件（AMB/CHI/FRO-001〜004）、顧客 5 件（CUS-001〜005）、契約 15 件（AGR-001〜015、`effective_from` = 2026-04-01）が存在する（pgTAP、D-002・D-016）。
- [ ] AGR-008 と AGR-014 の `window_rule` が NULL であり、NULL を既定値で埋める処理がコード・SQL のどこにもない（pgTAP＋コードレビュー、D-002）。
- [ ] `trace_lane` は AMB-001 = rice、CHI-001 = beef、他の 10 件 = internal_lot（pgTAP、D-005）。
- [ ] 隔離ロケーションは冷蔵・冷凍の各温度帯にのみ存在し、常温には存在しない（pgTAP）。
- [ ] 同一顧客×SKU で有効期間が重なる契約を挿入すると `EXCLUDE` 制約で失敗する（pgTAP、D-011）。
- [ ] `anon` はマスタを読めず、ロールのない利用者も読めない。`authenticated` の INSERT / UPDATE / DELETE は `42501` で失敗する（pgTAP、D-011）。
- [ ] Given ログイン済みの warehouse、When `GET /api/master`、Then 仕入先・SKU・ロケーション・温度帯が返る。未ログインは 401（E2E または API テスト、D-001）。
- [ ] 全外部キーの子側にインデックスがある（pgTAP のカタログ検査、D-010）。
- [ ] `05-database/03-implementation-status.md`・`development-roadmap.md`・`project-changelog.md` を更新し、`npm run typecheck`・`lint`・`test`・`db:test`・`build` が成功する（D-015・D-019）。

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] `products` の構造列と `customer_sku_agreements`（バージョン行の形）は本ストーリーで作り、フィクスチャ 12 SKU・15 契約もここで投入する。期限種別のバージョンは E-02-S02、納品期限の変更フローは E-02-S04 が担う | ストーリー名が 12 SKU・AGR-001〜015 のフィクスチャを含み、E-03・E-04-S03 が本ストーリーだけに依存している。一方 E-02-S02 / E-02-S04 にも同じテーブルが関係するため境界を明記 | テックリード | S1 開始（2026-11-30） |
| 2 | [ASSUMPTION] 仕入先 SUP-01〜05 とロケーション一覧はプロトタイプのシード値を流用する | RFP フィクスチャは SKU・顧客・契約のみ定義。仕入先・ロケーションの公式データなし | PM / お客様 | M-03（2026-11-27） |
| 3 | 未決 Q1：日付逆転を顧客単位で判定するか、店舗（納品先）単位か。回答までは `customer_sites` をテーブルのみ作りデータを入れない | `01-system-overview-and-scope.md` §1.7 Q1 | お客様 | M-02（2026-10-30） |
| 4 | 未決 Q5：AGR-008 / AGR-014 の納品期限を誰がいつ確定するか。本ストーリーでは NULL のまま投入する | §1.7 Q5、`CLAUDE.md` の業務上の注意 3 | お客様 | M-02（2026-10-30） |
| 5 | [ASSUMPTION] FE-03 のライフサイクル（created → active → retired）は、対象設計どおり `is_active` だけで表す。機器マスタは扱わない | RFP の FE-03 はライフサイクルと機器を含むが、ER は `is_active` のみで機器テーブルなし | PM / お客様 | M-03（2026-11-27） |
| 6 | 未決：マスタ保守画面 SCR-04（RFP 画面一覧 P0）と契約の新規追加画面に対応するストーリーがスケジュールにない | `scr-03` / `scr-32-02` の差分表が「対象システムでマスタ画面を追加」と記載するが WBS に行なし | PM | M-03（2026-11-27） |
| 7 | [ASSUMPTION] マスタ変更の監査トリガーは E-01-S03 完了後に本ストーリーのテーブルへ付ける | 依存は E-01-S02 のみだが、`audit_logs` は同じスプリントの E-01-S03 で作られる | テックリード | S1 開始（2026-11-30） |
| 8 | 規模：テーブル 7 本＋フィクスチャ＋読み取り API 1 本で、画面がないため 1 スプリントに収まる（INVEST 適合） | — | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md](../schedule.md) §3 の E-02-S01 行
- 完了の定義：[define-dod.md](../define-dod.md)（D-001、D-002、D-005、D-010、D-011、D-015、D-016、D-019）
- 関連機能ID：FE-03（`function-list.md` は未作成のため暫定キー）
- 関連 NFR・データ要件：DR-MST-01、NFR-SEC-02、NFR-AUD-01、NFR-PERF-01
- データベース：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§1 原則、§4.2）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05、D-19）、[03-implementation-status.md](../../../docs/05-database/03-implementation-status.md)
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.6、§1.7 Q1・Q5）
- 詳細設計：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A03）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（§4 データ制約）
- ADR：[adr-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[adr-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[adr-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- 開発ロードマップ：[development-roadmap.md](../../../docs/development-roadmap.md)（P1）
- 既存シード：[seed.sql](../../../supabase/seed.sql)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
