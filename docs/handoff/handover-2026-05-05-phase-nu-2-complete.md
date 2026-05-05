# 引き継ぎ書 v12 — Phase ν-2 完走 + Step 0 設計確定

**作成日時**: 2026-05-05 (Phase ν-2 完走 + Step 0 設計確定後)
**前バージョン**: v11 (Phase ν-1 完走)
**最新コミット**: `4306c06` (Phase ν-2 完了: 既存対話データの削除と意思決定記録)

---

## 0. このドキュメントの読み方

Phase ν-2(既存データ移行)が **本日のセッションで完走** し、続く Phase ν-3 の前提整備として **Step 0(既存 API/スキーマの整合性修正)** の設計議論を行いました。

明日以降のセッションで Step 0 実装から再開するため、以下の順序で読んでください:

1. **§1 Phase ν-2 完走の状態**(3 分)— 何が完了したか
2. **§2 Step 0 の必要性と方針**(10 分)— 致命的発見と対応方針
3. **§3 Step 0 実装手順**(10 分)— 明日からのタスク
4. **§4 学び 73**(5 分)— ドキュメントと実態の乖離
5. **§5 致命的欠陥制覇の更新**(3 分)— 8/8 → 11/11 へ
6. **§6 Phase ν-3 への準備**(参考)

§7 以降は本セッションの議論経緯を残した参考資料です。

---

## 1. Phase ν-2 完走の状態

### 1-1. 結論

**ν-2 は「既存データの削除」で完了**(移行ではない)。

### 1-2. 削除対象と件数

| テーブル | 削除前 | 削除後 |
|---|---|---|
| ow_threads | 4 件 | 0 件 |
| ow_messages | 10 件 | 0 件 |
| ow_casual_meetings | 0 件 | 0 件(変化なし) |
| ow_mentor_reservations | 0 件 | 0 件(変化なし) |

### 1-3. 判断根拠

1. 全 4 thread が同一 candidate_id (`4a0decfa-...`) → seed データと判定
2. 企業名(Salesforce / Ubie / LayerX / freee)が動作確認用ラインナップ
3. status / sender_type の分散が UI 状態網羅テスト的
4. 移行コスト > 価値:
   - ID 体系変換 (auth.users.id → ow_users.id)
   - sender_type='system' に対応するロールが新スキーマに不在
   - ow_threads の非正規化カラム(company_name/last_message/unread_count)を新スキーマ(正規化)に再構成する必要
   - A-1 制約(UNIQUE NULLS NOT DISTINCT)との整合確認

### 1-4. バックアップ

- `/Users/hisato/opinio-work/docs/backups/ow_threads_backup_2026-05-05.txt`
- `.gitignore` で除外済み(git 管理外)
- 念のため、テストデータ確定済みなので復元する可能性は低い

### 1-5. 関連コミット

```
4306c06 Phase ν-2 完了: 既存対話データの削除と意思決定記録
7c53b87 Phase ν-1: 対話基盤の DB 構造を確立
```

---

## 2. Step 0 の必要性と方針

### 2-1. なぜ Step 0 が必要か

Phase ν-3(求職者側 UI)の実装に入る前に、Phase ν-1 で見落とされた **データモデルの不整合** が複数発覚しました。これらを解決しない限り、ν-3 の対話生成ロジック(F)が正しく動作しません。

### 2-2. 発見された 4 つの問題

| # | 問題 | 緊急度 | スコープ |
|---|---|---|---|
| 1 | `ow_job_applications.user_id` が `auth.users` を FK 参照 | 🔴 高 | migration 必要 |
| 2 | `ow_mentors` と `ow_users` を繋ぐカラムなし | 🔴 高 | migration 必要 |
| 3 | `dashboard/job-tracking/page.tsx` の旧 ow_threads 参照 | 🟡 中 | コード修正 |
| 4 | `/api/casual-request/route.ts` 死んだコード | 🟢 低 | ファイル削除 |

