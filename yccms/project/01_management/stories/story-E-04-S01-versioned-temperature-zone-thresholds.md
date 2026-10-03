# E-04-S01: 3温度帯しきい値の版管理（Yuki 自社基準）

## 1. ストーリー情報

| 項目 | 内容 |
| --- | --- |
| ストーリーID | E-04-S01 |
| ストーリー名 | Ngưỡng 3 dải nhiệt có phiên bản (Yuki tự công bố)（和訳：3温度帯しきい値の版管理（Yuki 自社基準）） |
| 関連Epic | E-04（在庫・隔離・温度帯しきい値／F03） |
| 関連機能ID | SCR-32（schedule.md §3 の「関連 F-ID」列。function-list.md は未作成） |
| 優先度 | P0 |
| ステータス | 詳細記載済み |
| 作成日 | 2026-10-03 |

## 2. ユーザーストーリー

倉庫管理者（manager）として、常温・冷蔵・冷凍の3温度帯しきい値を Yuki の自社基準として適用開始日付きの版で管理し、別の承認者の承認を経て切り替えたい。なぜなら、入荷・出荷・温度監視の合否はすべてこの値で決まり、上書き変更では過去の判定根拠を説明できず、1人の入力ミスで全入荷が止まるおそれがあるからだ。

## 3. 背景・目的

- 3温度帯のしきい値は業界標準値ではなく、Yuki が自社基準として公表した値：常温 15〜25°C、冷蔵 0〜5°C、冷凍 −18°C 以下。すべて設定から読み、コードに書かない（BR-TEMP-01、R-01）。
- BR-TEMP-01 はしきい値を「適用開始日による版管理」とすることを求め、DR-MST-01 は maker-checker を求める。プロトタイプは現在値を上書きし、トリガーで前後値を監査に残すだけで、過去の判定根拠を答えられず、承認者もいない（D-05、D-06）。さらに DB に `min_c <= max_c` などの CHECK がなく、manager が PostgREST を直接呼ぶと不正な値を書けた（D-21）。
- ADR-004 に従い、`temperature_zone_versions` と `change_requests` で版と承認を管理する。本ストーリーで作る読み取り関数 `zone_range_at(zone_id, date)` は、入荷検品（E-03-S01／S02）、出荷時温度チェック（E-05-S03）、ロガー評価（E-11-S01）が共通で使う。

## 4. 対象ユーザー

| ロールコード | 本ストーリーでの利用 | 差異 |
| --- | --- | --- |
| `manager`（倉庫管理者） | しきい値変更の申請、承認（自分の申請以外） | 主利用者 |
| `qa`（品質管理） | しきい値変更の申請 | [ASSUMPTION] 承認不可（§10 #2） |
| `admin`（システム管理） | しきい値変更の申請、承認（自分の申請以外） | [ASSUMPTION] 承認可 |
| `warehouse` / `sales` / `auditor` | 閲覧のみ（入力欄は無効、申請ボタンなし） | — |

## 5. スコープ

**スコープ内**

- テーブル：`temperature_zones`（`id`、`code` は ambient／chilled／frozen、`name`）と `temperature_zone_versions`（`zone_id`、`min_c`、`max_c`、`effective_from`、`effective_to`、`approved_by`）。CHECK「`min_c` と `max_c` の少なくとも一方は NOT NULL」「`min_c <= max_c`」、同じ温度帯で期間の重なりを禁止する EXCLUDE（`btree_gist`）。
- 初期版のシード：常温 15〜25、冷蔵 0〜5、冷凍 `max_c=-18`（`min_c` NULL）。`effective_from` は [ASSUMPTION] 開発用の過去日（§10 #1）。
- 読み取り関数 `zone_range_at(zone_id, date)`：指定日に有効な版を1件返す。TS 側はこの関数の結果を使い、独自に判定期間を計算しない。
- SCR-32 のしきい値部分（`/settings`）：3温度帯の現行版と予定版（`effective_from` が未来）を表示し、変更申請フォーム（min、max、適用開始日）を提供する。
- 変更は `change_requests` を経由する（E-02-S03 の仕組みを使う）。承認すると `decide_change_request` が1トランザクションで新しい版を作り、前の版の `effective_to` を閉じる。
- 承認前に影響を表示する：対象温度帯の在庫ロット数、未出荷オーダー明細数（ADR-004 §4）。
- 監査：版テーブルへの `audit_config_change`（前後値）と、`change.request`／`change.approve`／`change.reject`。
- `authenticated` には `temperature_zones`／`temperature_zone_versions` への直接 insert／update／delete を与えない（D-06、D-21 の解消）。

