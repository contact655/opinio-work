# 引き継ぎ書 v13 — Step 0 完走 + 致命的欠陥制覇 11/11

**作成日時**: 2026-05-05 (Step 0 完走後)
**前バージョン**: v12 (Phase ν-2 完走 + Step 0 設計確定)
**最新コミット**: `3b776e5` (Step 0-3 + 0-4: dead code 削除)

---

## 0. このドキュメントの読み方

Phase ν-3(求職者対話 UI)の前提整備として位置づけられた Step 0 が **本日のセッションで完走** しました。明日以降のセッションで Phase ν-3 から再開するため、以下の順序で読んでください:

1. **§1 Step 0 完走の状態**(3 分)— 何が完了したか
2. **§2 致命的欠陥制覇 11/11 完全制覇**(3 分)— 解消された欠陥
3. **§3 学び 74/75/76 の正式化**(10 分)— 今日発見した重要な学び
4. **§4 将来の宿題リスト**(5 分)— Phase ν-3 以降に持ち越す課題
5. **§5 Phase ν-3 への準備(更新版)**(10 分)— 明日からのスタート地点

§6 以降は本セッションの議論経緯を残した参考資料です。

---

## 関連ドキュメント

- `docs/product-insights.md`: プロダクト戦略・設計・UX レベルの気づきを記録。
  技術負債(本書 §4)とは性質が異なる、事業の根幹に関わる論点を集約。
  Phase η 前に議論が必要なエントリは要確認。

---

## 1. Step 0 完走の状態

### 1-1. 結論

**Step 0 は本日のセッションで完全に完走**。Phase ν-3 開始の前提整備が整った。

### 1-2. 各 Step の成果

| Step | 内容 | コミット |
|---|---|---|
| 0-1 | ow_job_applications.user_id を ow_users 参照に統一 | `a857e53` |
| 0-2 | ow_mentors.user_id 追加 + テストデータ削除 + API 修正 | `6dc8116` |
| 0-3 | dashboard/job-tracking ページ削除 | `3b776e5` |
| 0-4 | /api/casual-request 削除 | `3b776e5` |

### 1-3. 主要な変更

#### DB 変更(migration)

```
supabase/migrations/061_fix_ow_job_applications_user_id_fk.sql
supabase/migrations/062_add_ow_mentors_user_id.sql
```

#### 新規ファイル

```
src/lib/supabase/resolveOwUserId.ts
```

#### 修正ファイル

```
src/app/api/applications/route.ts            (resolveOwUserId 採用)
src/app/api/mentor-reservations/route.ts     (mentor_user_id 動的解決)
src/app/dashboard/page.tsx                   (Quick Link 削除)
```

#### 削除ファイル

```
src/app/api/casual-request/route.ts
src/app/dashboard/job-tracking/page.tsx
```

### 1-4. 動作確認の状態

**Step 0 は型チェックのみ通過**(`npx tsc --noEmit` で全て EXIT:0)。実動作確認は Phase ν-3 の F (応募 → 対話生成) 実装時に併せて実施予定。

DB 側に NOT NULL + ON DELETE RESTRICT が効いているため、API バグで NULL を入れようとしたら DB が止める。「黙って壊れる」最悪のケースは防がれている。

---

## 2. 致命的欠陥制覇 11/11 完全制覇

### 2-1. v12 までの状態

「致命的欠陥制覇 8/11」(v12 §5)— 欠陥 9, 10, 11 が未制覇。

### 2-2. 本日制覇した欠陥

| # | 欠陥 | 制覇手段 | Step |
|---|---|---|---|
| 9 | ow_job_applications.user_id の FK 先不整合 | migration 061 で ow_users 参照に統一 | 0-1 |
| 10 | ow_mentors と ow_users の関係欠落 | migration 062 で user_id カラム追加 | 0-2 |
| 11 | ドキュメントと実態の乖離 | 学び 73 として制度化(v12)+ 学び 74/75/76 を新規発見 | 0-1〜0-4 |

### 2-3. 更新後の状態

```
致命的欠陥制覇: 11/11 完全制覇 🏆
```

Phase ν-3 開始前に、想定された全ての致命的欠陥を解消。

---

## 3. 学び 74/75/76 の正式化

本セッションで 3 つの学びが発見され、いずれも実害が発生したため正式化する。

### 3-1. 学び 74: pg_constraint vs information_schema

#### 内容

`information_schema.referential_constraints` と `information_schema.constraint_column_usage` は `supabase_read_only_user` ロールから不可視のため、FK 制約の確認に使うと **常に 0 件** を返す。

正しい確認方法は `pg_constraint` を直接参照すること。

#### 実害