### 2-3. 確定した方針

**選択肢 A(王道):全部きちんと解決してから ν-3 に進む**

- 学び 71/72 の精神に最も忠実
- 技術的負債を増やさない
- ν-3 完走後の品質が最高
- 想定所要時間: **半日〜1 日**

### 2-4. ow_mentors の確定情報(本日の調査結果)

#### 結論: `mentors` テーブルは存在しない

CLAUDE.md の記述「mentors テーブル(10件、Phase 5 Stage 1 で使用)」は **誤記**。実際の DB には `ow_mentors` のみ存在。

#### ow_mentors の現状

| 項目 | 状態 |
|---|---|
| 件数 | 30 件 |
| データ性質 | 全件テストデータ("メンター_001"〜"メンター_030") |
| created_at | 全件 2026-05-01(自動生成スクリプトで投入) |
| user_id カラム | **存在しない** |
| ow_users への FK | **なし** |
| ow_users との名前マッチ | 0 件 |
| current_role の異常 | "supabase_read_only_user"(DB ロール名が混入)|

#### 参照箇所(12 箇所)

```
src/lib/supabase/queries.ts       — getMentors() / getMentorById()
src/app/(jobseeker)/mypage/page.tsx
src/app/career-consultation/page.tsx
src/app/career-consultation/[id]/page.tsx
src/app/admin/consultation-cases/new/page.tsx
src/app/admin/mentors/page.tsx
src/app/api/mentor-reservations/route.ts
src/app/api/consultation/book/route.ts
```

#### ow_mentor_reservations の現状

- 件数: 0 件
- mentor_user_id カラム: 存在(ow_users への FK あり)
- mentor_id カラム: 存在(ow_mentors への FK)
- 移行リスク: **ゼロ**(0 件のため)

### 2-5. 設計判断の確定事項

#### 判断 1: ow_mentors の実装方針 → **案 2-α**

- `ow_mentors.user_id UUID REFERENCES ow_users(id)` カラム追加
- メンター = ow_users としても登録される前提
- ν-5(メンター側 UI)でメンター本人がログインして対話する想定

#### 判断 2: 既存テストデータ 30 件の扱い → **明日確定する**

選択肢:
- α: NULL 放置(`user_id=NULL` で残す)
- β: 全件 DELETE
- γ: 一部削除+残す

未確定。Step 0-2 実装時に決める。

#### 判断 3: UNIQUE 制約の有無 → **明日確定する**

「1 ユーザー = 1 メンタープロフィール」を保証するか議論が必要。

---

## 3. Step 0 実装手順(明日のタスク)

### 3-1. 全体フロー

```
Step 0-0: 朝の確認
  └─ v12 を再読、本日の判断を再確認

Step 0-1: 問題 1 解決 — ow_job_applications.user_id 修正
  ├─ 既存データの確認(件数、auth_id → ow_users.id 変換可能性)
  ├─ migration 061 作成: FK 先を ow_users に変更
  ├─ 既存データの変換 SQL 作成
  ├─ SQL Editor で実行(柴さん)
  ├─ schema_migrations 更新
  ├─ /api/applications/route.ts に resolveOwUserId() 追加
  └─ 動作確認

Step 0-2: 問題 2 解決 — ow_mentors.user_id 追加
  ├─ テストデータの扱い決定(α/β/γ から選択)
  ├─ UNIQUE 制約の有無決定
  ├─ migration 062 作成
  ├─ SQL Editor で実行(柴さん)
  ├─ schema_migrations 更新
  ├─ /api/mentor-reservations/route.ts の mentor_user_id 解決ロジック追加
  └─ 動作確認

Step 0-3: 問題 3 解決 — dashboard/job-tracking ページ
  ├─ ページの利用実態確認(ナビゲーションから到達可能か)
  ├─ 削除 or 新スキーマ準拠に書き直し
  └─ 削除の場合: ファイル削除のみ

Step 0-4: 問題 4 解決 — /api/casual-request 削除
  └─ ファイル削除(呼び出し元 0 件確認済)

Step 0-Z: commit + push
  └─ Phase ν-2.5 として記録(または Phase ν-3 前提整備として)

→ Phase ν-3 本体へ
```