**スコープ外**

- SKU の期限種別・期限間近日数の版管理（`product_versions`）→ E-02-S02／E-02-S03
- 承認待ちキュー画面の共通部分 → E-02-S03
- ロガー測定値のしきい値再評価 → E-11-S01（仮）
- 緊急時の変更手順（ADR-004「2名オンライン」など）→ §10 #7
- 温度帯の追加・コード変更（ambient／chilled／frozen の3つで固定）

## 6. 主要業務フロー

**正常系**

1. manager が `/settings` を開く。3温度帯の現行版（例：冷蔵 0〜5°C、適用開始日）と、あれば予定版が表示される。
2. 冷蔵の max を変更し、適用開始日を入力して「変更を申請」を押す。BFF が値を検査し、`change_requests`（`pending`）を作る。監査ログに `change.request` が残る。
3. 別の manager（または admin）が承認待ちを開き、影響（対象温度帯の在庫ロット数、未出荷オーダー明細数）と前後値を確認して承認する。
4. `decide_change_request` が「承認者 ≠ 申請者」を確認し、新しい版を作って前の版の `effective_to` を新しい版の `effective_from` で閉じる。監査ログに `change.approve` と版の前後値が残る。
5. 適用開始日以降の入荷日・出荷日の判定には新しい版が使われ、それより前の判定は前の版のまま残る。

**代替フロー**

- **A1 却下**：承認者がメモを入れて却下すると、申請は `rejected` になり版は作られない。

**例外フロー**

- **E1 入力不正**：min／max が数値でない → 422「しきい値は数値で入力してください」。両方空 → 422「min か max の少なくとも一方を入力してください」。min > max → 422「min は max 以下にしてください」。
- **E2 適用開始日が過去**：[ASSUMPTION] 422「適用開始日は今日以降にしてください」。
- **E3 同じ温度帯に承認待ちの申請がある**：409（`change_requests` の部分 UK）。
- **E4 同じ温度帯に予定版がある状態での新規申請**：[ASSUMPTION] 409「予定版があるため申請できません」。
- **E5 自己承認**：403 `SELF_APPROVAL`（CHECK `decided_by <> requested_by`）。
- **E6 却下メモなし**：422 `REASON_REQUIRED`。
- **E7 権限なし**：warehouse／sales／auditor が API を直接呼ぶと 403「しきい値を変更できるのは権限のあるロールのみです」。
- **E8 有効な版がない日付で判定しようとした**：[ASSUMPTION] `zone_range_at` が例外 `NO_ACTIVE_ZONE_VERSION` を出し、その入荷・出荷の確定を止める。
- **E9 共通エラー**：未ログイン 401、DB 到達不可 503。編集中の値は保持する。

## 7. データ要件

| 項目 | 取得元（目標設計 テーブル.列） | 表示のみ／編集可 | 備考 |
| --- | --- | --- | --- |
| 温度帯コード・名称 | `temperature_zones.code`、`name` | 表示のみ | 3件固定 |
| 下限（°C） | `temperature_zone_versions.min_c`（numeric(5,1)） | 申請で編集可 | 空＝下限なし |
| 上限（°C） | `temperature_zone_versions.max_c`（numeric(5,1)） | 申請で編集可 | 空＝上限なし。min ≦ max |
| 適用開始日 | `temperature_zone_versions.effective_from`（date、JST） | 申請で編集可 | 開始日を含む |
| 適用終了日 | `temperature_zone_versions.effective_to` | 表示のみ（承認時に自動） | 終了日を含まない。NULL＝有効中 |
| 承認者 | `temperature_zone_versions.approved_by` → `app_users` | 表示のみ | |
| 申請内容 | `change_requests.entity`、`entity_id`、`payload_before`、`payload_after`、`effective_from` | 申請時に作成 | |
| 申請状態 | `change_requests.status`（`pending`／`approved`／`rejected`／`cancelled`） | 表示のみ | |
| 申請者・承認者・メモ | `change_requests.requested_by`、`decided_by`、`decision_note`、`decided_at` | 承認時に編集可（メモ） | 申請者 ≠ 承認者 |
| 影響件数 | `lots`（温度帯の在庫ロット数）、`outbound_lines`（未出荷明細数） | 表示のみ | [ASSUMPTION] テーブル作成前は0件または非表示（§10 #6） |
| 監査ログ | `audit_logs`（`change.*`、版テーブルの前後値） | 画面表示なし（SCR-34 で閲覧） | |

