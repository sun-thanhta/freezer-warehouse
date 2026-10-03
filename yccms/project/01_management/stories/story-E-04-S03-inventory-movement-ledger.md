# E-04-S03: 在庫移動台帳（マイナス在庫・温度帯外格納の禁止）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-04-S03 |
| ストーリー名 | Sổ di chuyển tồn, cấm tồn âm / ngoài dải（和訳：在庫移動台帳、マイナス在庫・温度帯外の禁止） |
| 関連Epic | E-04（在庫・隔離・温度帯しきい値／F03） |
| 関連機能ID | FE-09（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）として、ロットの数量とロケーションの変化をすべて変更不可の在庫移動台帳に記録し、マイナス在庫と温度帯の違うロケーションへの格納を DB で禁止したい。なぜなら、任意の時点の在庫を再現・照合できなければ棚卸差異や回収時の数量照合を説明できず、温度帯違いの保管はそのままコールドチェーン違反になるからだ。

## 3. 背景・目的

- プロトタイプは SQL 関数の中で `lots.qty_on_hand` と `location_id` を直接書き換えており、移動台帳がない。そのため、ある時点の在庫を再現できず、照合もできない（D-10、FE-09）。
- 目標設計では、数量・ロケーションの変更はすべて `inventory_movements`（receive／quarantine／release／scrap／ship／adjust／move）に記録し、ロットごとの `sum(qty_delta)` が `qty_on_hand` と一致することを照合で確かめる。台帳は変更不可のイベント表（P4）で、権限とトリガーの両方で UPDATE／DELETE を止める（D-17）。
- `lots` テーブルもここで作る（E-03-S01 が本ストーリーに依存）。プロトタイプにない CHECK `qty_on_hand <= qty_received`（D-16）、`inbound_line_id` の NULL 許容一意（D-15）、仕入先の整合（D-23）を最初から入れる。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse` / `manager` / `qa` | 画面操作はない。入荷確定・release／scrap・出荷などの業務関数を通して間接的に台帳へ記録される | 直接の書き込み権限はない |
| `auditor`（監査・閲覧のみ） | 照合結果・台帳データを監査証跡として参照する | [ASSUMPTION] 閲覧は RLS の読み取り権限で可能 |
| `sales` / `admin` | 利用しない | — |

## 5. スコープ

**スコープ内**

- `lots` テーブル：`product_id`、`supplier_id`、`inbound_line_id`、`lot_no`、`mfg_date`、`expiry_date`、`qty_received`、`qty_on_hand`、`location_id`、`status`、`received_at`。UK (`product_id`, `lot_no`)、UK `inbound_line_id`（NULL 可）、CHECK `qty_on_hand >= 0`・`qty_on_hand <= qty_received`・`status in (available, quarantine, review, scrapped)`、index (`product_id`, `expiry_date`, `received_at`)・`location_id`。`inbound_line_id` があれば `supplier_id` は伝票の仕入先と一致させるトリガー（D-23）。
- `inventory_movements` テーブル：`id bigint`、`lot_id`、`movement_type`（CHECK：receive／quarantine／release／scrap／ship／adjust／move）、`qty_delta`、`from_location_id`、`to_location_id`、`reason`、`ref_entity`、`ref_id`、`actor_id`（FK `app_users`）、`created_at`。FK 側の index（P7）。
- 変更不可：`forbid_update_delete` トリガー（全ロール）を付け、`authenticated` には insert／update／delete を与えない。
- 在庫更新の内部関数（[ASSUMPTION] 名称 `_record_inventory_movement`、execute は誰にも付与しない）：ロットを `FOR UPDATE` でロック → 新しい数量・ロケーションを計算 → マイナス在庫と温度帯の検査 → `lots` 更新と台帳追記を同じトランザクションで行う。業務関数（`confirm_inbound_receipt`、`resolve_quarantine`、後続の出荷関数）はこの関数だけで在庫を変える。
- 温度帯外の禁止：[ASSUMPTION] `lots` のトリガーで「`locations.zone_id` ＝ `products.zone_id`」を強制する（入荷時・移動時とも）。
- 照合：[ASSUMPTION] SQL 関数 `inventory_reconciliation()` がロットごとの `sum(qty_delta)` と `qty_on_hand` の差異を返す。pgTAP で差異0を確認する。
- 移行用ロット（`inbound_line_id` が NULL）には、シード時に初期の `receive` 移動を作る（[ASSUMPTION]）。

**スコープ外**

- 棚卸・ロケーション移動（`adjust`／`move`）の業務画面と承認 → E-04-S05（仮）
- 出荷時の `ship` 記録の呼び出し → E-05-S03（本ストーリーは内部関数を提供）
- 入荷後の隔離（`quarantine` 種別）の業務フロー → 目標設計の追加遷移（E-11 系）
- 台帳の閲覧画面 → [ASSUMPTION] 扱わない
- 定期照合ジョブ（スケジューラ）→ P5（クラウド移行）以降

## 6. 主要業務フロー

**正常系**

1. 業務関数（例：`confirm_inbound_receipt`）が、受入明細ごとに内部関数を `receive`・`qty_delta=+qty`・移動先ロケーション付きで呼ぶ。
2. 内部関数がロットを `FOR UPDATE` でロックし、新しい `qty_on_hand` が 0 以上かつ `qty_received` 以下であること、移動先ロケーションの温度帯が SKU の温度帯と一致することを確認する。
3. `lots` を更新し、`inventory_movements` に1行追記する（`actor_id` は `auth.uid()`、`ref_entity`／`ref_id` に元の業務データ）。
4. 同様に release（`qty_delta=0`、隔離ロケーション → 通常ロケーション）、scrap（`qty_delta=−在庫数`）、ship（`qty_delta=−出荷数`）が記録される。
5. `inventory_reconciliation()` を実行すると差異0件になる。

**例外フロー**

- **E1 マイナス在庫になる操作**：[ASSUMPTION] 409 `INSUFFICIENT_STOCK`「在庫が変わったため数量が足りません。画面を再読み込みしてください。」。業務関数ごとロールバックする。
- **E2 `qty_on_hand > qty_received` になる操作**：CHECK 違反 `23514` → 422。
- **E3 SKU と温度帯の違うロケーションへの格納・移動**：[ASSUMPTION] 422 `INVALID_LOCATION`「ロケーションが不正です（温度帯が違います）。」。
- **E4 台帳の UPDATE／DELETE**：トリガーが例外を出す（owner・service ロールでも不可）。
- **E5 `authenticated` による台帳への直接 insert、内部関数の直接実行**：権限エラー。
- **E6 同じロットへの同時更新**：`FOR UPDATE` で直列化され、2件目は1件目の結果を見て検査する。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| ロット | `inventory_movements.lot_id` → `lots` | システム設定 | |
| 移動種別 | `inventory_movements.movement_type` | システム設定 | 7種類の CHECK |
| 数量差分 | `inventory_movements.qty_delta` | システム設定 | 受入 +、出荷・廃棄 −、release・move は 0 |
| 移動元・移動先 | `inventory_movements.from_location_id`、`to_location_id` → `locations` | システム設定 | 移動先の温度帯 ＝ SKU の温度帯 |
| 理由 | `inventory_movements.reason` | 業務関数から引き継ぐ | release／scrap の理由など |
| 元の業務データ | `inventory_movements.ref_entity`、`ref_id` | システム設定 | 例：入荷明細、出荷割当 |
| 実行者・日時 | `inventory_movements.actor_id` → `app_users`、`created_at` | システム設定 | `auth.uid()` から SQL が打刻 |
| 在庫数・入荷数 | `lots.qty_on_hand`、`qty_received` | システム設定 | 0 ≦ 在庫数 ≦ 入荷数 |
| ロケーション | `lots.location_id` → `locations.zone_id`、`is_quarantine` | システム設定 | |
| SKU の温度帯 | `products.zone_id` | 表示のみ（参照） | 温度帯一致の基準 |
| ロット状態 | `lots.status` | システム設定 | available／quarantine／review／scrapped |
| 照合結果 | `inventory_reconciliation()`（ロット、台帳合計、在庫数、差異） | 表示のみ（SQL） | 差異0が正常 |

## 8. 技術的制約・非機能面の考慮

- **ADR-001**：在庫の書き込みは `SECURITY DEFINER` 関数だけ。内部関数には execute を付与しない。`search_path = public, pg_temp`。
- **設計原則 P4**：`inventory_movements` は変更不可のイベント表。権限とトリガーの両方で守る（D-17）。**P7**：FK に index。
- **同時実行**：ロットのロックは `lot_id` 順に取り、デッドロックを避ける（business-rules-and-state-machines.md §3 の方針に合わせる）。
- **ADR-006**：ローカル環境のみ。スケジューラを使わないため、照合は関数とテストで行う。
- **NFR／要件**：NFR-AUD-01（追記のみ）、DR-RET-01（3年保持）、NFR-PERF-02（トレース・回収時の数量照合の性能）、FE-09、FR-INV-05。
- **関連ストーリー**：E-02-S01（ロケーション・-Q のマスター）が前提。E-03-S01・E-04-S04・E-05-S03 が本ストーリーの内部関数を使う。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] `movement_type` が receive／quarantine／release／scrap／ship／adjust／move 以外の行は CHECK で拒否される（pgTAP）
- [ ] Given 在庫 10 のロット、When 内部関数で −11 を記録しようとする、Then 409 `INSUFFICIENT_STOCK` でロールバックされ、`lots` と `inventory_movements` はどちらも変わらない（pgTAP）〔D-019〕
- [ ] `lots` に `qty_on_hand < 0` や `qty_on_hand > qty_received` の値は直接書けない（pgTAP、CHECK）〔D-011〕
- [ ] SKU と温度帯の違うロケーションへの格納・移動は `INVALID_LOCATION` で拒否される（pgTAP）〔D-002〕
- [ ] `inventory_movements` の UPDATE／DELETE は `authenticated`・owner のどちらでもトリガーで拒否される（pgTAP）〔D-011〕
- [ ] `authenticated` は内部関数を実行できず、`inventory_movements`・`lots` に直接 insert／update できない（pgTAP RLS）〔D-011〕
- [ ] 入荷 → 保留 → release → scrap の一連の操作後、`inventory_reconciliation()` の差異が0件になる（pgTAP）〔D-005〕
- [ ] 2セッションが同じロットから同時に減算しても、合計がマイナスにならない（pgTAP の2セッションテスト、または並行実行テストの記録）〔D-019〕
- [ ] `lots.inbound_line_id` は NULL を許す一意制約で、1つの入荷明細から2ロットは作れない（pgTAP）
- [ ] `05-database/03-implementation-status.md` に `lots`・`inventory_movements` と内部関数が記載されている（ドキュメントレビュー）〔D-015〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 内部関数 `_record_inventory_movement` を、すべての業務関数が在庫を変える唯一の経路とする | ER 設計 §5 は「業務関数が `inventory_movements` も書く」とのみ記載 | テックリード | S2 開始（2026-12-14） |
| 2 | [ASSUMPTION] エラーコードは既存のものを流用する（マイナス在庫 → `INSUFFICIENT_STOCK` 409、温度帯外 → `INVALID_LOCATION` 422） | 台帳専用のエラーコードが定義されていない | テックリード | S2 開始（2026-12-14） |
| 3 | [ASSUMPTION] 温度帯の一致は `lots` のトリガーで強制する | 設計はルール（温度帯外禁止）のみで、実装手段を定めていない | テックリード | S2 開始（2026-12-14） |
| 4 | [ASSUMPTION] 照合は SQL 関数＋pgTAP で行い、定期ジョブは P5 以降 | ADR-006（ローカルのみ、スケジューラなし）、ER 設計は「照合ジョブ」とのみ記載 | PM | M-03（2026-11-27） |
| 5 | [ASSUMPTION] 台帳の閲覧画面は作らない | FE-09 に対応する画面 ID がない | PM／お客様 | M-03（2026-11-27） |
| 6 | [ASSUMPTION] 移行用ロットにはシード時に初期 `receive` 移動を作る | D-10 の移行方針（初期 receive ＝ 入荷数）に準拠 | テックリード | S1 完了（2026-12-11） |
| 7 | [ASSUMPTION] `auditor` を含む閲覧権限のあるロールは、RLS の読み取り権限で `inventory_movements` を参照できる（書き込みは不可） | 設計原則（読み取りは権限のあるロールに RLS で開放）からの推定。台帳の閲覧権限は明記なし | テックリード | S2 開始（2026-12-14） |
| 8 | 未決：E-03-S01 が本ストーリーに依存するのに同じスプリント（S2：2026-12-14〜12-25）にある。`lots` の DDL も含むため、本ストーリーをスプリント前半で完了させる必要がある | schedule.md §3 の依存関係、INVEST の Independent | PM | S2 開始（2026-12-14） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-04-S03 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-002, D-005, D-011, D-015, D-019）
- 関連機能ID：FE-09（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-AUD-01, NFR-PERF-02, DR-RET-01, FR-INV-05
- ルール：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（§2.1, §3, §4）
- 画面仕様（関連）：[scr-08-10-inventory-and-quarantine.md](../../../docs/03-detail-design/scr-08-10-inventory-and-quarantine.md)（§7）
- 基本設計：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.7）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§1 P4・P7, §3.2, §4.3, §5）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-10, D-15, D-16, D-17, D-23）、[03-implementation-status.md](../../../docs/05-database/03-implementation-status.md)
- 関連ストーリー：E-02-S01、[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-04-S04](story-E-04-S04-quarantine-release-and-scrap.md)、E-04-S05、E-05-S03

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