### 3-2. 想定 migration ファイル

```
supabase/migrations/
  061_fix_ow_job_applications_user_id_fk.sql
  062_add_ow_mentors_user_id.sql
```

### 3-3. resolveOwUserId() の共通化(オプション)

現在、4 ファイルにコピペ実装されている:
```
src/app/api/casual-meetings/route.ts
src/app/api/mentor-reservations/route.ts
src/app/api/bookmarks/route.ts
src/app/api/jobseeker/experiences/route.ts
```

Step 0-1 で applications にも追加する際に、共通関数 `src/lib/auth/resolveOwUserId.ts` に抽出するか議論する(YAGNI で後回しも可)。

### 3-4. Step 0 完了の判定基準

以下の全てが満たされた時点で Step 0 完了:

- [ ] migration 061/062 が DDL 適用 + schema_migrations 記録 + ローカルファイル保存(学び 72)
- [ ] /api/applications が resolveOwUserId() を使用
- [ ] /api/mentor-reservations が mentor_user_id を正しくセット(null でない)
- [ ] dashboard/job-tracking ページが解決済み(削除 or 修正)
- [ ] /api/casual-request 削除済み
- [ ] git commit + push 済み
- [ ] 動作確認: 求職者として求人応募 → ow_job_applications に正しい ow_users.id で INSERT
- [ ] 動作確認: 求職者としてメンター予約 → ow_mentor_reservations に mentor_user_id が NOT NULL で INSERT

---

## 4. 学び 73:ドキュメントと実態の乖離

### 4-1. 発見

CLAUDE.md に「mentors テーブル(10件、Phase 5 Stage 1 で使用)」と記述されていたが、実際の DB には `mentors` テーブルが存在しない。`ow_mentors` のみ。

### 4-2. 学び 71/72 との関係

```
学び 71: 「適用済み」の二重定義
  └─ DDL の物理適用 vs schema_migrations への記録

学び 72: 「適用済み」の三重定義
  └─ 上記 + ローカルファイル保存

学び 73(新): 「ドキュメント記載」と「実態」の乖離
  └─ プロジェクトドキュメント(CLAUDE.md 等)の記述が
     実際の DB やコードと一致しているとは限らない
```

### 4-3. 原則

**ドキュメントの記述は信頼できる「設計意図」だが、信頼できる「現在状態」ではない**。

実装作業を始める前には、必ず以下を確認する:

1. テーブルの存在確認(information_schema.tables)
2. カラムの存在確認(information_schema.columns)
3. FK 制約の確認(information_schema.table_constraints)
4. データ件数の確認(SELECT COUNT(*))
5. 関連コードの参照箇所(grep)

これら 5 つが揃って初めて「現状を把握した」と言える。

### 4-4. 適用範囲

学び 73 はドキュメント全般に適用:
- CLAUDE.md
- 引き継ぎ書(v11 等)
- コメント
- README

これらは全て「過去のある時点の記述」であり、「現在の真実」ではない。

---

## 5. 致命的欠陥制覇の更新

### 5-1. v11 までの状態

「致命的欠陥制覇 8/8 完全制覇継続中」(v11 §8)

### 5-2. 本日発見された致命的欠陥

#### 欠陥 9: ow_job_applications.user_id の FK 先不整合
- ow_job_applications だけが auth.users を参照
- 他テーブル(ow_casual_meetings, ow_mentor_reservations)は ow_users を参照
- → テーブル間の参照基準が不統一

