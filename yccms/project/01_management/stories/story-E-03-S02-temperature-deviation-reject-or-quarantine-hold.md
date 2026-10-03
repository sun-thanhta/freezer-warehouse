# E-03-S02: 温度逸脱時の拒否または保留（隔離ロケーション -Q への格納）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-03-S02 |
| ストーリー名 | Lệch nhiệt → Từ chối hoặc 保留 vào 隔離 (-Q)（和訳：温度逸脱 → 拒否、または保留として隔離ロケーション（-Q）へ） |
| 関連Epic | E-03（入荷・検品／F02） |
| 関連機能ID | SCR-07, FE-07（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、受入温度がしきい値を外れた明細を「拒否」か「保留（隔離ロケーション -Q へ格納）」のどちらかに必ず振り分け、その処理メモを残したい。なぜなら、温度逸脱品が通常在庫に混ざると引当で出荷されてコールドチェーン違反になり、後で QA が判断するための根拠も残らないからだ。

## 3. 背景・目的

- 温度逸脱品や QA 判断待ちの商品は、判断が出るまで隔離区域にロックすることが YCCMS の4原則の一つ（01-system-overview-and-scope.md §1.1）。
- BR-TEMP-02：入荷時の温度逸脱は「拒否」または「保留（同じ温度帯の -Q ロケーション）」のみ可能で、メモが必須。逸脱品を「受入」にする経路を UI・BFF・SQL のすべてで塞ぐ。
- 隔離区域は冷蔵（C-Q）と冷凍（F-Q）にのみあり、常温には -Q がないため、常温の逸脱は拒否しか選べない。
- 保留で作られたロットは `status='quarantine'` となり、引当チェーン③で除外される（E-05-S02）。解除・廃棄は E-04-S04 で行う。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse`（倉庫作業者） | 逸脱明細の拒否／保留の選択とメモ入力（主利用者） | — |
| `manager`（倉庫管理者） | warehouse と同じ | 権限は同等 |
| `qa`（品質管理） | 本ストーリーでは操作しない | 保留ロットの release／scrap を E-04-S04 で判断 |
| `sales` / `admin` / `auditor` | 操作しない | — |

## 5. スコープ

**スコープ内**

- 温度入力のたびにクライアントで判定する（入荷日に有効なしきい値版、NULL 側は無制限、[ASSUMPTION] 境界値は範囲内に含める）。しきい値内は緑枠、外れたら赤枠＋行背景を淡赤にする。
- 逸脱時の UI：処理メモ欄［14］（必須）と結果欄［15］を表示する。結果の既定値は、その温度帯に -Q ロケーションがあれば `hold`、なければ `rejected`。結果欄に「受入」の選択肢は出さない。常温では「保留」も出さない。結果を変えるとロケーション欄をクリアする。
- 結果 `hold` のとき、ロケーション欄のラベルを「隔離ロケーション（-Q）」に変え、同じ温度帯の `is_quarantine=true` のロケーションだけを候補にする。結果 `rejected` のときはロケーション欄をロックする。
- バリデーション：V10 `TEMP_DEVIATION`、V13 `INVALID_LOCATION`（`hold` ⇔ -Q）、V15 `INVALID_RESULT`。BFF と SQL の両方で検査する。
- 書き込み（E-03-S01 と同じトランザクション内）：
  - `hold`：`inbound_lines.location_id`＝-Q ロケーション、`lots(status='quarantine')` を -Q に作成、`inventory_movements(receive, to_location_id=-Q)`。
  - `rejected`：`inbound_lines.location_id=NULL`、ロットと在庫移動は作らない。
  - 共通：`temp_ok=false`、`temp_note` を保存、`zone_version_id` に判定に使った版を記録。
- フッターのサマリー「n 明細・m 不合格（拒否／保留）」。

**スコープ外**

- 隔離ロットの release／scrap → E-04-S04
- 入荷後に QA やロガーが逸脱を見つけた場合の `available → quarantine` → 目標設計の追加遷移（E-11 系）
- 逸脱ケース・是正処置（deviation case）→ E-11-S02（仮）
- 拒否品を仕入先へ戻す手配（業務フロー図上は「仕入先返却」のみで、システム機能の定義なし）
- 牛個体識別番号 9桁の業務レビュー → E-03-S03

## 6. 主要業務フロー

**正常系（保留）**

1. warehouse が冷蔵 SKU（例：CHI-002）の明細で受入温度 9.0°C を入力する。赤枠になり、結果は既定で「保留 — 隔離して QA 判断待ち」、ロケーション欄はクリアされ「隔離ロケーション（-Q）」に変わる。
2. 処理メモ（例：「再測定でも 9°C。隔離して QA 判断待ち」）を入力し、C-Q-01 を選ぶ。
3. 「検品確定・入庫」を押す。BFF が V10・V13 を検査し、RPC を呼ぶ。
4. SQL が入荷日に有効な版で再判定し、`temp_ok=false`、`result='hold'`、-Q ロケーションの温度帯一致を確認する。ロット（`quarantine`）、在庫移動（`receive`、-Q へ）、監査ログを書き込む。
5. 入荷詳細に「保留 → 隔離」バッジが表示され、在庫照会の隔離ビュー（E-04-S02）に現れる。

**代替フロー**

- **A1 拒否**：結果を「拒否 — 仕入先へ返却」に変える。ロケーション欄がロックされ、明細は `location_id=NULL` で保存される。ロットは作られない。
- **A2 常温の逸脱**：常温 SKU（例：AMB-002）で 13.0°C を入力すると、結果の既定値は「拒否」で、「保留」は選択肢に出ない。

**例外フロー**

- **E1 メモ未入力、または逸脱のまま `accepted` を送信（直接 API 呼び出しを含む）**：422 `TEMP_DEVIATION`「明細n（SKU）：温度 X°C はしきい値 … の範囲外です。拒否または保留（隔離）を選び、メモを入力してください。」。伝票全体をロールバックし、入力値は保持する。
- **E2 `hold` で通常ロケーション、別温度帯の -Q（例：冷蔵 SKU に F-Q）、常温 SKU で `hold`**：422 `INVALID_LOCATION`「同じ温度帯の隔離ロケーション（-Q）を選んでください」。
- **E3 結果の値が不正**：BFF は `accepted` として扱い V10 で止める。SQL は `INVALID_RESULT`（422）。
- **E4 温度未入力**：422 `TEMP_REQUIRED`。
- **E5 確定直前にしきい値版が切り替わった**：SQL は入荷日に有効な版で判定する。画面表示（参考判定）と結果が違えば 422 `TEMP_DEVIATION` を返し、利用者が結果を選び直す。
- **E6 共通エラー**：未ログイン 401（ログイン画面へ）、権限なし 403、他明細のロット番号重複 409、DB 到達不可 503。いずれも伝票全体をロールバックし、入力値を保持する。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 受入温度 | `inbound_lines.temp_c` | 編集可 | 必須、0.1 刻み |
| しきい値 | `temperature_zone_versions.min_c`、`max_c`（`zone_range_at(products.zone_id, arrival_date)`） | 表示のみ | Yuki 自社基準：常温 15〜25°C・冷蔵 0〜5°C・冷凍 −18°C 以下（設定から読む） |
| 温度判定 | `inbound_lines.temp_ok` | 表示のみ（SQL 算出） | 逸脱時 `false` |
| 適用しきい値版 | `inbound_lines.zone_version_id` | 表示のみ（SQL 算出） | |
| 逸脱処理メモ | `inbound_lines.temp_note` | 編集可 | 逸脱時のみ必須、trim 後に空不可 |
| 検品結果 | `inbound_lines.result` | 編集可（逸脱時） | `hold`／`rejected`。逸脱時に `accepted` は不可 |
| 隔離ロケーション | `inbound_lines.location_id` → `locations`（`is_quarantine=true`、`zone_id`＝SKU の温度帯）→ `lots.location_id` | 編集可（`hold` 時） | `rejected` は NULL（CHECK `result='rejected' or location_id is not null`） |
| -Q の有無 | `locations`（温度帯ごとの `is_quarantine=true` の件数） | 表示のみ | 既定結果の決定に使う |
| ロット状態 | `lots.status` | 表示のみ | `hold` → `quarantine` |
| 在庫移動 | `inventory_movements`（`receive`、`to_location_id`＝-Q） | 画面表示なし | [ASSUMPTION] 保留は `receive` 1件で記録する |
| 監査ログ | `audit_logs`（`inbound.confirm`） | 画面表示なし | |

## 8. 技術的制約・非機能面の考慮

- **BR-TEMP-01／02**：しきい値は `temperature_zone_versions` から読み、コードに書かない。判定は TS（表示用）と SQL（最終関門）の2層で同じルールを持つ。
- **ADR-001**：判定と書き込みは `confirm_inbound_receipt` 内で行い、`temp_ok` はクライアントから受け取らない。
- **ADR-004**：判定は入荷日に有効なしきい値版で行い、使った版を `zone_version_id` に残す（D-13 の解消）。
- **ADR-006**：ローカル環境のみで検証する。
- **NFR**：NFR-PERF-01（書き込み p95 ≦ 3秒）、NFR-AUD-01、NFR-LOC-01、DR-RET-01（入荷・逸脱記録の 3年保持）。
- **関連要件**：FR-REC-02〜05、FE-07、BR-TEMP-01／02、FR-INV-05（隔離ロットは引当対象外）。
- 隔離ロケーション（C-Q、F-Q）のマスターは E-02-S01 のシードに依存する。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] Given 冷蔵しきい値版 0〜5°C、When 冷蔵 SKU の明細を 9.0°C・保留・C-Q-01・メモありで確定する、Then 明細は `result='hold'`・`temp_ok=false`・`temp_note` 保存、ロットは `status='quarantine'` で C-Q-01 に作られ、`inventory_movements(receive)` の移動先が C-Q-01 になる（E2E + pgTAP）〔D-001, D-004〕
- [ ] 同じ条件で「拒否」を選ぶと、明細は `location_id=NULL` で保存され、ロットと在庫移動は作られない（pgTAP）
- [ ] 逸脱明細を `accepted` で送る、またはメモが空だと `TEMP_DEVIATION`（422）で伝票全体がロールバックされる（unit + pgTAP）〔D-011〕
- [ ] `hold` で通常ロケーション、別温度帯の -Q、常温 SKU を指定すると `INVALID_LOCATION`（422）になる（pgTAP）
- [ ] 境界値：冷蔵 0.0／5.0°C は範囲内、−0.1／5.1°C は逸脱。冷凍 −18.0°C は範囲内、−17.9°C は逸脱。常温 15.0／25.0°C は範囲内、14.9／25.1°C は逸脱（unit + pgTAP。境界を含む扱いは §10 #1）〔D-019〕
- [ ] しきい値版を切り替える（E-04-S01）と、適用開始日以降の入荷日には新しい版で判定され、過去明細の `temp_ok`・`zone_version_id` は変わらない（pgTAP）
- [ ] 逸脱時、結果欄に「受入」が表示されず、常温では「保留」も表示されない。結果を変えるとロケーション欄がクリアされる（E2E）
- [ ] 保留で作られたロットが在庫照会の隔離ビュー（E-04-S02）に表示され、引当候補に入らない状態（`quarantine`）である（E2E + pgTAP）〔D-002〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] しきい値の境界値は範囲内に含める（min ≦ 温度 ≦ max） | 設計書に明記がなく、プロトタイプの判定関数がこの扱い | お客様（Yuki 品質管理） | M-02（2026-10-30） |
| 2 | [ASSUMPTION] 保留明細の在庫移動は `receive`（移動先＝-Q）1件とし、`quarantine` 種別は入荷後の隔離（目標の追加遷移）用に取っておく | ER 設計は移動種別の一覧のみで使い分けが未定義 | テックリード | S2 開始（2026-12-14） |
| 3 | 未決：しきい値を読む基準日（SCR-07 §3.4「確定時点」と ADR-004「入荷日」の不一致）。本ストーリーは ADR-004 に従う | 設計書間の不一致 | テックリード | M-03（2026-11-27） |
| 4 | [ASSUMPTION] エラーメッセージの日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 5 | 未決：同一スプリント内で E-03-S01 に依存する（S2：2026-12-14〜12-25） | schedule.md §3 | PM | S2 開始（2026-12-14） |
| 6 | 未決：隔離ロケーション（C-Q-01 など）の具体的なコードと数は E-02-S01 のシードで確定する | E-02-S01 の成果物に依存 | PM | S1 完了（2026-12-11） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-03-S02 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-002, D-004, D-011, D-019）
- 関連機能ID：SCR-07, FE-07（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-PERF-01, NFR-AUD-01, NFR-LOC-01, DR-RET-01, BR-TEMP-01／02, FR-INV-05
- 画面仕様：[scr-07-inbound-inspection.md](../../../docs/03-detail-design/scr-07-inbound-inspection.md)（§3.2, §3.4 V10・V13, §3.6）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- ルール：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-TEMP-01／02、§2.1、§6）
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.1, §1.5）、[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.6.2）
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-03 明細2）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2, §4.3）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-13, D-16）
- 関連ストーリー：[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-04-S01](story-E-04-S01-versioned-temperature-zone-thresholds.md)、[E-04-S04](story-E-04-S04-quarantine-release-and-scrap.md)、E-02-S01、E-05-S02

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
