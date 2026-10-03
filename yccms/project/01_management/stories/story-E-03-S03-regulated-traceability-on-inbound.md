# E-03-S03: 入荷時の法定トレース（米：産地・取引、牛：個体識別番号10桁、9桁は業務レビュー）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-03-S03 |
| ストーリー名 | Truy xuất pháp định khi nhập: gạo 産地・取引, bò mã 10 số (9 số → business-review)（和訳：入荷時の法定トレース：米は産地・取引、牛は個体識別番号10桁（9桁は業務レビューへ）） |
| 関連Epic | E-03（入荷・検品／F02） |
| 関連機能ID | SCR-07, FE-34（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫作業者（warehouse）として、米（AMB-001）の入荷では産地・取引情報を、牛（CHI-001）の入荷では10桁の個体識別番号を必ず記録し、9桁しかない場合は勝手に補正せず業務レビューへ回したい。なぜなら、これらは米トレーサビリティ法・牛トレーサビリティ法で義務づけられた記録であり、欠落や誤った番号があると回収時に追跡できなくなるからだ。

## 3. 背景・目的

- トレースは3レーン：米 AMB-001（産地・取引）と牛 CHI-001（個体識別番号）は法定、それ以外は社内ロット（`internal_lot`）で追跡する（BR-TRACE-01／02／03）。
- 牛の個体識別番号は**ちょうど10桁**。9桁の番号をゼロ埋めなどで10桁に「直す」ことは禁止で、業務レビューに回す。RFP の重大減点項目（S5-03）に直結する。
- プロトタイプは法定 ID を1本の自由文字列 `trace_code` として `inbound_lines` と `lots` の2か所に保存しており、種別で検索できず、米の産地と取引も分かれていない（D-09）。目標設計では `lot_regulated_ids` に種別付きで保存する（DR-TRACE-01：型付き・検索可能）。
- 9桁の扱いはお客様への確認事項 Q3。目標設計の暫定案は「保留として隔離ロケーションへ入れ、ロット状態 `review`」で、プロトタイプは受入を拒否している（01-system-overview-and-scope.md §1.7、D-11）。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `warehouse`（倉庫作業者） | 法定 ID の入力（主利用者） | — |
| `manager`（倉庫管理者） | warehouse と同じ | 権限は同等 |
| `qa`（品質管理） | 本ストーリーでは操作しない | `review` ロットの判断は Q3 回答後に別ストーリー |
| `sales` / `admin` / `auditor` | 操作しない | 法定 ID の閲覧は E-03-S04・E-07-S01 |

## 5. スコープ

**スコープ内**

- SKU の `trace_lane` に応じた入力欄の出し分け：`rice` → 産地・取引欄、`beef` → 「牛個体識別番号（10桁）」欄（`inputmode=numeric`）、`internal_lot` → 非表示。明細先頭に「法定トレース：米／牛」の紫バッジを表示する。SKU を変えると入力値をクリアする。
- 米：[ASSUMPTION] 型付き保存に合わせ「産地」「取引」の2欄に分け、両方必須とする。`lot_regulated_ids` に `RICE_ORIGIN` と `RICE_TRADE` の2行を作る。
- 牛：`^[0-9]{10}$` に一致すれば `BEEF_INDIVIDUAL`（`verification_status='ok'`）を1行作る。
- 牛9桁（目標設計の暫定案、Q3 回答待ち）：補正・ゼロ埋め・切り捨てをせず、入力どおりの9桁で保存する。明細は `result='hold'`・`result_reason='BEEF_ID_REVIEW'`、ロットは隔離ロケーション（CHI-001 は冷蔵なので C-Q）に `status='review'`、`lot_regulated_ids.verification_status='review'`。
- それ以外の桁数・数字以外を含む値 → 422 `BEEF_ID_INVALID`。
- 拒否明細（`result='rejected'`）では法定 ID を求めない（V11／V12 は結果が拒否以外のときだけ）。
- SQL 側の再検査と DB 制約：UK (`lot_id`, `id_type`)、CHECK「`id_type='BEEF_INDIVIDUAL'` なら10桁、または `verification_status='review'`」、検索用 index (`id_type`, `value`)。
- Q3 の回答が「受入拒否」だった場合の分岐：9桁は 422 `BEEF_ID_REVIEW` で確定できない（プロトタイプと同じ動き）。回答後に実装方針を確定する。

**スコープ外**

- `review` ロットの業務レビュー（番号訂正・解除・廃棄）の画面と状態遷移 → [ASSUMPTION] Q3 回答後に別ストーリーとする
- 個体識別番号の外部照会 → [ASSUMPTION] 扱わない（連携 IF の定義がない）
- 正方向・逆方向トレース画面 → E-07-S01
- 入荷詳細での法定 ID 表示 → E-03-S04
- 出荷先への米の産地情報の伝達 → 設計に記載なし（§10 #8）