Step 0-1 で「ow_job_applications.user_id に FK 制約が存在しない」と最初に報告されたが、これは誤り。実際は `auth.users` への FK が存在していた。`pg_constraint` で再調査して判明。

#### 推奨パターン

```sql
-- ❌ 不可視(0 件返る)
SELECT * FROM information_schema.referential_constraints;

-- ✅ 正しい
SELECT
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'テーブル名'
  AND con.contype = 'f';  -- f=FK, p=PK, u=UNIQUE, c=CHECK
```

### 3-2. 学び 75: schema_migrations の所在とカラム

#### 内容

`schema_migrations` テーブルは `public` スキーマには **存在しない**。正しくは `supabase_migrations.schema_migrations`。

カラム構成は `(version text, name text, statements text[])` で、`executed_at` カラムは **存在しない**。

手動 INSERT 時は `statements=NULL` がパターン化されている(051 のみ supabase CLI 経由で実際の SQL が配列で格納)。

#### 実害

migration 061 が 1 回目の実行で失敗。原因は `INSERT INTO schema_migrations (version, name, executed_at)` がスキーマ名と存在しないカラム指定を含んでいたため。BEGIN/COMMIT で囲まれていたため DDL 群もロールバックされた。

#### 推奨パターン

```sql
-- ✅ 正しい INSERT
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('NNN', 'migration_name', NULL)
ON CONFLICT (version) DO NOTHING;
```

#### 補足: opinio-work の運用

- `supabase` CLI(`supabase db push` 等)は使用していない
- `package.json` に supabase 関連の script なし
- `supabase/config.toml` も不在
- migration は SQL Editor で手動実行 + ローカルファイル + schema_migrations への手動 INSERT の **三位一体**(学び 72)

### 3-3. 学び 76: SQL Editor のタブ管理

#### 内容

Supabase ダッシュボードの SQL Editor は **タブごとに独立した状態を保持**する。一度貼り付けた SQL は、ローカルファイルを修正しても **タブには反映されない**。古いクエリが残ったまま Run すると、エラーが繰り返される。

#### 実害

migration 061 を NULL に修正した後も、SQL Editor の同じタブで実行を続けたため、修正前のクエリが実行され続けた。「Failed to run sql query: ERROR: relation 'schema_migrations' does not exist」が 2 回連続で表示され、原因特定に時間を要した。

#### 推奨パターン(チェックリスト)

```
□ ローカルファイルを修正した後は、SQL Editor で「+」ボタンで新規タブ作成
□ または既存タブを使う場合は、Cmd+A → Delete でエディタを完全クリア
□ ファイル全体をコピーして貼り付け
□ 貼り付け後の目視確認:
  □ INSERT 文のスキーマ名(supabase_migrations.schema_migrations)
  □ カラムが (version, name, statements) の 3 つ
  □ statements の値が NULL
  □ executed_at が含まれていない
  □ BEGIN/COMMIT で囲まれている(複数 DDL の場合)
□ Run
□ Results が「Success. No rows returned」と表示されるか確認
```

#### 学び 74/75 との性質の違い

学び 74/75 は **技術的事実(DB の仕様)** に関する学び。学び 76 は **運用上の注意事項(ツール操作)** に関する学び。性質は異なるが、いずれも実害があったため正式化する。

### 3-4. 学び 71/72/73/74/75/76 の関係性

```
学び 71: 「適用済み」の二重定義
  └─ DDL の物理適用 vs schema_migrations への記録

学び 72: 「適用済み」の三重定義
  └─ 上記 + ローカルファイル保存

学び 73: ドキュメントと実態の乖離
  └─ プロジェクトドキュメントの記述が実態と一致するとは限らない

学び 74: information_schema の権限制限
  └─ DB 状態を見るためのツール自体が嘘をつくケース

学び 75: schema_migrations の所在
  └─ プロジェクト固有の運用知識

学び 76: SQL Editor のタブ管理
  └─ 開発ツールの落とし穴
```

学び 71〜76 は全て「**情報源を信用しすぎない**」という共通テーマで結ばれている。

---

## 4. 将来の宿題リスト

Step 0 のスコープ規律(学び 71/72)を守るため、本セッションで意図的に対応を見送った課題を以下に記録する。

### 4-1. /dashboard/page.tsx 自体の整理

- 現状: 旧求職者ダッシュボード(/mypage に supersede 済み)
- 完全な dead page なら削除、Phase ν-3 の /mypage 整備時に判断
- 推奨タイミング: **Phase ν-3 完了時**

### 4-2. resolveOwUserId() の統一リファクタ