## 8. 技術的制約・非機能面の考慮

- **ADR-004**：版は `effective_from`（含む）〜`effective_to`（含まない）。判定はすべて `zone_range_at(date)` 経由で行い、日付条件の書き忘れを防ぐ。`btree_gist` 拡張を有効にする。
- **ADR-001**：版の作成は `decide_change_request`（`SECURITY DEFINER`）のみ。`authenticated` に直接書き込み権限を与えない。
- **ADR-006**：ローカル（Supabase CLI／Docker）のみで開発・検証する。
- **しきい値をコードに書かない**：BR-TEMP-01。シードとテスト fixture 以外に数値を置かない。
- **日付**：適用開始日は JST の業務日付。前日・当日・翌日の境界テストを必須とする。
- **NFR／要件**：NFR-SEC-02（maker-checker、RBAC）、NFR-AUD-01（追記のみの監査）、NFR-LOC-01（日本語 UI・JST）、DR-MST-01（master の適用日管理＋承認）、BR-TEMP-01、R-01。
- **他ストーリーとの関係**：E-02-S03（change request 基盤）と同じスプリント S1 で実装する。

## 9. 受入基準

> **このセクションは空にしない。** 後続の設計作業と `pm-create-tasks` の根拠になる。

- [ ] シード後、3温度帯それぞれに有効な版がちょうど1件あり、値は常温 15〜25°C、冷蔵 0〜5°C、冷凍 −18°C 以下（`min_c` NULL）である（pgTAP）〔D-001〕
- [ ] `zone_range_at` が、版の切り替え日の前日・当日・翌日でそれぞれ正しい版を返す（pgTAP + unit）〔D-019〕
- [ ] `min_c > max_c`、`min_c`・`max_c` ともに NULL の版は DB の CHECK で拒否され、同じ温度帯で期間が重なる版は EXCLUDE で拒否される（pgTAP）〔D-011〕
- [ ] Given manager A の申請、When manager B が承認する、Then 新しい版が1件でき、前の版の `effective_to` が閉じる（1トランザクション）。A 自身が承認すると `SELF_APPROVAL`（403）で拒否される（pgTAP + E2E）〔D-011〕
- [ ] `authenticated` は `temperature_zones`／`temperature_zone_versions` に直接 insert／update／delete できない（pgTAP RLS）〔D-011〕
- [ ] warehouse／sales／auditor は画面で閲覧のみ（入力欄は無効、申請ボタンなし）で、API を直接呼ぶと 403 になる（E2E + API テスト）
- [ ] 申請・承認・却下と版の作成が、それぞれ前後値つきで監査ログに残る（pgTAP）〔D-011〕
- [ ] アプリコードと SQL 関数にしきい値の数値が直書きされておらず、版を切り替えると E-03-S02 の入荷判定が変わる（コードレビュー + pgTAP）〔D-015〕
- [ ] 承認画面に対象温度帯の在庫ロット数と未出荷オーダー明細数が表示される（E2E。件数の扱いは §10 #6）
- [ ] 画面のラベル・メッセージが日本語、日付が `yyyy/mm/dd` で表示される（E2E）〔D-014〕

## 10. 前提・未決事項