## 6. 主要業務フロー

**正常系（牛・10桁）**

1. warehouse が明細で CHI-001 を選ぶと、「法定トレース：牛」バッジと「牛個体識別番号（10桁）」欄が表示される。
2. 10桁の番号を入力し、温度・ロケーションなどを入れて確定する。
3. BFF と SQL が V12 を検査し、ロット（`available`）と `lot_regulated_ids`（`BEEF_INDIVIDUAL`、`ok`）を同じトランザクションで作る。

**代替フロー**

- **A1 米**：AMB-001 を選ぶと産地欄と取引欄が表示される。両方を入れて確定すると `RICE_ORIGIN`・`RICE_TRADE` の2行が作られる。
- **A2 牛・9桁（暫定案）**：140812345 のような9桁を入れると、画面に「9桁のため業務レビューに回します（自動補正はしません）」と表示され、結果は保留に固定、ロケーション欄は隔離ロケーション（-Q）だけになる。確定すると、ロットは C-Q に `review` で作られ、明細には `BEEF_ID_REVIEW` が記録される。
- **A3 社内ロット**：`internal_lot` の SKU では入力欄を表示せず、`lot_regulated_ids` も作らない。

**例外フロー**

- **E1 米の産地または取引が空**：422 `RICE_TRACE_REQUIRED`「米（米トレーサビリティ法）：産地・取引は必須です。」
- **E2 牛の番号が9桁・10桁以外、または数字以外を含む**：422 `BEEF_ID_INVALID`「牛個体識別番号は10桁の数字で入力してください。」
- **E3 9桁を `accepted`＋通常ロケーションで送信（直接 API 呼び出し）**：[ASSUMPTION] 422 `BEEF_ID_REVIEW`「牛個体識別番号が9桁です。業務レビューに回してください（自動補正はしません）。」。通常在庫には入れない。
- **E4 Q3 の回答が「受入拒否」の場合**：9桁は常に 422 `BEEF_ID_REVIEW` で確定できない。
- **E5 共通エラー**：未ログイン 401、権限なし 403、ロット番号重複 409、DB 到達不可 503。伝票全体をロールバックし、入力値を保持する。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| トレースレーン | `products.trace_lane`（`rice`／`beef`／`internal_lot`） | 表示のみ | 入力欄の出し分けに使う |
| 米：産地 | `lot_regulated_ids`（`id_type='RICE_ORIGIN'`、`value`） | 編集可 | 必須（拒否明細を除く）。[ASSUMPTION] 自由記述 |
| 米：取引 | `lot_regulated_ids`（`id_type='RICE_TRADE'`、`value`） | 編集可 | 必須（拒否明細を除く）。[ASSUMPTION] 自由記述 |
| 牛：個体識別番号 | `lot_regulated_ids`（`id_type='BEEF_INDIVIDUAL'`、`value`） | 編集可 | 10桁の数字。9桁は入力どおり保存 |
| 検証状態 | `lot_regulated_ids.verification_status`（`ok`／`review`） | 表示のみ（SQL 算出） | 9桁 → `review` |
| 明細結果・理由 | `inbound_lines.result`、`inbound_lines.result_reason` | 表示のみ（9桁時は SQL が決定） | 9桁 → `hold`／`BEEF_ID_REVIEW` |
| ロット状態 | `lots.status` | 表示のみ | 9桁 → `review`。[ASSUMPTION] `review` ロットは引当対象外 |
| ロケーション | `inbound_lines.location_id` → `locations`（9桁時は `is_quarantine=true`） | 編集可 | CHI-001 は冷蔵 → C-Q |
| （使わない列） | プロトタイプの `inbound_lines.trace_code`／`lots.trace_code` | — | 目標設計では作らない（D-09） |

## 8. 技術的制約・非機能面の考慮

