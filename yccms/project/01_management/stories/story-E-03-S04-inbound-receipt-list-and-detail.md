# E-03-S04: 入荷伝票の一覧と詳細

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-03-S04 |
| ストーリー名 | Danh sách & chi tiết phiếu nhập（和訳：入荷伝票の一覧と詳細） |
| 関連Epic | E-03（入荷・検品／F02） |
| 関連機能ID | SCR-07（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）として、入荷伝票の一覧と明細ごとの検品結果を、入荷時に実際に適用されたしきい値と一緒に確認したい。なぜなら、温度逸脱・保留・拒否の経緯を後から説明・監査でき、確定後の伝票が改ざんされていないことを示す必要があるからだ。

## 3. 背景・目的

- 入荷検品（E-03-S01〜S03）の結果を確認する読み取り専用の画面。S02「入荷一覧」（`/inbound`）と S04「入荷詳細」（`/inbound/[id]`）を目標設計どおりに作る。
- プロトタイプの詳細画面は**現在の**しきい値を表示しているため、入荷後にしきい値が変わると誤解を招く（D-13）。目標設計では明細に記録した `zone_version_id` の版（入荷時のしきい値）を表示する（ADR-004）。
- 確定済みの伝票は変更・削除しない。誤りは隔離 → 廃棄、または在庫調整という別の業務で処理する（SCR-07 §4）。
- 法定 ID は種別付きで表示し（DR-TRACE-01）、9桁の牛個体識別番号（`review`）を区別して見せる。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse`（倉庫作業者） | 一覧・詳細の閲覧、入荷検品への遷移 | 「＋入荷検品」ボタンを使える |
| `manager`（倉庫管理者） | 同上 | 同上 |
| `qa`（品質管理） | 閲覧（逸脱・保留の確認） | 作成ボタンは出さない |
| `admin`（システム管理） | 閲覧 | 作成ボタンは出さない |
| `auditor`（監査・閲覧のみ） | 閲覧（監査証跡） | 作成ボタンは出さない |
| `sales`（営業・CS） | 利用不可（権限マトリクス S02／S04 が「—」） | API は 403、RLS で0件 |

## 5. スコープ

**スコープ内**

- S02 入荷一覧：列は伝票番号（詳細へのリンク）、入荷日、仕入先、明細数、数量合計（拒否を含む＝到着数）、検品結果バッジ（逸脱あり「温度逸脱 n 件」赤／なし「温度 OK」緑、「保留 → 隔離 n 件」橙、「拒否 n 件」赤）。並び順は `arrival_date desc, code desc`。0件時は「入荷伝票はまだありません。」。
- 「＋入荷検品」ボタン（`/inbound/new` へ）：[ASSUMPTION] 作成権限のある warehouse／manager にだけ表示する。
- [ASSUMPTION] サーバー側ページング（1ページ 50 件）と、入荷日の期間・仕入先での絞り込み。
- S04 入荷詳細：ヘッダー（伝票番号、仕入先、入荷日、登録日時、[ASSUMPTION] 作成者名）、備考（空なら非表示）、「← 一覧へ」。明細表は SKU、ロット番号、製造日 → 期限＋期限種別バッジ、数量、受入温度（`temp_ok` で緑／赤）＋逸脱処理メモ、しきい値（`zone_version_id` の版）、ロケーション、法定 ID（種別ごと、`review` は区別表示）、結果バッジ（「受入 → 入庫」緑／「保留 → 隔離」橙／「拒否」赤）と結果理由（例：`BEEF_ID_REVIEW`）。
- 読み取り専用：編集・削除の操作を置かない。DB でも `authenticated` に update／delete 権限を与えない。
- 画面状態：読み込み中（「読み込み中…」）、エラー（赤枠＋「再試行」ボタン、目標設計で追加）、0件、表示。
- API：`GET /api/inbound`（A04）・`GET /api/inbound/[id]`（A06）の目標版（版のしきい値・法定 ID・ページング情報を含む）。

**スコープ外**

- 写真添付の表示 → 写真添付を扱うストーリーで対応（E-03-S01 §10 #1）
- 下書き伝票の一覧・再編集 → 下書き保存の扱いが決まってから
- 訂正業務（隔離 → 廃棄、在庫調整）→ E-04-S04、E-04-S05（仮）
- CSV 出力・帳票 → E-08-S02（仮）
- 正方向・逆方向トレース画面 → E-07-S01（同画面から本詳細へリンクされる）

## 6. 主要業務フロー

**正常系**

1. 利用者がメニューの「入荷一覧」から `/inbound` を開く。`GET /api/inbound` で1ページ目を取得し、新しい順に表示する。
2. 必要に応じて期間・仕入先で絞り込み、ページを送る。
3. 伝票番号をクリックすると `/inbound/{id}` に遷移し、`GET /api/inbound/{id}` で明細を表示する。
4. 明細ごとに受入温度と、その時点のしきい値、結果、法定 ID を確認する。
5. 「← 一覧へ」で一覧に戻る。

**代替フロー**

- **A1** 入荷検品（E-03-S01）の確定直後は、本詳細画面に直接遷移する。
- **A2** トレース画面（E-07-S01）の伝票番号リンクから本詳細画面に来る。

**例外フロー**

- **E1** URL の id が UUID 形式でない、または存在しない → 404「データが見つかりません」。
- **E2** sales ロール、または `app_users` 未登録 → 403。
- **E3** 未ログイン・セッション切れ → 401 → `/login?next=<現在のページ>`。
- **E4** DB に到達できない → 503「システムメンテナンス中」の案内。
- **E5** その他の API エラー → 赤枠のエラーボックスと「再試行」ボタン。
- **E6** 絞り込みの日付が不正 → 400（共通ルール）。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 伝票番号 | `inbound_receipts.code` | 表示のみ | 詳細へのリンク |
| 入荷日 | `inbound_receipts.arrival_date` | 表示のみ | `yyyy/mm/dd`（JST の業務日付） |
| 仕入先 | `suppliers.code`、`name` | 表示のみ | |
| 伝票ステータス | `inbound_receipts.status` | 表示のみ | 本ストーリーでは `confirmed` のみ一覧に出す |
| 登録日時・作成者 | `inbound_receipts.created_at`／`confirmed_at`、`created_by` → `app_users.full_name` | 表示のみ | 日時は JST |
| 備考 | `inbound_receipts.note` | 表示のみ | |
| 明細数・数量合計 | `count(inbound_lines)`、`sum(inbound_lines.qty)` | 表示のみ | 拒否明細を含む |
| 検品結果集計 | `inbound_lines.temp_ok`、`result` | 表示のみ | バッジの件数 |
| SKU・単位・期限種別 | `products.sku`、`name`、`unit`、`product_versions.expiry_type`（入荷日に有効な版） | 表示のみ | 消費期限は赤 |
| ロット・製造日・期限・数量 | `inbound_lines.lot_no`、`mfg_date`、`expiry_date`、`qty` | 表示のみ | |
| 受入温度・メモ | `inbound_lines.temp_c`、`temp_ok`、`temp_note` | 表示のみ | |
| 適用しきい値 | `inbound_lines.zone_version_id` → `temperature_zone_versions.min_c`、`max_c`、`temperature_zones.name` | 表示のみ | 入荷時の版（現在値ではない） |
| ロケーション | `locations.code` | 表示のみ | 拒否は「—」 |
| 法定 ID | `lot_regulated_ids.id_type`、`value`、`verification_status`（`lots.inbound_line_id` 経由） | 表示のみ | `review` は区別表示 |
| 結果・理由 | `inbound_lines.result`、`result_reason` | 表示のみ | |

## 8. 技術的制約・非機能面の考慮

- **規模**：月約 1,800 入荷明細 × 3年保持（DR-RET-01）＝約 65,000 明細。プロトタイプの「BFF で全件取得（API 上限 1,000 行）」をやめ、SQL 側で絞り込み・ページングする。`inbound_lines(receipt_id)` などの FK index を必ず作る（D-18、P7）。
- **NFR-PERF-01**：読み取り p95 ≦ 2秒（同時 80 ユーザー）。
- **NFR-SEC-02**：閲覧はロール別に制限する（`has_role()` を使った RLS）。プロトタイプの「`profiles` があれば全員読める」から変える。
- **NFR-AUD-01**：確定伝票は不変。更新・削除の権限を与えない。
- **NFR-LOC-01**：日本語ラベル、日付 `yyyy/mm/dd`、日時は JST。
- **ADR-002**：画面 → BFF → ユーザー JWT で Supabase（RLS 適用）。**ADR-004**：しきい値は版を表示。**ADR-006**：ローカル環境のみ。性能はローカルでは参考値しか取れない。
- **関連要件**：FR-REC-02〜05、DR-TRACE-01、DR-RET-01。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] 一覧は `arrival_date desc, code desc` で並び、各行の明細数・数量合計（拒否を含む）・検品結果バッジの件数が DB の値と一致する（E2E + API テスト）〔D-001〕
- [ ] 入荷伝票が0件のとき「入荷伝票はまだありません。」と表示される（E2E）
- [ ] Given 冷蔵しきい値 0〜5°C で入荷した伝票、When しきい値を新しい版に切り替えた後に詳細を開く、Then 入荷時の版（0〜5°C）が表示される（pgTAP + E2E）〔D-001〕
- [ ] 米の産地・取引、牛の個体識別番号が種別ごとに表示され、`review` の番号は区別して表示される（E2E）〔D-005〕
- [ ] UUID 形式でない id、存在しない id は 404 になる（API テスト）
- [ ] warehouse／manager／qa／admin／auditor は閲覧でき、sales は API で 403・RLS で0件になる（API テスト + pgTAP）〔D-011〕
- [ ] 詳細画面に編集・削除の操作がなく、`authenticated` は `inbound_receipts`／`inbound_lines` を update／delete できない（E2E + pgTAP）〔D-011〕
- [ ] 一覧はサーバー側でページングされ、3年分相当（約 65,000 明細）のデータで一覧 API の p95 が 2秒以内（ローカルは参考値、本計測は D-010 の環境で実施）〔D-010〕
- [ ] ラベル・メッセージが日本語、日付 `yyyy/mm/dd`、日時が JST で表示される（E2E）〔D-014〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] サーバー側ページング（50 件／ページ）と、期間・仕入先での絞り込みを追加する | 設計に一覧の絞り込み定義がなく、3年保持で件数が増える | テックリード／お客様 | M-03（2026-11-27） |
| 2 | [ASSUMPTION] 「＋入荷検品」ボタンは作成権限のある warehouse／manager にだけ表示する | 権限マトリクス（S03 は warehouse／manager のみ）と「UI は誤操作防止」の方針 | テックリード | S2 開始（2026-12-14） |
| 3 | [ASSUMPTION] 詳細ヘッダーに作成者名（`app_users.full_name`）を表示する | `created_by` は FK だが、画面仕様は登録日時のみ | お客様 | M-03（2026-11-27） |
| 4 | 未決：一覧に伝票ステータス（`draft`／`confirmed`）列を出すか | 下書き保存のスコープ次第（E-03-S01 §10 #2） | PM | M-03（2026-11-27） |
| 5 | 未決：性能の本計測はローカル環境ではできない（ADR-006 と D-010 の矛盾） | define-dod.md の未決事項 | PM | M-03（2026-11-27） |
| 6 | [ASSUMPTION] エラーメッセージ・空表示の日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 7 | 未決：同一スプリント内で E-03-S01 に依存する（S2：2026-12-14〜12-25） | schedule.md §3 | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-03-S04 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-005, D-010, D-011, D-014）
- 関連機能ID：SCR-07（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-PERF-01, NFR-SEC-02, NFR-AUD-01, NFR-LOC-01, DR-TRACE-01, DR-RET-01, FR-REC-02〜05
- 画面仕様：[scr-07-inbound-inspection.md](../../../docs/03-detail-design/scr-07-inbound-inspection.md)（§2, §4, §7）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A04, A06）
- 基本設計：[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.1〜§3.3）
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-02, WF-04）
- ADR：[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.3）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-13, D-18）
- 関連ストーリー：[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-03-S02](story-E-03-S02-temperature-deviation-reject-or-quarantine-hold.md)、[E-03-S03](story-E-03-S03-regulated-traceability-on-inbound.md)、E-07-S01

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