| # | `[ASSUMPTION]` / 未決事項 | 根拠 | 確認者 | 期限 |
| --- | --- | --- | --- | --- |
| 1 | [ASSUMPTION] 初期版の `effective_from` は、開発・テスト・移行用に過去日（例：2026-01-01）でシードし、本番の値はお客様が決める | D-05 は「しきい値は本番稼働日を初版の適用開始日」とするが、それでは稼働前の入荷検証・移行データに有効版がない | お客様 | M-03（2026-11-27） |
| 2 | [ASSUMPTION] 承認者は manager または admin（申請者以外）とする。qa は申請のみ | 権限マトリクスは申請（change request の作成）だけを定め、承認者を定義していない | お客様 | M-02（2026-10-30） |
| 3 | [ASSUMPTION] 適用開始日は JST の今日以降に限る（遡及変更は不可） | 遡及すると過去の入荷判定の根拠と食い違う | お客様 | M-02（2026-10-30） |
| 4 | [ASSUMPTION] 予定版がある温度帯には新しい申請を出せない（409） | 予定版の差し替え手順が設計にない。期間重複を単純に避けるため | テックリード | S1 開始（2026-11-30） |
| 5 | [ASSUMPTION] 有効な版がない日付の判定は `NO_ACTIVE_ZONE_VERSION` で止める | `zone_range_at` の該当なし時の挙動が設計にない | テックリード | S1 開始（2026-11-30） |
| 6 | [ASSUMPTION] 影響件数は対象テーブルができてから表示する。S1 時点では `lots`（E-04-S03、S2）と `outbound_lines`（E-05、2027-01）が未作成のため0件または非表示 | schedule.md のスプリント順 | PM | S1 開始（2026-11-30） |
| 7 | 未決：緊急時の変更手順（ADR-004：「2名の manager がオンラインで即時承認」または「admin の時間外承認」） | ADR-004 の「悪い結果」に記載、未決定 | お客様 | M-03（2026-11-27） |
| 8 | 未決：入荷時のしきい値の基準日（SCR-07「確定時点」と ADR-004「入荷日」の不一致）。本ストーリーの `zone_range_at` は呼び出し側が渡した日付で判定する | 設計書間の不一致 | テックリード | M-03（2026-11-27） |
| 9 | [ASSUMPTION] エラーメッセージの日本語文言は仕様（ベトナム語）からの訳案。最終文言は E-13-S01 で確定 | NFR-LOC-01 | PM | M-03（2026-11-27） |
| 10 | 未決：E-02-S03（change request 基盤）と同じスプリント S1（2026-11-30〜12-11）での依存。E-02-S03 が遅れると承認フローを結合できない | schedule.md §3（依存：E-02-S03） | PM | S1 開始（2026-11-30） |

## 11. 関連ドキュメント

- WBS：[schedule.md §3（E-04-S01 行）](../schedule.md)
- 完了の定義：[define-dod.md](../define-dod.md)（D-001, D-011, D-014, D-015, D-019）
- 関連機能ID：SCR-32（function-list.md は未作成のため schedule.md のコードを暫定キーとして使用）
- 関連 NFR／要件：NFR-SEC-02, NFR-AUD-01, NFR-LOC-01, DR-MST-01, BR-TEMP-01, R-01
- 画面仕様：[scr-32-02-settings-thresholds-sku.md](../../../docs/03-detail-design/scr-32-02-settings-thresholds-sku.md)（§2〜§8）、[00-common-screen-rules.md](../../../docs/03-detail-design/00-common-screen-rules.md)
- API・ルール：[api-specification.md](../../../docs/03-detail-design/api-specification.md)（A17, A18）、[business-rules-and-state-machines.md](../../../docs/03-detail-design/business-rules-and-state-machines.md)（BR-TEMP-01、§4）
- 基本設計：[02-architecture-and-data-flow.md](../../../docs/01-basic-design/02-architecture-and-data-flow.md)（§2.6.6）、[03-screen-list-navigation-and-permissions.md](../../../docs/01-basic-design/03-screen-list-navigation-and-permissions.md)（§3.3）
- ワイヤーフレーム：[wireframe-04-master-trace-audit.md](../../../docs/02-wireframes/wireframe-04-master-trace-audit.md)（WF-11）
- ADR：[ADR-001](../../../docs/04-adr/adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md)、[ADR-004](../../../docs/04-adr/adr-004-effective-dated-master-with-change-requests.md)、[ADR-006](../../../docs/04-adr/adr-006-local-first-development-with-supabase-cli.md)
- DB：[01-er-diagram-and-table-design.md](../../../docs/05-database/01-er-diagram-and-table-design.md)（§4.2, §5）、[02-prototype-vs-design-comparison.md](../../../docs/05-database/02-prototype-vs-design-comparison.md)（D-05, D-06, D-21）
- 関連ストーリー：E-02-S03、[E-03-S01](story-E-03-S01-create-and-inspect-inbound-receipt.md)、[E-03-S02](story-E-03-S02-temperature-deviation-reject-or-quarantine-hold.md)、E-05-S03、E-11-S01

## 12. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-stories skill | 新規作成（LAB-4 設計書・DoD・RFP から導出） |