- **DR-TRACE-01**：法定 ID は種別付きで保存し、種別と値で検索できること。index (`id_type`, `value`) を作る。
- **BR-TRACE-01／02／03**：TS（`traceability-rules` 相当、入力ガイド）と SQL（`confirm_inbound_receipt`、最終関門）で同じ判定・同じエラーコードを返す。
- **ADR-001**：書き込みは `confirm_inbound_receipt` のみ。`authenticated` は `lot_regulated_ids` に直接書けない。
- **ADR-006**：ローカル環境のみで検証する。
- **D-018**：米トレーサビリティ法・牛トレーサビリティ法の要件は、設計凍結前と本番稼働前に原典を再確認する（OPS-LAW-01）。
- **NFR**：NFR-AUD-01、NFR-LOC-01、DR-RET-01（トレース記録の 3年保持）、NFR-PERF-02（3年分のトレース検索 ≦ 60秒、本ストーリーは index を用意）。
- **関連要件**：FR-TRC-01／02、FE-34、FR-REC-02〜05。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] Given CHI-001、When 10桁の個体識別番号で確定する、Then ロットが `available` で作られ、`lot_regulated_ids` に `BEEF_INDIVIDUAL`・`verification_status='ok'` が1行できる（pgTAP + E2E）〔D-005〕
- [ ] AMB-001 で産地・取引を入力すると `RICE_ORIGIN`・`RICE_TRADE` の2行ができ、どちらかが空なら `RICE_TRACE_REQUIRED`（422）になる（unit + pgTAP）〔D-005〕
- [ ] 9桁（暫定案）：値は9桁のまま保存され（ゼロ埋め・切り捨てなし）、ロットは C-Q に `review`、明細は `hold`・`BEEF_ID_REVIEW`、`verification_status='review'` になる。Q3 の回答が「拒否」なら 422 `BEEF_ID_REVIEW` で何も書かれない（pgTAP + E2E）〔D-005〕
- [ ] 8桁・11桁・英字や記号を含む値は `BEEF_ID_INVALID`（422）になる（unit + pgTAP）
- [ ] `BEEF_INDIVIDUAL` で10桁以外かつ `verification_status='ok'` の行は DB の CHECK により書けない（pgTAP）〔D-011〕
- [ ] `internal_lot` の SKU では入力欄が表示されず `lot_regulated_ids` も作られない。拒否明細では法定 ID がなくても確定できる（E2E + pgTAP）
- [ ] TS と SQL が同じ入力に同じエラーコードを返す（同一ケース表で unit と pgTAP を実行）〔D-019〕
- [ ] `lot_regulated_ids` に index (`id_type`, `value`) があり、種別と値で検索できる（pgTAP）〔D-005〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | 未決（Q3）：牛個体識別番号が9桁のとき、受入拒否か、保留（隔離・`review`）か。暫定案は保留 | 01-system-overview-and-scope.md §1.7 | お客様 | M-02（2026-10-30） |
| 2 | [ASSUMPTION] 米は「産地」「取引」の2欄に分けて入力する | DR-TRACE-01 と `lot_regulated_ids` の種別（`RICE_ORIGIN`／`RICE_TRADE`） | お客様 | M-02（2026-10-30） |
| 3 | [ASSUMPTION] 産地・取引は自由記述（形式・コード体系の指定なし） | 設計書に形式の定義がない | お客様 | M-02（2026-10-30） |
| 4 | [ASSUMPTION] `review` ロットは引当対象外（チェーン③と同等に扱う） | 目標設計は `review` 状態を定義するが、引当チェーン上の扱いは未記載 | テックリード | M-03（2026-11-27） |
| 5 | [ASSUMPTION] `review` ロットの解除・訂正フローは本ストーリーで扱わず、Q3 回答後に別ストーリーとする | 状態遷移「(新規) → review」のみ定義済み | PM | M-03（2026-11-27） |
| 6 | [ASSUMPTION] 個体識別番号の外部照会は行わない | 連携 IF（F10）に定義がない | PM／お客様 | M-02（2026-10-30） |
| 7 | [ASSUMPTION] 9桁を `accepted`＋通常ロケーションで送ったときは 422 `BEEF_ID_REVIEW` とする | 9桁を通常在庫に入れない原則から推定 | テックリード | S2 開始（2026-12-14） |
| 8 | 未決：出荷先への米の産地情報の伝達方法が設計にない | 法令の再確認（D-018）で要否を確認する | お客様／PM | M-03（2026-11-27） |
| 9 | [ASSUMPTION] エラーメッセージの日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 10 | 未決：Q3 の回答が M-02 までに得られない場合は暫定案で実装し、回答後に差分対応する。E-03-S01 と同じスプリントでの依存もある | schedule.md §3（依存：E-03-S01, Q3） | PM | M-02（2026-10-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-03-S03 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-005, D-011, D-018, D-019）
- 関連機能ID：SCR-07, FE-34（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：DR-TRACE-01, DR-RET-01, NFR-AUD-01, NFR-LOC-01, NFR-PERF-02, BR-TRACE-01／02／03, FR-TRC-01／02, OPS-LAW-01
- 画面仕様：[scr-07-inbound-inspection.md](../../../docs/03-detail-design/scr-07-inbound-inspection.md)（§3.2 No.16, §3.4 V11・V12, §7）
- ルール：[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-TRACE-01／02、§2.1、§6）
- 基本設計：[01-system-overview-and-scope.md](../../../docs/01-basic-design/01-system-overview-and-scope.md)（§1.1, §1.7 Q3）
- ワイヤーフレーム：[wireframe-02-inbound-inventory.md](../../../docs/02-wireframes/wireframe-02-inbound-inventory.md)（WF-03 明細3）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§3.2, §4.3 `lot_regulated_ids`）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-09, D-11）
- 関連ストーリー：[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-03-S04](story-E-03-S04-inbound-receipt-list-and-detail.md)、E-07-S01

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
