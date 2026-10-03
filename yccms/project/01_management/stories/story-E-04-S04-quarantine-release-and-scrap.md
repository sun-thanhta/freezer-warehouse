# E-04-S04: 隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-04-S04 |
| ストーリー名 | 隔離: release về vị trí thường cùng dải / scrap（和訳：隔離：同一温度帯の通常ロケーションへの解除（release）／廃棄（scrap）） |
| 関連Epic | E-04（在庫・隔離・温度帯しきい値／F03） |
| 関連機能ID | SCR-10, FE-10（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

品質管理担当（qa）として、隔離中のロットを理由とともに同じ温度帯の通常ロケーションへ解除（release）するか、廃棄（scrap）したい。なぜなら、隔離品を判断しないまま置いておくと保管スペースと在庫価値を失い、判断の根拠と実施者を記録しなければ食品安全上の説明責任を果たせないからだ。

## 3. 背景・目的

- 入荷時の温度逸脱で保留になったロットは隔離ロケーション（C-Q／F-Q）に `status='quarantine'` で置かれ、引当チェーン③で除外される（FR-INV-05、E-03-S02）。判断が出るまでロックし、判断は release か scrap のどちらかで記録する（01-system-overview-and-scope.md §1.1、§2.6.5）。
- release は同じ温度帯の通常ロケーションへのみ（隔離ロケーションや他の温度帯は不可）。scrap は在庫数を0にする。いずれも理由が必須で、監査ログを残す。
- プロトタイプは release／scrap を `manager` だけに許し、`lots` を直接更新して移動台帳がなかった。目標設計では `qa` ロールにも許可し（D-02）、数量・ロケーションの変化を `inventory_movements` に記録する（D-10）。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `qa`（品質管理） | 隔離ロットの release／scrap（主利用者） | 目標設計で追加された権限。[ASSUMPTION] manager と同等 |
| `manager`（倉庫管理者） | 隔離ロットの release／scrap | プロトタイプと同じ |
| `warehouse` / `sales` / `admin` / `auditor` | 隔離タブの閲覧のみ（操作群は表示しない） | API を呼ぶと 403。[ASSUMPTION] admin も操作不可 |

## 5. スコープ

**スコープ内**

- 在庫照会の「隔離」タブ（`/inventory?view=quarantine`）の各行に操作群を表示する：理由（QA）、release 先ロケーション（同じ温度帯で `is_quarantine=false` の通常ロケーションのみ、`GET /api/master` から取得）、「解除（release）」、「廃棄（scrap）」。表示条件は「manager または qa」かつ「ロットが `quarantine`」。
- `POST /api/lots/[id]/quarantine`（A08）→ `resolve_quarantine(p_lot_id, p_action, p_location_id, p_reason)` の目標版：`has_role('manager') or has_role('qa')` で権限を確認する。
- バリデーション：SCR-08-10 §3 の V1〜V7（すべて SQL 側。BFF は UUID 形式のみ確認）。
- release：ロットを `available` にし、ロケーションを release 先に変える。`inventory_movements('release', qty_delta=0, from=隔離ロケーション, to=通常ロケーション, reason)` を記録する（E-04-S03 の内部関数）。
- scrap：ロットを `scrapped`、`qty_on_hand=0` にする。`inventory_movements('scrap', qty_delta=−在庫数, reason)` を記録する。
- 監査ログ：`quarantine.release`／`quarantine.scrap`（理由を含む）。
- 結果メッセージを表示し一覧を再読み込みする（ロットが隔離タブから消える）。処理中はボタンをロックする。
- [ASSUMPTION] scrap の前に確認ダイアログを出す。

**スコープ外**

- 入荷後に見つかった逸脱による `available → quarantine` → 目標設計の追加遷移（E-11 系、逸脱ケースと連携）
- `review` ロット（牛個体識別番号 9桁）の判断 → [ASSUMPTION] Q3 回答後に別ストーリー
- 一部数量だけの release／scrap → [ASSUMPTION] 扱わない（ロット全量）
- 逸脱ケース・是正処置との連携 → E-11-S02（仮）
- release 後の引当（①②④⑤の判定）→ E-05-S02

## 6. 主要業務フロー

**正常系（release）**

