# E-03-S01: 入荷伝票の作成と検品（温度・ロット・期限・同一温度帯ロケーション）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-03-S01 |
| ストーリー名 | Tạo & kiểm phiếu nhập: nhiệt / lô / hạn / vị trí đúng dải（和訳：入荷伝票の作成と検品：温度・ロット・期限・同一温度帯ロケーション） |
| 関連Epic | E-03（入荷・検品／F02） |
| 関連機能ID | SCR-07, FE-06（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、入荷した商品の温度・ロット番号・製造日・期限・保管ロケーションを1枚の入荷伝票で明細ごとに検品し、1回の確定で在庫ロットまで登録したい。なぜなら、手作業と表計算の検品では消費期限到来品や温度帯違いのロケーションへの格納を確実に止められず、その後の引当とトレースの起点になる正しいロットデータが残らないからだ。

## 3. 背景・目的

- YCCMS が保証すべき4点（消費期限到来品を出荷しない／日付逆転禁止／温度逸脱品は隔離／トレース可能）のうち3点は、入荷時に記録されるデータの品質で決まる（01-system-overview-and-scope.md §1.1）。現状 Yuki は入荷検品を手作業と表計算で行っている。
- 本ストーリーは SCR-07 の S03「入荷検品」画面（`/inbound/new`）と、確定処理 `confirm_inbound_receipt`（1トランザクション）を目標設計どおりに構築する。温度逸脱時の拒否／保留（E-03-S02）、法定トレース（E-03-S03）、一覧・詳細（E-03-S04）は、本ストーリーで作るフォームと確定関数の上に積み上げる。
- プロトタイプで判明した不備（D-10 在庫移動台帳なし、D-11 伝票ステータスなし、D-13 適用しきい値を記録していない、D-14 `arrival_date` の既定値 `CURRENT_DATE`、D-16 クロスCHECK不足）を作り込まないことを条件とする（05-database/02-prototype-vs-design-comparison.md）。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse`（倉庫作業者） | 入荷伝票の作成・確定（主利用者） | — |
| `manager`（倉庫管理者） | warehouse と同じく作成・確定できる | 権限は同等 |
| `qa` / `sales` / `admin` / `auditor` | 作成・確定は不可（権限マトリクス S03 が「—」） | qa / admin / auditor は E-03-S04 で閲覧のみ |

ロールコードは identity マイグレーション（`20261003060000_identity_and_roles.sql`）と yccms/docs の定義に従う（role-list.md は未作成）。

## 5. スコープ

**スコープ内**

- S03 画面：ヘッダー（仕入先・入荷日・備考）、明細（SKU・ロット番号・製造日・期限・数量・受入温度・ロケーション）、明細の追加／削除（最後の1行は削除不可）、フッターのサマリー「n 明細・m 不合格」。
- 入力ガイド：SKU 選択で温度帯バッジと期限種別バッジ（消費期限＝赤、賞味期限＝灰）を表示、温度欄の下に「Yuki しきい値：…」を表示。しきい値は入荷日に有効な版から取得する。SKU を変更するとロケーション欄をクリアする。
- ロケーションは SKU と同じ温度帯の通常ロケーション（`is_quarantine=false`）のみ候補に出す。
- 3層バリデーション：ブラウザ（`required`・`min`・色）、BFF（`inspectInboundLines`：全エラーをまとめて 422）、SQL（最初のエラーで伝票全体をロールバック）。対象は SCR-07 の V1〜V9、V13（通常ロケーション側）、V14、V15。
- `POST /api/inbound`（A05）と `confirm_inbound_receipt` の目標版：`has_role()` による権限確認、しきい値は `zone_range_at(zone_id, arrival_date)`、期限種別は `product_rule_at(product_id, arrival_date)` で読み取り、`temp_ok` と `zone_version_id` を SQL 側で算出・保存する。
- 書き込み（1トランザクション）：`inbound_receipts`（`code`＝`IN-YYMMDD-nnnn`、sequence `inbound_receipt_seq`、`status='confirmed'`、`confirmed_at`、`created_by`）、`inbound_lines`、受入明細ごとに `lots(status='available', qty_on_hand=qty)`、`inventory_movements`（`receive`、E-04-S03 の内部関数を利用）、`audit_logs`（`inbound.confirm`）。
- `Idempotency-Key` ヘッダーによる二重登録防止（api-specification.md §1 の目標）。
- DB 制約の追加：ロット番号の空文字禁止 CHECK（V5）、CHECK 違反 `23514` を 500 ではなく 422 に対応付け（V6・V8）、`arrival_date` に既定値を持たせない（D-14）、`result='rejected' or location_id is not null`（D-16）。

**スコープ外**

- 温度逸脱時の拒否／保留（隔離ロケーション -Q）の判定と UI → E-03-S02
- 米（産地・取引）・牛（個体識別番号）の法定トレース入力 → E-03-S03
- 入荷一覧（S02）・入荷詳細（S04）→ E-03-S04
- 入荷予約と仕入先参照番号 `supplier_ref` の重複警告 → E-03-S05（仮）
- 写真添付 `inbound_attachments`（SHA-256）→ [ASSUMPTION] 後続ストーリーで対応（ADR-006 によりローカル環境では Storage を停止しているため）
- 下書き保存（`status='draft'`）の UI → [ASSUMPTION] 本ストーリーでは列のみ用意し、保存 UI は扱わない
- 7日を超える遡及入荷の maker-checker 承認 → [ASSUMPTION] 扱わない（7日超は一律エラー）
- ロケーション推奨（put-away）→ E-04-S05（仮）

## 6. 主要業務フロー

**正常系**

1. warehouse が入荷一覧の「＋入荷検品」から `/inbound/new` を開く。`GET /api/master` で仕入先・SKU・ロケーション・温度帯（有効版しきい値）を取得し、空の明細1行を持つフォームを表示する。入荷日の初期値は JST の今日。
2. 仕入先・入荷日（JST の今日−7日〜今日）・備考を入力する。
3. 明細ごとに SKU を選ぶと、温度帯・期限種別バッジとしきい値ヒントが表示される。
4. ロット番号・製造日・期限（製造日以降）・数量（正の整数、SKU の単位付き）・受入温度（0.1 刻み）を入力する。温度がしきい値内なら枠が緑になり、結果は `accepted`。
5. 同じ温度帯の通常ロケーションを選ぶ。
6. 「検品確定・入庫」を押すと、ボタンが「保存中…」になりロックされる。`POST /api/inbound` を `Idempotency-Key` 付きで送る。
7. BFF が全明細を検査し、問題がなければ RPC `confirm_inbound_receipt` を呼ぶ。
8. SQL が `auth.uid()`・`app_users`・ロール・全ルールを再検査し、入荷日に有効なしきい値版で `temp_ok` と `zone_version_id` を確定する。伝票・明細・ロット・在庫移動（`receive`）・監査ログを1トランザクションで書き込む。
9. 200 `{id}` が返り、`/inbound/{id}`（入荷詳細、E-03-S04）へ遷移する。

**代替・例外フロー**

- **E1 BFF 検査エラー**：422 `{"error":"入荷伝票が不正です","details":["明細1（CHI-002）：…", …]}`（`details` は文字列配列）。エラーボックスを先頭に表示してスクロールし、入力値は保持する。主な内容：
  - V1 仕入先未選択（SQL：`INVALID_SUPPLIER`）
  - V2 入荷日が不正・7日より前・未来日（`INVALID_ARRIVAL_DATE`）
  - V3 明細0件（`NO_LINES`）
  - V4 SKU 未選択（`INVALID_PRODUCT`）
  - V5 ロット番号なし
  - V6 製造日／期限なし、期限が製造日より前
  - V7 期限種別 `use_by` の SKU で、`accepted` なのに期限 ≦ 入荷日（`EXPIRED_ON_ARRIVAL`、消費期限到来品は入庫不可）
  - V8 数量が正の整数でない
  - V9 受入温度が未入力（`TEMP_REQUIRED`）
  - V13 SKU と温度帯の違うロケーション、または `accepted` で隔離ロケーション（-Q）を指定（`INVALID_LOCATION`）
- **E2 BFF を迂回した直接呼び出し**：SQL がコード付き例外を出し、BFF が 422 `{"error":"<コードに対応する日本語メッセージ>（SKU）"}` に変換する。CHECK 違反 `23514` も 422 で返す（プロトタイプの 500 を解消）。
- **E3 ロット番号重複（V14）**：UNIQUE `lots(product_id, lot_no)` 違反 `23505` → 409「この商品のロット番号は既に登録されています。ロット番号を確認してください。」。伝票全体をロールバックする。
- **E4 同じ `Idempotency-Key` の再送**：[ASSUMPTION] 2回目は新規作成せず、初回の伝票 id を 200 で返す。
- **E5 未ログイン・セッション切れ**：401 → `/login?next=/inbound/new`。
- **E6 権限なし**：`app_users` 未登録または無効 → 403 `NO_PROFILE`。ロールが warehouse／manager 以外 → 403 `FORBIDDEN`（[ASSUMPTION] 既存コードの流用）。入力値は保持する。
- **E7 DB に到達できない**：503「システムメンテナンス中」の案内。入力値は保持する。
- **E8 想定外のエラー**：500「入荷伝票の保存に失敗しました。もう一度お試しください。」。DB の詳細はサーバーログのみに残し、クライアントへ返さない。
- **E9 画面表示時のマスター取得失敗**：エラーボックス「マスターを取得できませんでした」と「再試行」ボタン。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 仕入先 | `inbound_receipts.supplier_id` ← `suppliers`（`code · name`） | 編集可 | 必須。候補は [ASSUMPTION] `suppliers.is_active=true` のみ |
| 入荷日 | `inbound_receipts.arrival_date`（date、JST） | 編集可 | 今日−7日〜今日。DB 既定値なし（D-14） |
| 備考 | `inbound_receipts.note` | 編集可 | 任意 |
| 伝票番号 | `inbound_receipts.code` | 表示のみ（自動採番） | `IN-YYMMDD-nnnn`（YYMMDD は入荷日、nnnn は sequence） |
| 伝票ステータス | `inbound_receipts.status` | 表示のみ | 本ストーリーでは `confirmed` で作成 |
| 冪等キー | `inbound_receipts.idempotency_key` | 画面表示なし | `Idempotency-Key` ヘッダー値。UK |
| 作成者・確定日時 | `inbound_receipts.created_by` → `app_users`、`confirmed_at` | 表示のみ（自動） | SQL が `auth.uid()` から打刻。クライアントは送らない |
| SKU | `inbound_lines.product_id` ← `products`（`sku · name`、`zone_id`、`unit`） | 編集可 | 必須 |
| 期限種別 | `product_versions.expiry_type`（`product_rule_at(product_id, arrival_date)`） | 表示のみ | 消費期限は赤バッジ |
| ロット番号 | `inbound_lines.lot_no` → `lots.lot_no` | 編集可 | trim 後に空不可。(SKU, ロット番号) で一意 |
| 製造日・期限 | `inbound_lines.mfg_date`、`expiry_date` → `lots` | 編集可 | 期限 ≧ 製造日 |
| 数量 | `inbound_lines.qty` → `lots.qty_received`、`qty_on_hand` | 編集可 | 正の整数 |
| 受入温度 | `inbound_lines.temp_c`（numeric(5,1)） | 編集可 | 必須 |
| 温度判定 | `inbound_lines.temp_ok` | 表示のみ（SQL 算出） | クライアントは送らない |
| 適用しきい値版 | `inbound_lines.zone_version_id` → `temperature_zone_versions` | 表示のみ（SQL 算出） | 入荷日に有効な版 |
| しきい値ヒント | `temperature_zone_versions.min_c`、`max_c` | 表示のみ | NULL はその側が無制限 |
| ロケーション | `inbound_lines.location_id` → `locations`（`zone_id`、`is_quarantine=false`）→ `lots.location_id` | 編集可 | SKU と同じ温度帯のみ |
| 検品結果 | `inbound_lines.result` | 本ストーリーでは表示のみ（`accepted`） | 逸脱時の選択は E-03-S02 |
| ロット状態 | `lots.status` | 表示のみ | `available` |
| 在庫移動 | `inventory_movements`（`movement_type='receive'`、`qty_delta=qty`、`to_location_id`、`ref_entity`／`ref_id`＝入荷明細、`actor_id`） | 画面表示なし | E-04-S03 の内部関数で記録 |
| 監査ログ | `audit_logs`（`action='inbound.confirm'`） | 画面表示なし | DB が記録 |

## 8. 技術的制約・非機能面の考慮

- **ADR-001**：業務の書き込みは `confirm_inbound_receipt`（`SECURITY DEFINER`、`search_path = public, pg_temp`）だけで行う。`authenticated` には対象テーブルの insert／update／delete を付与しない。
- **ADR-002**：ブラウザ → BFF（Route Handler、`withAuth`）→ ユーザー JWT で Supabase。service role は使わない。
- **ADR-004**：しきい値と期限種別は入荷日に有効な版を `zone_range_at`／`product_rule_at` で読む。しきい値（Yuki 自社基準：常温 15〜25°C・冷蔵 0〜5°C・冷凍 −18°C 以下）をコードに書かない（BR-TEMP-01）。
- **ADR-006**：開発・検証はローカル（Supabase CLI／Docker、127.0.0.1）のみ。Storage を停止しているため写真添付は扱わない。
- **2層検査**：TS（`inspectInboundLines`、入力ガイド用）と SQL（最終関門）は同じルールを同じ順序で持つ。ルールを変えるときは両方とテストを直す。
- **業務日付**：「今日」は JST（SQL：`(now() at time zone 'Asia/Tokyo')::date`）。00:00〜09:00 JST に UTC 日付がずれる問題を避ける。
- **端末**：PC・タブレット・スマートフォン。スマートフォンでは明細を1列で表示する（wireframe-02 WF-03）。
- **規模**：月約 1,800 入荷明細（RFP S1）。
- **関連 NFR／要件**：NFR-PERF-01（書き込み p95 ≦ 3秒、同時 80 ユーザー）、NFR-SEC-02（RBAC 最小権限）、NFR-SEC-03（秘密情報をソースに置かない）、NFR-AUD-01（追記のみの監査ログ）、NFR-LOC-01（日本語 UI・JST）、DR-RET-01（入荷記録 3年保持）、FR-REC-02〜05、BR-TEMP-01、BR-EXP-01／02。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] Given 冷蔵 SKU（例：CHI-002）と冷蔵しきい値版 0〜5°C、When 受入温度 3.5°C・通常ロケーション C-01-01 で確定する、Then 伝票が `IN-YYMMDD-nnnn`・`status='confirmed'` で作成され、明細は `result='accepted'`・`temp_ok=true`・`zone_version_id` が入荷日に有効な版を指し、ロット（`available`、`qty_on_hand=qty`）、`inventory_movements(receive)` 1件、`audit_logs(inbound.confirm)` 1件が書かれる（E2E + pgTAP）〔D-001, D-004〕
- [ ] 入荷日が JST の今日−8日・明日なら BFF 422／SQL `INVALID_ARRIVAL_DATE` で拒否し、今日−7日と今日は受け付ける（unit + pgTAP の境界値）〔D-019〕
- [ ] 期限種別 `use_by` の SKU で期限＝入荷日（およびそれ以前）の明細を `accepted` で送ると `EXPIRED_ON_ARRIVAL` で伝票全体がロールバックされ、同条件の `best_before` SKU は受け付ける（unit + pgTAP）〔D-002〕
- [ ] SKU と温度帯の違う通常ロケーション、または `accepted` で -Q ロケーションを指定すると `INVALID_LOCATION`（422）で拒否される（pgTAP + E2E）
- [ ] 既存の (SKU, ロット番号) を送ると 409 が返り、伝票・明細・ロット・在庫移動・監査ログのいずれも残らない（pgTAP）
- [ ] BFF を迂回して PostgREST から RPC を直接呼んでも V1〜V9・V13〜V15 が SQL で検出され、CHECK 違反（数量 0、期限 < 製造日、空のロット番号）は 500 ではなく 422 になる（pgTAP + API テスト）〔D-011〕
- [ ] warehouse／manager は確定でき、qa／sales／admin／auditor は 403、`app_users` なしは 403 `NO_PROFILE`、未ログインは 401。`authenticated` は対象テーブルに直接 insert／update／delete できない（pgTAP RLS + API テスト）〔D-011〕
- [ ] 同じ `Idempotency-Key` で2回 POST しても伝票は1件しか作られない（pgTAP + API テスト）
- [ ] しきい値・期限種別の数値がアプリコードと SQL 関数に直書きされておらず、しきい値版を変えると判定が変わる（コードレビュー + pgTAP）〔D-015〕
- [ ] 画面のラベル・エラーメッセージが日本語、日付が `yyyy/mm/dd`、日時が JST で表示される（E2E）〔D-014〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 写真添付（`inbound_attachments`）は本ストーリーで扱わない | FR-REC-01／04 の目標設計にはあるが、ADR-006 でローカルの Storage を停止中 | PM | M-03（2026-11-27） |
| 2 | [ASSUMPTION] 下書き保存は列（`status`）のみ用意し、保存 UI は扱わない | SCR-07 §7 の目標だが、2週間スプリントに収めるため | PM／お客様 | M-03（2026-11-27） |
| 3 | [ASSUMPTION] 7日超の遡及入荷の maker-checker 承認は扱わず、一律エラーとする | SCR-07 §7 に方針のみ記載があり、画面・承認者が未定義 | お客様 | M-02（2026-10-30） |
| 4 | [ASSUMPTION] 同じ `Idempotency-Key` の再送では初回の伝票 id を 200 で返す | api-specification.md §1 は「ヘッダーを使う」とのみ記載 | テックリード | S2 開始（2026-12-14） |
| 5 | [ASSUMPTION] 作成権限のないロールには `FORBIDDEN`（403）を流用する | 権限マトリクスは S03 を warehouse／manager に限定するが、`confirm_inbound_receipt` のコード一覧には `NO_PROFILE` しかない | テックリード | S2 開始（2026-12-14） |
| 6 | [ASSUMPTION] 仕入先の候補は `is_active=true` のみ | ER 設計で `suppliers.is_active` を追加しているが、画面仕様に記載なし | テックリード | S2 開始（2026-12-14） |
| 7 | 未決：しきい値を読む基準日。SCR-07 §3.4 は「確定時点」、ADR-004 は「入荷日」。本ストーリーは ADR-004（入荷日）に従う | 設計書間の不一致 | テックリード | M-03（2026-11-27） |
| 8 | [ASSUMPTION] エラーメッセージの日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 の文言レビューで確定 | NFR-LOC-01。仕様書のメッセージは日本語化前 | PM | M-03（2026-11-27） |
| 9 | 未決：同一スプリント内の依存。E-04-S03（在庫移動台帳）が同じ S2 にあり、E-03-S02〜S04 も本ストーリーに依存する。E-04-S01（しきい値版、S1）の完了が前提 | schedule.md §3 の依存関係 | PM | S2 開始（2026-12-14） |
| 10 | 未決：規模。画面＋BFF＋SQL＋DB 制約＋冪等性で2週間ぎりぎり。分割はせず、遅れが出たら冪等性の扱いを PM が判断する | INVEST の Small | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-03-S01 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-004, D-011, D-014, D-015, D-019）
- 関連機能ID：SCR-07, FE-06（function-list.md は未作成のため、schedule.md の SCR／FE コードを暫定キーとして使用）。role-list.md も未作成。
- 関連 NFR／要件：NFR-PERF-01, NFR-SEC-02, NFR-SEC-03, NFR-AUD-01, NFR-LOC-01, DR-RET-01, FR-REC-02〜05, BR-TEMP-01, BR-EXP-01／02
- 画面仕様：[scr-07-inbound-inspection.md](../../../docs/03-detail-design/scr-07-inbound-inspection.md)、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API・ルール：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A03, A05）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（§1, §2.1, §2.2, §6）
- 基本設計：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.6.2）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-03）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.3）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-10, D-11, D-13, D-14, D-16）
- 関連ストーリー：E-02-S02、E-04-S01、[E-04-S03](story-E-04-S03-inventory-movement-ledger.md)、[E-03-S02](story-E-03-S02-temperature-deviation-reject-or-quarantine-hold.md)、[E-03-S03](story-E-03-S03-regulated-traceability-on-inbound.md)、[E-03-S04](story-E-03-S04-inbound-receipt-list-and-detail.md)

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