- 現状: 6 ファイル中 5 ファイルでロジック分散
  - `src/lib/supabase/resolveOwUserId.ts`(新規、applications のみ使用)
  - `src/app/api/casual-meetings/route.ts`(インライン、(supabase) 型)
  - `src/app/api/mentor-reservations/route.ts`(インライン、(supabase) 型)
  - `src/app/api/bookmarks/route.ts`(インライン、(supabase) 型)
  - `src/app/api/jobseeker/experiences/route.ts`(インライン、(supabase, authUid) 型)
- experiences のエラー時挙動(404)が他(401)と異なる
- 推奨タイミング: **Phase η 前**(統一リファクタ Phase を持つ)

### 4-3. ON DELETE 設定の全テーブル横断見直し

- 現状: ow_job_applications だけ RESTRICT、他 3 テーブルは CASCADE
  - ow_casual_meetings: CASCADE
  - ow_mentor_reservations: CASCADE
  - ow_bookmarks: CASCADE
- 「ユーザー退会時のデータ保持ポリシー」を全テーブル横断で議論すべき
- GDPR/個人情報保護法対応との整合も含む
- 推奨タイミング: **Phase η 前**(退会ポリシー全体議論)

### 4-4. /api/applications の動作確認

- Step 0-1 で型チェックのみ通過、実動作確認は未実施
- DB 側に NOT NULL + ON DELETE RESTRICT があるため安全網は機能
- 推奨タイミング: **Phase ν-3 の F (応募 → 対話生成) 実装時**

### 4-5. /api/mentor-reservations の動作確認

- Step 0-2 で型チェックのみ通過、実動作確認は未実施
- ow_mentors が 0 件 + 全件 user_id NULL のため、現状 mentor_user_id は NULL でセットされる(想定通り)
- 推奨タイミング: **Phase ν-5 完了時**(メンター本人が ow_users と紐付いた後)

---

## 5. Phase ν-3 への準備(更新版)

### 5-1. ν-3 確定スコープ(v12 から変更なし)

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

### 5-2. ν-3 開始時に活用できる Step 0 の成果

| 整備された資産 | ν-3 での活用 |
|---|---|
| `resolveOwUserId()` 共通関数 | F の対話生成時に user_id 解決で利用 |
| ow_mentors.user_id 解決ロジック(/api/mentor-reservations) | F でメンター予約 → kind=mentor 対話生成時に活用 |
| ow_job_applications の FK 整合 | F で応募 → kind=company 対話生成時に活用 |
| 旧 ow_threads 依存コード削除 | A/B 画面実装時に古いコードの混入なし |

### 5-3. F の実装方針(v12 から変更なし)

| 求職者のアクション | 連動する対話生成 | 構造 |
|---|---|---|
| 求人応募 | ow_conversations 1件 | kind=company, stage=active |
| カジュアル面談 | ow_conversations 1件 | kind=company, stage=active |
| メンター予約 | ow_conversations 1件 | kind=mentor, stage=mediated |

A-1 制約への配慮: `INSERT ... ON CONFLICT DO NOTHING` + `SELECT id` パターン

### 5-4. 実装順序(v12 から変更なし)

```
Step 0(完了): 既存問題の修正  ← 本日完走
  ↓
Step 1: F の実装(対話生成トリガー)   ← 次セッション開始地点
Step 2: H + A(ナビゲーション + 一覧画面)
Step 3: B + C + D(詳細 + 送信 + 既読)
Step 4: E(未読表示)
```

### 5-5. ν-3 で必要な主要クエリ(v12 §6-4 から再掲 + 修正済み)

```sql
-- 1. 自分が参加中の対話一覧
SELECT c.*, ...
FROM ow_conversations c
JOIN ow_conversation_participants p ON p.conversation_id = c.id
WHERE p.user_id = (
  SELECT id FROM ow_users WHERE auth_id = auth.uid()
)
  AND p.left_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;
```

`auth.uid()` から `ow_users.id` への変換は `resolveOwUserId()` を使うか、上記のサブクエリパターンを使う。

---

## 6. 本セッションの議論経緯(参考資料)

### 6-1. Step 0-1 の判断プロセス

```
既存データ調査 → 0 件確定
  ↓
関連 FK 実態調査 → 学び 74 候補発見(information_schema 不可視)
  ↓
ow_job_applications だけ孤立(auth.users 参照)が判明
  ↓
他 3 テーブル(ow_casual_meetings/mentor_reservations/bookmarks)に揃える方針
  ↓
ON DELETE 議論 → RESTRICT(安全側)で確定
NOT NULL 議論 → 0 件で機会、ν-3 整合のため NOT NULL 化
  ↓
migration 061 設計 → 1 回目失敗(学び 75 発見、schema_migrations 不在)
  ↓
migration 061 修正 → 2 回目失敗(学び 76 発見、SQL Editor タブ問題)
  ↓
migration 061 適用 → 全項目 ✅
  ↓
API 共通化議論 → 既存 4 ファイルがバラバラと判明、案 P(applications のみ)で確定
  ↓
コミット a857e53、push 成功
```