1. qa が在庫照会の「隔離」タブを開く。`GET /api/inventory?view=quarantine`、`GET /api/master`、`GET /api/me` で隔離ロットと操作群が表示される。
2. 対象ロット（例：冷蔵 SKU、C-Q-01）に理由（例：「再測定で 3°C、品質問題なし」）を入力し、release 先に C-01-01 を選んで「解除」を押す。ボタンがロックされる。
3. API → `resolve_quarantine`：`app_users`・ロール・理由を確認し、ロットを `FOR UPDATE` でロックして `quarantine` であること、release 先が同じ温度帯の通常ロケーションであることを確認する。
4. ロットを `available`・C-01-01 に更新し、在庫移動（release）と監査ログ（`quarantine.release`）を記録する。200 `{"ok":true}`。
5. 「LOT…：在庫に戻しました（監査ログに記録済み）」と表示し、一覧を再読み込みする。ロットは隔離タブから消え、「すべて」タブに通常在庫として現れる。

**代替フロー**

- **A1 scrap**：理由を入力し「廃棄」を押す → 確認ダイアログで確定 → ロットは `scrapped`・在庫0になり、在庫移動（scrap）と監査ログ（`quarantine.scrap`）を記録。「LOT…：廃棄しました（監査ログに記録済み）」と表示し、ロットはすべてのタブから消える。

**例外フロー**

- **E1 理由が空**：422 `REASON_REQUIRED`「理由を入力してください。」
- **E2 権限なし**：warehouse／sales／admin／auditor が API を直接呼ぶ → 403 `FORBIDDEN`「この操作は管理者または QA のみ実行できます。」。`app_users` 未登録 → 403 `NO_PROFILE`。
- **E3 他の人が先に処理した**：409 `LOT_NOT_QUARANTINED`「このロットは既に隔離状態ではありません。」→ 再読み込みを案内する。
- **E4 release 先が不正**（未指定、隔離ロケーション、他の温度帯、存在しない）：422 `INVALID_LOCATION`。
- **E5 action が不正**：422 `INVALID_ACTION`。
- **E6 ロット id が UUID 形式でない**：404。
- **E7 共通エラー**：未ログイン 401（ログイン画面へ）、DB 到達不可 503、想定外 500（DB の詳細は返さない）。入力した理由は保持する。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| SKU・名称 | `products.sku`、`name`、`zone_id` | 表示のみ | |
| ロット番号・法定 ID | `lots.lot_no`、`lot_regulated_ids.value` | 表示のみ | |
| 現在のロケーション | `lots.location_id` → `locations.code`（`is_quarantine=true`） | 表示のみ | C-Q／F-Q |
| ロット状態 | `lots.status` | 表示のみ（処理で更新） | `quarantine` → `available`／`scrapped` |
| 期限種別・期限・残日数 | `product_versions.expiry_type`、`lots.expiry_date` | 表示のみ | 判断材料 |
| 在庫数・入荷数 | `lots.qty_on_hand`、`qty_received` | 表示のみ | scrap で 0 |
| 理由（QA） | `inventory_movements.reason`、`audit_logs.detail` | 編集可 | 必須（SQL で検査） |
| release 先ロケーション | `locations`（`zone_id`＝SKU の温度帯、`is_quarantine=false`）→ `lots.location_id`、`inventory_movements.to_location_id` | 編集可 | release のときのみ |
| 操作 | `p_action`（`release`／`scrap`） | 編集可（ボタン） | |
| 在庫移動 | `inventory_movements`（`release` は `qty_delta=0`、`scrap` は `−在庫数`） | 画面表示なし | E-04-S03 |
| 監査ログ | `audit_logs`（`quarantine.release`／`quarantine.scrap`、`actor_id`） | 画面表示なし（SCR-34 で閲覧） | |
| 操作者のロール | `GET /api/me` → `user_roles` | 表示のみ | 操作群の表示判定に使う |

## 8. 技術的制約・非機能面の考慮