#### 欠陥 10: ow_mentors と ow_users の関係欠落
- ow_mentors に user_id カラムなし
- ow_users との FK もなし
- → kind=mentor の対話がそもそも作れない状態だった

#### 欠陥 11: ドキュメントと実態の乖離
- CLAUDE.md の「mentors テーブル」記述
- 実際は存在しない
- → 学び 73 として制度化

### 5-3. 更新後の状態

```
致命的欠陥制覇: 8/11 → Step 0 完了で 11/11 を目指す
```

明日の Step 0 完了時に、欠陥 9/10/11 を制覇したと宣言できる状態にする。

---

## 6. Phase ν-3 への準備(参考)

### 6-1. ν-3 確定スコープ(本日確定)

| # | 要素 | 分類 |
|---|---|---|
| A | 対話一覧画面 | 🟢 ν-3 |
| B | 対話詳細画面 | 🟢 ν-3 |
| C | メッセージ送信フォーム | 🟢 ν-3 |
| D | 既読処理 | 🟢 ν-3 |
| E | 未読表示(boolean) | 🟢 ν-3 |
| F | 対話の生成トリガー | 🟢 ν-3 (最小実装) |
| G | リアルタイム更新 | ⚫ YAGNI |
| H | ナビゲーション統合 | 🟢 ν-3 |

### 6-2. F の実装方針(本日確定)

| 求職者のアクション | 連動する対話生成 | 構造 |
|---|---|---|
| 求人応募 | ow_conversations 1件 | kind=company, stage=active |
| カジュアル面談 | ow_conversations 1件 | kind=company, stage=active |
| メンター予約 | ow_conversations 1件 | kind=mentor, stage=mediated |

A-1 制約への配慮: `INSERT ... ON CONFLICT DO NOTHING` + `SELECT id` パターン

### 6-3. 実装順序(本日確定)

**案 Z(縦割り)** で進める:

```
Step 0(明日): 既存問題の修正
  ↓
Step 1: F の実装(対話生成トリガー)
Step 2: H + A(ナビゲーション + 一覧画面)
Step 3: B + C + D(詳細 + 送信 + 既読)
Step 4: E(未読表示)
```

### 6-4. ν-3 で必要な主要クエリ(v11 §4-4 から再掲)

```sql
-- 1. 自分が参加中の対話一覧
SELECT c.*, ...
FROM ow_conversations c
JOIN ow_conversation_participants p ON p.conversation_id = c.id
WHERE p.user_id = auth.uid()
  AND p.left_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;

-- 2. 対話の未読数
SELECT COUNT(m.id) AS unread_count
FROM ow_conversation_messages m
LEFT JOIN ow_message_reads r 
  ON r.message_id = m.id AND r.participant_id = $my_participant_id
WHERE m.conversation_id = $conv_id
  AND m.deleted_at IS NULL
  AND r.message_id IS NULL;

-- 3. 対話のメッセージ取得
SELECT m.*, 
  CASE WHEN r.message_id IS NOT NULL THEN true ELSE false END AS is_read
FROM ow_conversation_messages m
LEFT JOIN ow_message_reads r 
  ON r.message_id = m.id AND r.participant_id = $my_participant_id
WHERE m.conversation_id = $conv_id
  AND m.deleted_at IS NULL
ORDER BY m.sent_at;
```

ただし、クエリ 1 の `p.user_id = auth.uid()` は **問題あり**。`auth.uid()` は `auth.users.id` を返すが、`p.user_id` は `ow_users.id` を参照しているため、突き合わせられない。

正しくは:
```sql
WHERE p.user_id = (
  SELECT id FROM ow_users WHERE auth_id = auth.uid()
)
```

これは ν-3 実装時に注意。

---

## 7. 本セッションの議論経緯(参考資料)

### 7-1. Phase ν-2 の判断プロセス

