# タスク一覧 — YCCMS

> 作業の集約ビュー。各タスクの詳細は GitHub Issue に記載し、本ファイルは索引と状態を管理する。タスクは必ず `schedule.md` §3 のストーリーの子とする（孤立タスクなし）。
> フェーズ：**開発・実装**（詳細化済みストーリー 24 件が対象）。工数根拠：LAB-1 見積（シート 04 画面 S/M/C、シート 07 エンジン）をストーリーに配分、E-10 は PM 承認済み配分。**1 SP ≈ 1 人日（8 時間）**、タスクの SP をストーリー・Epic へ積み上げる。担当者は役割ベースの仮名（GitHub アカウント未割当）。
> **ステータス：PM 承認済み（2026-10-03）。GitHub Issue・GitHub Project（sun-thanhta / Project #3）登録済み。**

## 1. タスク

| T-ID | GitHub Issue | タスク名 | 関連WBS ID | 担当者 | ステータス | 開始日 | 終了日 | 更新日 | コメント | SP | 見積時間(h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | [#3](https://github.com/sun-thanhta/freezer-warehouse/issues/3) | バックエンド実装（API・サービス）（ログイン・アクセスゲート） | E-01-S01 | BE開発者B（仮） | 進行中 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み・P0 で基盤一部実装済み | 1 | 10 |
| T-002 | [#4](https://github.com/sun-thanhta/freezer-warehouse/issues/4) | フロントエンド実装（画面）（ログイン・アクセスゲート） | E-01-S01 | FE開発者A（仮） | 進行中 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み・P0 で基盤一部実装済み | 1 | 10 |
| T-003 | [#6](https://github.com/sun-thanhta/freezer-warehouse/issues/6) | バックエンド実装（DB・SQL関数・RLS）（ロール・RBAC 基盤） | E-01-S02 | BE開発者A（仮） | 進行中 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み・P0 で基盤一部実装済み | 1 | 9.5 |
| T-004 | [#7](https://github.com/sun-thanhta/freezer-warehouse/issues/7) | バックエンド実装（API・サービス）（ロール・RBAC 基盤） | E-01-S02 | BE開発者B（仮） | 進行中 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み・P0 で基盤一部実装済み | 1 | 6.5 |
| T-005 | [#9](https://github.com/sun-thanhta/freezer-warehouse/issues/9) | バックエンド実装（DB・SQL関数・RLS）（追記専用（append-only）監査ログ） | E-01-S03 | BE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 3 | 23.5 |
| T-006 | [#10](https://github.com/sun-thanhta/freezer-warehouse/issues/10) | バックエンド実装（API・サービス）（追記専用（append-only）監査ログ） | E-01-S03 | BE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 1 | 10.5 |
| T-007 | [#11](https://github.com/sun-thanhta/freezer-warehouse/issues/11) | フロントエンド実装（画面）（追記専用（append-only）監査ログ） | E-01-S03 | FE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-008 | [#15](https://github.com/sun-thanhta/freezer-warehouse/issues/15) | バックエンド実装（DB・SQL関数・RLS）（基礎データ（仕入先・顧客・納品先・ロケーション（-Q））＋ RFP フィクスチャ） | E-02-S01 | BE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 17 |
| T-009 | [#16](https://github.com/sun-thanhta/freezer-warehouse/issues/16) | バックエンド実装（API・サービス）（基礎データ（仕入先・顧客・納品先・ロケーション（-Q））＋ RFP フィクスチャ） | E-02-S01 | BE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 1 | 7 |
| T-010 | [#18](https://github.com/sun-thanhta/freezer-warehouse/issues/18) | バックエンド実装（DB・SQL関数・RLS）（SKU マスタ（期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン）） | E-02-S02 | BE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-011 | [#19](https://github.com/sun-thanhta/freezer-warehouse/issues/19) | バックエンド実装（API・サービス）（SKU マスタ（期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン）） | E-02-S02 | BE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 13 |
| T-012 | [#20](https://github.com/sun-thanhta/freezer-warehouse/issues/20) | フロントエンド実装（画面）（SKU マスタ（期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン）） | E-02-S02 | FE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 3 | 21 |
| T-013 | [#22](https://github.com/sun-thanhta/freezer-warehouse/issues/22) | バックエンド実装（DB・SQL関数・RLS）（設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004）） | E-02-S03 | BE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 16 |
| T-014 | [#23](https://github.com/sun-thanhta/freezer-warehouse/issues/23) | バックエンド実装（API・サービス）（設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004）） | E-02-S03 | BE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 1 | 9.5 |
| T-015 | [#24](https://github.com/sun-thanhta/freezer-warehouse/issues/24) | フロントエンド実装（画面）（設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004）） | E-02-S03 | FE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 1 | 6.5 |
| T-016 | [#26](https://github.com/sun-thanhta/freezer-warehouse/issues/26) | バックエンド実装（DB・SQL関数・RLS）（顧客×SKU 契約（納品期限 1/3・1/2・ラベル期限のみ の確定）） | E-02-S04 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-017 | [#27](https://github.com/sun-thanhta/freezer-warehouse/issues/27) | バックエンド実装（API・サービス）（顧客×SKU 契約（納品期限 1/3・1/2・ラベル期限のみ の確定）） | E-02-S04 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-018 | [#28](https://github.com/sun-thanhta/freezer-warehouse/issues/28) | フロントエンド実装（画面）（顧客×SKU 契約（納品期限 1/3・1/2・ラベル期限のみ の確定）） | E-02-S04 | FE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 3 | 24 |
| T-019 | [#30](https://github.com/sun-thanhta/freezer-warehouse/issues/30) | バックエンド実装（API・サービス）（顧客別配送履歴（DR-HIST-01）） | E-02-S05 | BE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 1 | 8 |
| T-020 | [#31](https://github.com/sun-thanhta/freezer-warehouse/issues/31) | フロントエンド実装（画面）（顧客別配送履歴（DR-HIST-01）） | E-02-S05 | FE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 1 | 8 |
| T-021 | [#34](https://github.com/sun-thanhta/freezer-warehouse/issues/34) | バックエンド実装（DB・SQL関数・RLS）（入荷伝票の作成と検品（温度・ロット・期限・同一温度帯ロケーション）） | E-03-S01 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 16 |
| T-022 | [#35](https://github.com/sun-thanhta/freezer-warehouse/issues/35) | バックエンド実装（API・サービス）（入荷伝票の作成と検品（温度・ロット・期限・同一温度帯ロケーション）） | E-03-S01 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 10 |
| T-023 | [#36](https://github.com/sun-thanhta/freezer-warehouse/issues/36) | フロントエンド実装（画面）（入荷伝票の作成と検品（温度・ロット・期限・同一温度帯ロケーション）） | E-03-S01 | FE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 14 |
| T-024 | [#38](https://github.com/sun-thanhta/freezer-warehouse/issues/38) | バックエンド実装（DB・SQL関数・RLS）（温度逸脱時の拒否または保留（隔離ロケーション -Q への格納）） | E-03-S02 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 5 |
| T-025 | [#39](https://github.com/sun-thanhta/freezer-warehouse/issues/39) | バックエンド実装（API・サービス）（温度逸脱時の拒否または保留（隔離ロケーション -Q への格納）） | E-03-S02 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 2.5 |
| T-026 | [#40](https://github.com/sun-thanhta/freezer-warehouse/issues/40) | フロントエンド実装（画面）（温度逸脱時の拒否または保留（隔離ロケーション -Q への格納）） | E-03-S02 | FE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 5 |
| T-027 | [#42](https://github.com/sun-thanhta/freezer-warehouse/issues/42) | バックエンド実装（DB・SQL関数・RLS）（入荷時の法定トレース（米：産地・取引、牛：個体識別番号10桁、9桁は業務レビュー）） | E-03-S03 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 14 |
| T-028 | [#43](https://github.com/sun-thanhta/freezer-warehouse/issues/43) | バックエンド実装（API・サービス）（入荷時の法定トレース（米：産地・取引、牛：個体識別番号10桁、9桁は業務レビュー）） | E-03-S03 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 5.5 |
| T-029 | [#44](https://github.com/sun-thanhta/freezer-warehouse/issues/44) | フロントエンド実装（画面）（入荷時の法定トレース（米：産地・取引、牛：個体識別番号10桁、9桁は業務レビュー）） | E-03-S03 | FE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 8.5 |
| T-030 | [#46](https://github.com/sun-thanhta/freezer-warehouse/issues/46) | バックエンド実装（API・サービス）（入荷伝票の一覧と詳細） | E-03-S04 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 3 |
| T-031 | [#47](https://github.com/sun-thanhta/freezer-warehouse/issues/47) | フロントエンド実装（画面）（入荷伝票の一覧と詳細） | E-03-S04 | FE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 5 |
| T-032 | [#51](https://github.com/sun-thanhta/freezer-warehouse/issues/51) | バックエンド実装（DB・SQL関数・RLS）（3温度帯しきい値の版管理（Yuki 自社基準）） | E-04-S01 | BE開発者A（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 16 |
| T-033 | [#52](https://github.com/sun-thanhta/freezer-warehouse/issues/52) | バックエンド実装（API・サービス）（3温度帯しきい値の版管理（Yuki 自社基準）） | E-04-S01 | BE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 1 | 7 |
| T-034 | [#53](https://github.com/sun-thanhta/freezer-warehouse/issues/53) | フロントエンド実装（画面）（3温度帯しきい値の版管理（Yuki 自社基準）） | E-04-S01 | FE開発者B（仮） | 未着手 | 2026-11-30 | 2026-12-11 | 2026-10-03 | Issue 作成済み | 2 | 12.5 |
| T-035 | [#55](https://github.com/sun-thanhta/freezer-warehouse/issues/55) | バックエンド実装（API・サービス）（多条件の在庫照会と期限間近・期限切れの表示） | E-04-S02 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 14.5 |
| T-036 | [#56](https://github.com/sun-thanhta/freezer-warehouse/issues/56) | フロントエンド実装（画面）（多条件の在庫照会と期限間近・期限切れの表示） | E-04-S02 | FE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 3 | 21.5 |
| T-037 | [#58](https://github.com/sun-thanhta/freezer-warehouse/issues/58) | バックエンド実装（DB・SQL関数・RLS）（在庫移動台帳（マイナス在庫・温度帯外格納の禁止）） | E-04-S03 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-038 | [#59](https://github.com/sun-thanhta/freezer-warehouse/issues/59) | バックエンド実装（API・サービス）（在庫移動台帳（マイナス在庫・温度帯外格納の禁止）） | E-04-S03 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 1 | 9.5 |
| T-039 | [#61](https://github.com/sun-thanhta/freezer-warehouse/issues/61) | バックエンド実装（DB・SQL関数・RLS）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（1/2） | E-04-S04 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 3 | 21 |
| T-040 | [#62](https://github.com/sun-thanhta/freezer-warehouse/issues/62) | バックエンド実装（DB・SQL関数・RLS）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（2/2） | E-04-S04 | BE開発者A（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 3 | 21 |
| T-041 | [#63](https://github.com/sun-thanhta/freezer-warehouse/issues/63) | バックエンド実装（API・サービス）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（1/2） | E-04-S04 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 13 |
| T-042 | [#64](https://github.com/sun-thanhta/freezer-warehouse/issues/64) | バックエンド実装（API・サービス）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（2/2） | E-04-S04 | BE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 13 |
| T-043 | [#65](https://github.com/sun-thanhta/freezer-warehouse/issues/65) | フロントエンド実装（画面）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（1/2） | E-04-S04 | FE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-044 | [#66](https://github.com/sun-thanhta/freezer-warehouse/issues/66) | フロントエンド実装（画面）（隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄）（2/2） | E-04-S04 | FE開発者B（仮） | 未着手 | 2026-12-14 | 2026-12-25 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-045 | [#70](https://github.com/sun-thanhta/freezer-warehouse/issues/70) | バックエンド実装（API・サービス）（出荷オーダー一覧と除外チェーンによる出荷前事前チェック） | E-05-S01 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-046 | [#71](https://github.com/sun-thanhta/freezer-warehouse/issues/71) | フロントエンド実装（画面）（出荷オーダー一覧と除外チェーンによる出荷前事前チェック） | E-05-S01 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-047 | [#73](https://github.com/sun-thanhta/freezer-warehouse/issues/73) | バックエンド実装（引当ルールエンジン TS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（1/3） | E-05-S02 | ソリューションアーキテクト（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-048 | [#74](https://github.com/sun-thanhta/freezer-warehouse/issues/74) | バックエンド実装（引当ルールエンジン TS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（2/3） | E-05-S02 | ソリューションアーキテクト（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-049 | [#75](https://github.com/sun-thanhta/freezer-warehouse/issues/75) | バックエンド実装（引当ルールエンジン TS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（3/3） | E-05-S02 | ソリューションアーキテクト（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-050 | [#76](https://github.com/sun-thanhta/freezer-warehouse/issues/76) | バックエンド実装（DB・SQL関数・RLS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（1/3） | E-05-S02 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-051 | [#77](https://github.com/sun-thanhta/freezer-warehouse/issues/77) | バックエンド実装（DB・SQL関数・RLS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（2/3） | E-05-S02 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-052 | [#78](https://github.com/sun-thanhta/freezer-warehouse/issues/78) | バックエンド実装（DB・SQL関数・RLS）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（3/3） | E-05-S02 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-053 | [#79](https://github.com/sun-thanhta/freezer-warehouse/issues/79) | バックエンド実装（API・サービス）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（1/2） | E-05-S02 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 20.5 |
| T-054 | [#80](https://github.com/sun-thanhta/freezer-warehouse/issues/80) | バックエンド実装（API・サービス）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（2/2） | E-05-S02 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 20.5 |
| T-055 | [#81](https://github.com/sun-thanhta/freezer-warehouse/issues/81) | フロントエンド実装（画面）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（1/3） | E-05-S02 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-056 | [#82](https://github.com/sun-thanhta/freezer-warehouse/issues/82) | フロントエンド実装（画面）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（2/3） | E-05-S02 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-057 | [#83](https://github.com/sun-thanhta/freezer-warehouse/issues/83) | フロントエンド実装（画面）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（3/3） | E-05-S02 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 18 |
| T-058 | [#84](https://github.com/sun-thanhta/freezer-warehouse/issues/84) | テスト実装（TS/SQL 整合・R-06 フィクスチャ）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（1/2） | E-05-S02 | テストリード（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 20.5 |
| T-059 | [#85](https://github.com/sun-thanhta/freezer-warehouse/issues/85) | テスト実装（TS/SQL 整合・R-06 フィクスチャ）（引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO）（2/2） | E-05-S02 | テストリード（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 20.5 |
| T-060 | [#87](https://github.com/sun-thanhta/freezer-warehouse/issues/87) | バックエンド実装（DB・SQL関数・RLS）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（1/2） | E-05-S03 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-061 | [#88](https://github.com/sun-thanhta/freezer-warehouse/issues/88) | バックエンド実装（DB・SQL関数・RLS）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（2/2） | E-05-S03 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-062 | [#89](https://github.com/sun-thanhta/freezer-warehouse/issues/89) | バックエンド実装（API・サービス）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（1/2） | E-05-S03 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 12.5 |
| T-063 | [#90](https://github.com/sun-thanhta/freezer-warehouse/issues/90) | バックエンド実装（API・サービス）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（2/2） | E-05-S03 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 12.5 |
| T-064 | [#91](https://github.com/sun-thanhta/freezer-warehouse/issues/91) | フロントエンド実装（画面）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（1/2） | E-05-S03 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 15 |
| T-065 | [#92](https://github.com/sun-thanhta/freezer-warehouse/issues/92) | フロントエンド実装（画面）（出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴））（2/2） | E-05-S03 | FE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 15 |
| T-066 | [#95](https://github.com/sun-thanhta/freezer-warehouse/issues/95) | バックエンド実装（API・サービス）（出荷前の日付逆転アラート画面） | E-06-S01 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 6.5 |
| T-067 | [#96](https://github.com/sun-thanhta/freezer-warehouse/issues/96) | フロントエンド実装（画面）（出荷前の日付逆転アラート画面） | E-06-S01 | FE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 9.5 |
| T-068 | [#98](https://github.com/sun-thanhta/freezer-warehouse/issues/98) | バックエンド実装（DB・SQL関数・RLS）（日付逆転の例外申請と承認（起票者 ≠ 承認者）） | E-06-S02 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 2 | 16 |
| T-069 | [#99](https://github.com/sun-thanhta/freezer-warehouse/issues/99) | バックエンド実装（API・サービス）（日付逆転の例外申請と承認（起票者 ≠ 承認者）） | E-06-S02 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 9 |
| T-070 | [#100](https://github.com/sun-thanhta/freezer-warehouse/issues/100) | フロントエンド実装（画面）（日付逆転の例外申請と承認（起票者 ≠ 承認者）） | E-06-S02 | FE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 11 |
| T-071 | [#102](https://github.com/sun-thanhta/freezer-warehouse/issues/102) | バックエンド実装（DB・SQL関数・RLS）（不変の例外ログ（BR-DATE-01／BR-EXP-02）） | E-06-S03 | BE開発者A（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 8 |
| T-072 | [#103](https://github.com/sun-thanhta/freezer-warehouse/issues/103) | バックエンド実装（API・サービス）（不変の例外ログ（BR-DATE-01／BR-EXP-02）） | E-06-S03 | BE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 3 |
| T-073 | [#104](https://github.com/sun-thanhta/freezer-warehouse/issues/104) | フロントエンド実装（画面）（不変の例外ログ（BR-DATE-01／BR-EXP-02）） | E-06-S03 | FE開発者B（仮） | 未着手 | 2027-01-04 | 2027-01-15 | 2026-10-03 | Issue 作成済み | 1 | 5 |
| T-074 | [#107](https://github.com/sun-thanhta/freezer-warehouse/issues/107) | バックエンド実装（DB・SQL関数・RLS）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（1/2） | E-07-S01 | BE開発者A（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 17 |
| T-075 | [#108](https://github.com/sun-thanhta/freezer-warehouse/issues/108) | バックエンド実装（DB・SQL関数・RLS）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（2/2） | E-07-S01 | BE開発者A（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 17 |
| T-076 | [#109](https://github.com/sun-thanhta/freezer-warehouse/issues/109) | バックエンド実装（API・サービス）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（1/2） | E-07-S01 | BE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 17 |
| T-077 | [#110](https://github.com/sun-thanhta/freezer-warehouse/issues/110) | バックエンド実装（API・サービス）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（2/2） | E-07-S01 | BE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 17 |
| T-078 | [#111](https://github.com/sun-thanhta/freezer-warehouse/issues/111) | フロントエンド実装（画面）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（1/2） | E-07-S01 | FE開発者A（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-079 | [#112](https://github.com/sun-thanhta/freezer-warehouse/issues/112) | フロントエンド実装（画面）（順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票））（2/2） | E-07-S01 | FE開発者A（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 3 | 22.5 |
| T-080 | [#117](https://github.com/sun-thanhta/freezer-warehouse/issues/117) | バックエンド実装（DB・SQL関数・RLS）（運用ダッシュボード（KPI）） | E-08-S01 | BE開発者A（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 3 | 21.5 |
| T-081 | [#118](https://github.com/sun-thanhta/freezer-warehouse/issues/118) | バックエンド実装（API・サービス）（運用ダッシュボード（KPI）） | E-08-S01 | BE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 3 | 21.5 |
| T-082 | [#119](https://github.com/sun-thanhta/freezer-warehouse/issues/119) | フロントエンド実装（画面）（運用ダッシュボード（KPI））（1/2） | E-08-S01 | FE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 14.5 |
| T-083 | [#120](https://github.com/sun-thanhta/freezer-warehouse/issues/120) | フロントエンド実装（画面）（運用ダッシュボード（KPI））（2/2） | E-08-S01 | FE開発者B（仮） | 未着手 | 2027-01-18 | 2027-01-29 | 2026-10-03 | Issue 作成済み | 2 | 14.5 |

## 1.1 Epic・ストーリー別の見積（GitHub Project に登録する階層）

| WBS ID | 種別 | 名称 | スプリント | SP | 見積時間(h) | タスク数 | 担当者（仮） | ステータス | 工数根拠 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [E-01](https://github.com/sun-thanhta/freezer-warehouse/issues/1) | Epic | ログイン・権限・監査ログ | 2026-11-30〜2026-12-11 | 15 | 128 | 7 | PM（仮） | 進行中 | ストーリー合計 |
| [E-01-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/2) | Story | ログイン・アクセスゲート | S1 | 2 | 20 | 2 | テックリード（仮） | 進行中 | SCR-00 S 2.5 MD |
| [E-01-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/5) | Story | ロール・RBAC 基盤 | S1 | 2 | 16 | 2 | テックリード（仮） | 進行中 | [仮] P-NFR から 2 MD |
| [E-01-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/8) | Story | 追記専用（append-only）監査ログ | S1 | 6 | 52 | 3 | テックリード（仮） | 未着手 | SCR-34 S 2.5 + ENG-10 監査分 4 MD |
| [E-01-S04](https://github.com/sun-thanhta/freezer-warehouse/issues/12) | Story（仮） | IdP 連携による SSO＋MFA | TBD | 5 | 40 | 0 | PM（仮） | 未着手 | [仮] P-NFR/ENG-09(OIDC) から 5 MD |
| [E-02](https://github.com/sun-thanhta/freezer-warehouse/issues/13) | Epic | マスタ・顧客×SKU契約 | 2026-11-30〜2027-01-29 | 23 | 184 | 13 | PM（仮） | 未着手 | ストーリー合計 |
| [E-02-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/14) | Story | 基礎データ（仕入先・顧客・納品先・ロケーション（-Q））＋ RFP フィクスチャ | S1 | 3 | 24 | 2 | テックリード（仮） | 未着手 | [仮] estimate に該当行なし 3 MD |
| [E-02-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/17) | Story | SKU マスタ（期限種別（賞味/消費）・期限接近しきい値・トレーサビリティレーン） | S1 | 7 | 52 | 3 | テックリード（仮） | 未着手 | SCR-02 M 4.5 + ENG-03 期限種別分 2 MD |
| [E-02-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/21) | Story | 設定のバージョン管理＋メーカー・チェッカー型変更申請（ADR-004） | S1 | 4 | 32 | 3 | テックリード（仮） | 未着手 | ENG-07 メーカーチェッカー分 4 MD |
| [E-02-S04](https://github.com/sun-thanhta/freezer-warehouse/issues/25) | Story | 顧客×SKU 契約（納品期限 1/3・1/2・ラベル期限のみ の確定） | S2 | 7 | 60 | 3 | テックリード（仮） | 未着手 | SCR-03 M 4.5 + ENG-03 ウィンドウ分 3 MD |
| [E-02-S05](https://github.com/sun-thanhta/freezer-warehouse/issues/29) | Story | 顧客別配送履歴（DR-HIST-01） | S4 | 2 | 16 | 2 | テックリード（仮） | 未着手 | [仮] SCR-03 内 S10 2 MD |
| [E-03](https://github.com/sun-thanhta/freezer-warehouse/issues/32) | Epic | 入荷・検品 | 2026-12-14〜2026-12-25 | 19 | 124.5 | 11 | PM（仮） | 未着手 | ストーリー合計 |
| [E-03-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/33) | Story | 入荷伝票の作成と検品（温度・ロット・期限・同一温度帯ロケーション） | S2 | 5 | 40 | 3 | テックリード（仮） | 未着手 | SCR-07 C 9 のうち 5 MD |
| [E-03-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/37) | Story | 温度逸脱時の拒否または保留（隔離ロケーション -Q への格納） | S2 | 3 | 12.5 | 3 | テックリード（仮） | 未着手 | SCR-07 のうち 1.5 MD |
| [E-03-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/41) | Story | 入荷時の法定トレース（米：産地・取引、牛：個体識別番号10桁、9桁は業務レビュー） | S2 | 4 | 28 | 3 | テックリード（仮） | 未着手 | SCR-07 のうち 1.5 + ENG-06 法定トレース分 2 MD |
| [E-03-S04](https://github.com/sun-thanhta/freezer-warehouse/issues/45) | Story | 入荷伝票の一覧と詳細 | S2 | 2 | 8 | 2 | テックリード（仮） | 未着手 | SCR-07 のうち 1 MD |
| [E-03-S05](https://github.com/sun-thanhta/freezer-warehouse/issues/48) | Story（仮） | 入荷予約と仕入先参照番号の重複警告 | TBD | 5 | 36 | 0 | PM（仮） | 未着手 | SCR-06 M 4.5 MD |
| [E-04](https://github.com/sun-thanhta/freezer-warehouse/issues/49) | Epic | 在庫・隔離・温度帯しきい値 | 2026-11-30〜2026-12-25 | 36 | 279.5 | 13 | PM（仮） | 未着手 | ストーリー合計 |
| [E-04-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/50) | Story | 3温度帯しきい値の版管理（Yuki 自社基準） | S1 | 5 | 35.5 | 3 | テックリード（仮） | 未着手 | SCR-32 M 4.5 MD |
| [E-04-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/54) | Story | 多条件の在庫照会と期限間近・期限切れの表示 | S2 | 5 | 36 | 2 | テックリード（仮） | 未着手 | SCR-08 M 4.5 MD |
| [E-04-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/57) | Story | 在庫移動台帳（マイナス在庫・温度帯外格納の禁止） | S2 | 4 | 32 | 2 | テックリード（仮） | 未着手 | ENG-07 在庫移動分 4 MD |
| [E-04-S04](https://github.com/sun-thanhta/freezer-warehouse/issues/60) | Story | 隔離ロットの解除（同一温度帯の通常ロケーションへ）と廃棄 | S2 | 14 | 104 | 6 | テックリード（仮） | 未着手 | SCR-10 C 9 + ENG-07 隔離分 4 MD |
| [E-04-S05](https://github.com/sun-thanhta/freezer-warehouse/issues/67) | Story（仮） | ロケーション・格納先提案とブラインド棚卸（2 段階承認） | TBD | 8 | 72 | 0 | PM（仮） | 未着手 | SCR-09 M 4.5 + SCR-11 M 4.5 MD |
| [E-05](https://github.com/sun-thanhta/freezer-warehouse/issues/68) | Epic | 出荷・引当・出荷前検品 | 2027-01-04〜2027-01-15 | 54 | 407 | 21 | PM（仮） | 未着手 | ストーリー合計 |
| [E-05-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/69) | Story | 出荷オーダー一覧と除外チェーンによる出荷前事前チェック | S3 | 4 | 36 | 2 | テックリード（仮） | 未着手 | SCR-12 M 4.5 MD |
| [E-05-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/72) | Story | 引当除外チェーン（①消費期限 ②温度帯 ③隔離 ④納品期限 ⑤日付逆転）→ FEFO/FIFO | S3 | 36 | 271 | 13 | テックリード（仮） | 未着手 | SCR-13 C 9 + ENG-01 14 + ENG-02 8 + ENG-03 3 MD |
| [E-05-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/86) | Story | 出荷前検品と出荷確定（最も低温の温度帯で測温、不変の納品履歴） | S3 | 14 | 100 | 6 | テックリード（仮） | 未着手 | SCR-15 M 4.5 + ENG-01 8 MD |
| [E-06](https://github.com/sun-thanhta/freezer-warehouse/issues/93) | Epic | 日付逆転アラート・メーカーチェッカー | 2027-01-04〜2027-01-15 | 9 | 68 | 8 | PM（仮） | 未着手 | ストーリー合計 |
| [E-06-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/94) | Story | 出荷前の日付逆転アラート画面 | S3 | 2 | 16 | 2 | テックリード（仮） | 未着手 | SCR-05 M 4.5 のうち 2 MD |
| [E-06-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/97) | Story | 日付逆転の例外申請と承認（起票者 ≠ 承認者） | S3 | 4 | 36 | 3 | テックリード（仮） | 未着手 | SCR-05 のうち 2.5 + ENG-02 2 MD |
| [E-06-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/101) | Story | 不変の例外ログ（BR-DATE-01／BR-EXP-02） | S3 | 3 | 16 | 3 | テックリード（仮） | 未着手 | ENG-02 2 MD |
| [E-07](https://github.com/sun-thanhta/freezer-warehouse/issues/105) | Epic | トレース・リコール | 2027-01-18〜2027-01-29 | 32 | 277 | 6 | PM（仮） | 未着手 | ストーリー合計 |
| [E-07-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/106) | Story | 順方向／逆方向トレース（ロット ↔ 顧客 ↔ 仕入先 ↔ 入荷伝票） | S4 | 14 | 113 | 6 | テックリード（仮） | 未着手 | SCR-27 C 9 + ENG-06 5 MD |
| [E-07-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/113) | Story（仮） | リコール案件と数量突合 | TBD | 13 | 128 | 0 | PM（仮） | 未着手 | SCR-28 C 9 + ENG-06 7 MD |
| [E-07-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/114) | Story（仮） | 版管理・承認付きリコール通知 | TBD | 5 | 36 | 0 | PM（仮） | 未着手 | SCR-29 M 4.5 MD |
| [E-08](https://github.com/sun-thanhta/freezer-warehouse/issues/115) | Epic | ダッシュボード・帳票 | 2027-01-18〜2027-01-29 | 26 | 224 | 4 | PM（仮） | 未着手 | ストーリー合計 |
| [E-08-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/116) | Story | 運用ダッシュボード（KPI） | S4 | 10 | 72 | 4 | テックリード（仮） | 未着手 | SCR-01 C 9 MD |
| [E-08-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/121) | Story（仮） | 運用帳票 12 種・KPI ダッシュボード | TBD | 8 | 84 | 0 | PM（仮） | 未着手 | SCR-30 M 4.5 + ENG-10 6 MD |
| [E-08-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/122) | Story（仮） | チェックサム付きマニフェストの監査エクスポート | TBD | 8 | 68 | 0 | PM（仮） | 未着手 | SCR-31 M 4.5 + ENG-10 4 MD |
| [E-09](https://github.com/sun-thanhta/freezer-warehouse/issues/123) | Epic | POD（車上渡し／軒先渡し）・返品（仮） | TBD〜TBD | 34 | 260 | 0 | PM（仮） | 未着手 | ストーリー合計 |
| [E-09-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/124) | Story（仮） | バーコード・シールによるピッキング・積込検品 | TBD | 8 | 72 | 0 | PM（仮） | 未着手 | SCR-14 C 9 MD |
| [E-09-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/125) | Story（仮） | 受渡条件別 POD（写真ハッシュ・オフラインキュー最大 8 時間） | TBD | 21 | 152 | 0 | PM（仮） | 未着手 | SCR-16 C 9 + ENG-08 10 MD |
| [E-09-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/126) | Story（仮） | 返品・クレーム | TBD | 5 | 36 | 0 | PM（仮） | 未着手 | SCR-17 M 4.5 MD |
| [E-10](https://github.com/sun-thanhta/freezer-warehouse/issues/127) | Epic | 配車・運転時間 2024 規制（仮） | TBD〜TBD | 42 | 360 | 0 | PM（仮） | 未着手 | ストーリー合計 |
| [E-10-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/128) | Story（仮） | 受注・車両温度帯・時間枠・サービス時間・デポ時間からの配車作成 | TBD | 8 | 72 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/129) | Story（仮） | 運転時間規制ルールの版管理（超勤 960h・拘束 3,300h/284h/13〜15h・休息 9〜11h・平均運転 9h/44h・連続運転 4h） | TBD | 3 | 24 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/130) | Story（仮） | 日内制約チェック（拘束 13〜15h・休息 9h・連続運転 4h、休憩自動挿入） | TBD | 5 | 40 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S04](https://github.com/sun-thanhta/freezer-warehouse/issues/131) | Story（仮） | 期間累計制約チェック（2 日・2 週・月・年） | TBD | 5 | 48 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S05](https://github.com/sun-thanhta/freezer-warehouse/issues/132) | Story（仮） | 運転時間チェック表：違反時は公開禁止・違反時間帯を明示 | TBD | 13 | 104 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S06](https://github.com/sun-thanhta/freezer-warehouse/issues/133) | Story（仮） | 版付きルート公開・変更理由・ドライバーへの最新版配信 | TBD | 8 | 72 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-10-S07](https://github.com/sun-thanhta/freezer-warehouse/issues/134) | Story（仮） | 事故・車両故障・災害の記録（遵守結果と分離） | TBD | 0 | 0 | 0 | PM（仮） | 未着手 | PM 承認済み配分（2026-10-03） MD |
| [E-11](https://github.com/sun-thanhta/freezer-warehouse/issues/135) | Epic | 温度ロガー監視・HACCP（仮） | TBD〜TBD | 47 | 404 | 0 | PM（仮） | 未着手 | ストーリー合計 |
| [E-11-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/136) | Story（仮） | 温度ロガー CSV 取込としきい値版による評価 | TBD | 21 | 196 | 0 | PM（仮） | 未着手 | SCR-22 M 4.5 + SCR-23 C 9 + ENG-05 8 + ENG-09(ロガー) 3 MD |
| [E-11-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/137) | Story（仮） | アラーム（SLA 15 分）・逸脱ケース・是正処置 | TBD | 21 | 156 | 0 | PM（仮） | 未着手 | SCR-24 M 4.5 + SCR-25 C 9 + ENG-05 6 MD |
| [E-11-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/138) | Story（仮） | HACCP 記録の完全性チェック | TBD | 5 | 52 | 0 | PM（仮） | 未着手 | SCR-26 M 4.5 + ENG-05 2 MD |
| [E-12](https://github.com/sun-thanhta/freezer-warehouse/issues/139) | Epic | 外部連携・ファイル授受（仮） | TBD〜TBD | 21 | 168 | 0 | PM（仮） | 未着手 | ストーリー合計 |
| [E-12-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/140) | Story（仮） | ERP 受注取込（SFTP CSV・スキーマ版・冪等性） | TBD | 13 | 100 | 0 | PM（仮） | 未着手 | SCR-35 M 4.5 + ENG-09(ERP) 8 MD |
| [E-12-S02](https://github.com/sun-thanhta/freezer-warehouse/issues/141) | Story（仮） | アラート・承認のメール通知とアーカイブ出力マニフェスト | TBD | 3 | 32 | 0 | PM（仮） | 未着手 | ENG-09(メール・アーカイブ) 4 MD |
| [E-12-S03](https://github.com/sun-thanhta/freezer-warehouse/issues/142) | Story（仮） | ファイル取込・出力の監視 | TBD | 5 | 36 | 0 | PM（仮） | 未着手 | SCR-36 M 4.5 MD |
| [E-13](https://github.com/sun-thanhta/freezer-warehouse/issues/143) | Epic | 多言語化・アクセシビリティ（仮） | TBD〜TBD | 8 | 64 | 0 | PM（仮） | 未着手 | ストーリー合計 |
| [E-13-S01](https://github.com/sun-thanhta/freezer-warehouse/issues/144) | Story（仮） | 日本語 UI・JST・WCAG 2.2 AA | TBD | 8 | 64 | 0 | PM（仮） | 未着手 | [仮] P-NFR から 8 MD |

## 2. ステータス定義

| ステータス | 意味 |
| --- | --- |
| 未着手 | Issue 登録済み、作業未開始 |
| 進行中 | 作業中 |
| レビュー中 | 実装完了、レビュー中 |
| 完了 | マージ・受入済み、Issue クローズ |
| 保留 | ブロック中（コメントに理由を記載） |

## 3. 規約

- **T-ID** は 3 桁ゼロ埋めの連番（`T-001`〜）。既存の最大値の次から採番する。本スキルが採番する唯一の ID。
- **タスク名と WBS ID** は `schedule.md` §3 とストーリー詳細をそのまま引き継ぐ。
- **重複防止**：（タスク名＋関連 WBS ID）の組で照合し、同じ行は作成しない。
- Issue 作成に失敗した場合は「GitHub Issue」を空欄にし、コメントに `Issue 未作成` と記載して再実行時に補完する。
- タスクは 1〜3 日（≤ 24 時間）。超える要素は（1/n）形式で分割。
- 仮ストーリー（仕様未確定）はタスクを分割しない（仕様確定後に本スキルを再実行）。

## 4. 改訂履歴

| 日付 | 更新者 | 内容 |
| --- | --- | --- |
| 2026-10-03 | pm-create-tasks skill | ドラフト作成：開発・実装フェーズのタスク 83 件（ストーリー 24 件分）、Epic 13・ストーリー 48 件の SP・見積時間・仮担当。GitHub Issue は承認待ち |
| 2026-10-03 | pm-create-tasks skill | PM 承認。GitHub Issue 144 件（Epic 13・ストーリー 48・タスク 83）を作成し、サブ Issue で Epic → ストーリー → タスクを紐づけ、Project #3 に登録（SP・見積時間・仮担当・種別・WBS ID・スプリント・開始日／終了日・ステータス） |