- **ADR-001**：検査と書き込みはすべて `resolve_quarantine`（`SECURITY DEFINER`、`search_path = public, pg_temp`）の中で行う。PostgREST を直接呼んでも迂回できない。`authenticated` は `lots` を直接更新できない。
- **ADR-002**：画面 → BFF（`withAuth`）→ ユーザー JWT で RPC。BFF はパラメータを渡すだけ。
- **同時実行**：対象ロットを `FOR UPDATE` でロックし、二重処理を `LOT_NOT_QUARANTINED` で止める。
- **ADR-006**：ローカル環境のみで検証する。
- **NFR／要件**：NFR-SEC-02（RBAC：manager と qa に限定）、NFR-AUD-01（理由つきの監査ログ）、NFR-PERF-01（書き込み p95 ≦ 3秒）、NFR-LOC-01、DR-RET-01、FR-INV-05、FE-10、BR-EXP-01。
- **関連ストーリー**：E-03-S02（隔離ロットの作成）、E-04-S02（隔離タブ）、E-04-S03（在庫移動の内部関数）が前提。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] Given C-Q-01 にある冷蔵の隔離ロット、When qa が理由と C-01-01 を指定して release する、Then ロットは `available`・C-01-01 になり、在庫移動（release、`qty_delta=0`、C-Q-01 → C-01-01）1件と理由つきの監査ログ `quarantine.release` 1件が記録される（pgTAP + E2E）〔D-001〕
- [ ] scrap すると、ロットは `scrapped`・`qty_on_hand=0` になり、在庫移動（scrap、`qty_delta=−元の在庫数`）と監査ログ `quarantine.scrap` が記録され、在庫照会のすべてのタブから消える（pgTAP + E2E）〔D-001〕
- [ ] 理由が空なら `REASON_REQUIRED`（422）で、ロット・在庫移動・監査ログのいずれも変わらない（pgTAP）
- [ ] release 先が隔離ロケーション、他の温度帯（例：冷凍ロケーション）、存在しないロケーションのいずれかなら `INVALID_LOCATION`（422）になる（pgTAP）
- [ ] 既に `available`／`scrapped` のロットは `LOT_NOT_QUARANTINED`（409）。2セッションが同時に同じロットを処理すると、片方だけが成功する（pgTAP）〔D-019〕
- [ ] warehouse／sales／admin／auditor には操作群が表示されず、API を呼ぶと `FORBIDDEN`（403）。`app_users` なしは `NO_PROFILE`（403）（E2E + pgTAP）〔D-011〕
- [ ] PostgREST から `resolve_quarantine` を直接呼んでも同じ検査が働き、`authenticated` は `lots` を直接更新できない（pgTAP RLS）〔D-011〕
- [ ] release したロットは `quarantine` ではなくなり、引当チェーン③で除外されない状態になる（本ストーリーは状態遷移を pgTAP で確認、引当との結合は E-05-S02 の結合テストで確認）〔D-002〕
- [ ] 結果メッセージ・エラーメッセージ・ボタン名が日本語で表示される（E2E）〔D-014〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] qa は manager と同じ release／scrap 権限を持ち、admin は持たない | 権限マトリクス S05（manager・qa のみ W） | お客様 | M-02（2026-10-30） |
| 2 | [ASSUMPTION] 一部数量の release／scrap は扱わず、ロット全量で処理する | 設計は scrap 時 `qty_on_hand := 0` のみ定義 | お客様 | M-02（2026-10-30） |
| 3 | [ASSUMPTION] scrap の前に確認ダイアログを出す | 取り消せない操作のため（仕様に記載なし） | テックリード | S2 開始（2026-12-14） |
| 4 | 未決：消費期限が到来した隔離ロットを release してよいか。設計上は禁止されていない（release しても引当①で止まる） | 設計に制限の記載なし | お客様 | M-02（2026-10-30） |
| 5 | [ASSUMPTION] `review` ロット（牛個体識別番号 9桁）は本ストーリーの操作対象外 | Q3 未回答。`resolve_quarantine` は `quarantine` 状態のみ扱う | お客様 | M-02（2026-10-30） |
| 6 | 未決：release／scrap に maker-checker（2名承認）が必要か。現設計は1名で実施 | NFR-SEC-02 は maker-checker を例外承認・master 変更に求めており、隔離判断は対象として明記されていない | お客様 | M-02（2026-10-30） |
| 7 | [ASSUMPTION] メッセージの日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 8 | 未決：E-03-S02・E-04-S02・E-04-S03 と同じスプリント（S2：2026-12-14〜12-25）で依存する。前提ストーリーが遅れると結合が後ろにずれる | schedule.md §3 | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-04-S04 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-011, D-014, D-019）
- 関連機能ID：SCR-10, FE-10（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-SEC-02, NFR-AUD-01, NFR-PERF-01, NFR-LOC-01, DR-RET-01, FR-INV-05, BR-EXP-01
- 画面仕様：[scr-08-10-inventory-and-quarantine.md](../../../docs/03-detail-design/scr-08-10-inventory-and-quarantine.md)（§2 No.5h〜9, §3, §4, §5, §6, §7）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API・ルール：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A08）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（FR-INV-05、§2.1、§3、§6）
- 基本設計：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.6.5）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3, §3.4）
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-05）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-002](../../../docs/04-adr/adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.3）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-02, D-10）
- 関連ストーリー：[E-03-S02](story-E-03-S02-temperature-deviation-reject-or-quarantine-hold.md)、[E-04-S02](story-E-04-S02-multi-criteria-inventory-and-expiry-alerts.md)、[E-04-S03](story-E-04-S03-inventory-movement-ledger.md)、E-05-S02

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