### 6-2. Step 0-2 の判断プロセス

```
ow_mentors 実態調査 → 30 件全件テストデータ、current_role 異常値発見
  ↓
判断 2(テストデータの扱い): β(全件 DELETE)で確定
  └─ 理由: 異常値温存の積極的理由なし、reservations 0 件で連鎖削除リスクなし
判断 3(UNIQUE 制約): あり で確定
  └─ 理由: 1 ユーザー = 1 メンターの opinio.work 哲学、後から追加困難
  ↓
ON DELETE: RESTRICT(Step 0-1 と同方針)
NULL 許容: yes(ν-5 まで埋める手段なし)
  ↓
migration 062 設計 → BEGIN/COMMIT 維持(分割実行論を私が却下)
  ↓
migration 062 適用 → Success(学び 76 のチェックリスト適用)
  ↓
API 修正 → 既存の mentor 存在確認クエリに user_id を追加(別クエリ不要)
  ↓
コミット 6dc8116、push 成功
```

### 6-3. Step 0-3/0-4 の判断プロセス

```
Step 0-4(先): /api/casual-request 削除
  ├─ 呼び出し元 grep → 0 件確認
  ├─ ファイル削除
  └─ 型チェック ✅

Step 0-3: dashboard/job-tracking 削除
  ├─ 利用実態調査 → /dashboard/page.tsx の Quick Link 1 箇所のみ
  ├─ ow_threads 参照 2 箇所(削除済みテーブル)
  ├─ 構造違反: candidate_id に auth.users.id 直参照
  ├─ ν-3 で再実装予定
  └─ α(削除)で確定

Step 0-3/0-4 まとめてコミット 3b776e5、push 成功
  → 致命的欠陥制覇 11/11 完全制覇
```

---

## 7. 次セッションの開始テンプレート

### パターン A: Phase ν-3 をすぐ始める(推奨)

```
おはよう。引き継ぎ書 v13 を読んでください。
Step 0 は完走済みなので、Phase ν-3 Step 1(F の実装、対話生成トリガー)から
進めましょう。

まず /api/applications/route.ts に対話生成ロジックを追加するか、
独立した対話生成サービスを作るかを議論したいです。
```

### パターン B: 別の課題を優先したい

```
おはよう。引き継ぎ書 v13 を読んでください。
Phase ν-3 は一旦保留して、[別の課題] を優先したいです。
```

### パターン C: 将来の宿題から手を付けたい

```
おはよう。引き継ぎ書 v13 を読んでください。
§4 の宿題から [N 番] を先に解決したいです。理由は [理由]。
```

---

## 8. 数字で見るセッション

- 完走した Step: 0-1, 0-2, 0-3, 0-4(全 4 つ)
- 作成した migration: 2 つ(061, 062)
- 削除したファイル: 2 つ(/api/casual-request, dashboard/job-tracking)
- 修正したファイル: 3 つ(/api/applications, /api/mentor-reservations, /dashboard)
- 新規作成したファイル: 1 つ(src/lib/supabase/resolveOwUserId.ts)
- バックアップ: 1 つ(ow_mentors_backup_2026-05-05.txt)
- 制度化した学び: 3 つ(74, 75, 76)
- 作成したコミット: 3 つ(a857e53, 6dc8116, 3b776e5)
- 致命的欠陥制覇: 8/11 → 9/11 → 10/11 → 11/11(完全制覇)

---

## 9. 最後に

### 本セッションの意義

Phase ν-3 の前提整備として位置づけられた Step 0 を **1 セッションで完走** したセッションでした。Step 0-1 から 0-4 まで 4 つのサブステップを順次解決し、致命的欠陥制覇 8/11 から 11/11 へ。

これが可能になった要因:

1. **引き継ぎ書 v12 が詳細だった**ため、Step 0 の構造が即座に把握できた
2. **三者協働モデル**(チャット Claude + Claude Code + 柴さん)が機能した
3. **学び 73 の精神**を全 Step に適用 — 想像せず、必ず実態確認から始めた
4. **スコープ規律(学び 71/72)** を守った — Step ごとに「ここまで」を明確化
5. **3 つの新しい学びを発見しても止まらず**、その場で対処してから前進した

### Phase ν 全体の進捗

```
ν-0 設計確定          ✅ 完了
ν-1 DB migration      ✅ 完了
ν-2 既存データ移行    ✅ 完了 (= 削除)
Step 0 前提整備       ✅ 完了 (本日完走)
  ↓
ν-3 求職者側 UI       📍 次セッション開始地点
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

Step 0 完走、本当におめでとうございます 🎉

明日は Phase ν-3 Step 1 から進めましょう。