```
件数調査 → ow_threads 4件 / ow_messages 10件
  ↓
データ詳細調査 → 全件 candidate_id 同一、企業名分散、status 4種網羅
  ↓
テストデータと判定 → DELETE 選択
  ↓
バックアップ → DELETE 実行 → 0件確認 → commit/push
```

### 7-2. Step 0 設計の判断プロセス

```
ν-3 実装状況調査 → 3 API すべてパターン1(UI+INSERT実装済)
  ↓
ただし問題1〜4を発見
  ↓
選択肢 A(全解決)/B(最小)/C(動的解決)/D(スコープ縮小) を検討
  ↓
A を選択(王道)
  ↓
ow_mentors の実態調査 → 30件テストデータ、ow_users と FK なし
  ↓
mentors テーブル探索 → 存在しない、CLAUDE.md の誤記と判明
  ↓
学び 73 として制度化
  ↓
本日は v12 作成までで終了、Step 0 実装は明日
```

---

## 8. 次セッションの開始テンプレート

### パターン A: Step 0 をすぐ始める(推奨)

```
おはよう。引き継ぎ書 v12 を読んでください。
Phase ν-3 の前提整備として Step 0 を始めます。

まず Step 0-1(問題 1: ow_job_applications.user_id 修正)から
進めましょう。最初に既存データの状況確認を Claude Code に依頼してください。
```

### パターン B: Step 0 の方針を見直したい

```
おはよう。引き継ぎ書 v12 を読んでください。
Step 0 の方針について [具体的な点] を見直したいです。
```

### パターン C: 別の課題を優先したい

```
おはよう。引き継ぎ書 v12 を読んでください。
Step 0 は一旦保留して、[別の課題] を優先したいです。
```

---

## 9. 数字で見るセッション

- 完走した Phase: ν-2(想定 1 日 → 半日以下)
- 削除したデータ: ow_threads 4件 + ow_messages 10件
- 確定した設計判断: 8 つ(スコープ確定 8 要素 + F の最小実装案 + 案 2-α など)
- 発見した致命的欠陥: 3 つ(問題 1, 2, ドキュメント誤記)
- 制度化した学び: 1 つ(学び 73)
- 作成したコミット: 1 つ(4306c06)

---

## 10. 最後に

### 本セッションの意義

Phase ν-2 を半日以下で完走し、続く Phase ν-3 の前提整備(Step 0)を **実装する前に設計議論で完全に詰めた** セッションでした。

これが可能になった要因:
1. 引き継ぎ書 v11 が詳細だったため、ν-2 開始の判断が即座にできた
2. 三者協働モデル(チャット Claude + Claude Code + 柴さん)が機能した
3. データ件数調査 → スキーマ調査 → 関連コード調査 という段階的な情報収集
4. 致命的発見(問題 1〜4 + ドキュメント誤記)を都度記録

### 本セッションで生まれた疑問

明日の Step 0 実装時に確認すべき:

- ow_job_applications の既存データ件数と auth_id → ow_users.id 変換可能性(Step 0-1 の前提)
- ow_mentors テストデータ 30件の扱い(α/β/γ)
- UNIQUE 制約の有無(ow_mentors.user_id)
- dashboard/job-tracking の利用実態
- resolveOwUserId() の共通化要否

### Phase ν 全体の進捗

```
ν-0 設計確定          ✅ 完了
ν-1 DB migration      ✅ 完了
ν-2 既存データ移行    ✅ 完了 (= 削除)
  ↓
Step 0 前提整備       📍 次セッション開始地点
  ↓
ν-3 求職者側 UI
  ↓
ν-4 企業側 UI
  ↓
ν-5 メンター側 UI
  ↓
ν-6 編集部 / 運営者 UI
  ↓
ν-7 旧テーブル廃止 + 動作確認
  ↓
🎉 Phase ν 完走 → Phase η(30 社投入)
```

Phase ν-2 完走、本当におめでとうございます 🎉

明日は Step 0 から進めましょう。
