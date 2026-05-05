# 引き継ぎ書 v14 — Phase ν-3 Step 1 完走(対話生成トリガー F 実装完了)

**作成日時**: 2026-05-06 (Step 1 完走後)
**前バージョン**: v13 (Step 0 完走 + 致命的欠陥制覇 11/11)
**最新コミット**: `b04402a` (Step 1-5 テストデータ クリーンアップ SQL)

---

## 0. このドキュメントの読み方

Phase ν-3 の最初のサブステップ「Step 1: F の実装(対話生成トリガー)」が **本日のセッションで完走** しました。明日以降のセッションで Step 2 から再開するため、以下の順序で読んでください:

1. **§1 Step 1 完走の状態**(3 分)— 何が完了したか
2. **§2 発見・解消した致命バグ 2 件**(5 分)— migration 064/065 の経緯
3. **§3 学び 77/78 候補**(5 分)— 制度化するか議論待ち
4. **§4 将来の宿題リスト**(5 分)— §4-6 〜 §4-10 が今回追加
5. **§5 Phase ν-3 の進捗と次のステップ**(10 分)— Step 2 の開始地点

§6 以降は本セッションの議論経緯、次セッションの開始テンプレート、数字サマリーを残した参考資料です。

---

## 関連ドキュメント

- `docs/product-insights.md`: プロダクト戦略・設計・UX レベルの気づきを記録。
  技術負債(本書 §4)とは性質が異なる、事業の根幹に関わる論点を集約。
  Phase η 前に議論が必要なエントリは要確認。

---

## 1. Step 1 完走の状態

### 1-1. 結論

**Phase ν-3 Step 1「F の実装(対話生成トリガー)」は本日のセッションで完全に完走**。
応募・カジュアル面談から対話が生成されるエンドツーエンドのフローが動作確認済み。

### 1-2. 各 Step の成果

| Step | 内容 | コミット |
|---|---|---|
| 1-1 | migration 063: create_conversation() RPC 作成 | `38d26d3` |
| 1-2 | createConversation.ts TS ラッパー関数作成 | `38d26d3` |
| 1-3 | /api/applications に対話生成呼び出し追加 | `17bbdee` |
| 1-4 | /api/casual-meetings に対話生成呼び出し追加 | `aed7b7d` |
| 1-5 | E2E 動作確認 + Bug 2 件発見・修正 | `da2c1ed`, `b04402a` |

### 1-3. 主要な変更

#### DB 変更(migration)

```
supabase/migrations/063_create_conversation_rpc.sql      (Step 1-1)
supabase/migrations/064_fix_ow_job_applications_rls.sql  (Step 1-5 Bug 1 修正)
supabase/migrations/065_fix_create_conversation_ambiguous_column.sql (Step 1-5 Bug 2 修正)
```

#### 新規ファイル

```
src/lib/conversations/createConversation.ts   (Step 1-2: TS ラッパー)
supabase/scripts/cleanup_step1_5_test_data.sql (Step 1-5: テストデータ削除 SQL)
```

#### 修正ファイル

```
src/app/api/applications/route.ts      (Step 1-3: createConversation 呼び出し追加)
src/app/api/casual-meetings/route.ts   (Step 1-4: createConversation 呼び出し追加)
```

### 1-4. 確定した設計パッケージ

| 設計記号 | 内容 | 採用理由 |
|---|---|---|
| β | createConversation を共通関数化(ラッパー層) | 呼び出し元 2 箇所で同一ロジックを書かずに済む |
| W1 | participants は candidate のみ初期登録(他は lazy) | Step 3 で B 画面実装時に必要になってから追加 |
| T1 | RPC 関数で 1 トランザクション | ON CONFLICT + SELECT + participants INSERT を原子的に |
| Y2 | 対話生成失敗はログのみ、応募/面談は成功扱い | 対話生成はサービスの副作用、本体アクションをブロックすべきでない |
| P4 | kind=mentor は Phase ν-5 で実装 | メンター予約フローが ν-5 で整備されてから |

### 1-5. 動作確認の状態

全シナリオを実機検証済み:

| シナリオ | 内容 | 結果 |
|---|---|---|
| 1 | 求人応募 → 対話生成(migration 065 前) | ❌ RLS 違反 → Bug 1 発覚 |
| 1' | 求人応募 → 対話生成(migration 064+065 後) | ✅ |
| 1'' | 別求人応募 → 新規対話生成 | ✅ |
| 5 | カジュアル面談 → 対話生成(migration 065 前) | ❌ 曖昧列参照 → Bug 2 発覚 |
| 5' | カジュアル面談 → 対話生成(migration 065 後) | ✅ |
| 6 | 同 company への 2 回目カジュアル面談 → 対話再利用 | ✅ `ON CONFLICT DO NOTHING` が機能 |

---

## 2. 発見・解消した致命バグ 2 件

### 2-1. Bug 1: ow_job_applications RLS 違反

#### 症状

`POST /api/applications` が `new row violates row-level security policy for table "ow_job_applications"` を返し、応募が完全に失敗。

#### 原因

migration 061 (Step 0-1) で `ow_job_applications.user_id` の FK 先を `auth.users → ow_users` に変更した。しかし INSERT/SELECT RLS ポリシーは旧仕様 `auth.uid() = user_id`(Auth UUID 直比較)のまま残存していた。

`user_id` カラムには `ow_users.id`(アプリ内 UUID)が入るようになったため、常に RLS 違反となる。

#### 修正

migration 064: ポリシーを `ow_casual_meetings` 等と同じパターンに統一。

```sql
WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()))
USING    (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()))
```

#### 教訓

migration 061 のような「FK 先変更」は、RLS ポリシー・クライアントクエリ・型定義の 3 層すべてに波及する。**FK 先を変更したら、そのカラムを参照する全箇所を横断チェックすること**。

---

### 2-2. Bug 2: create_conversation RPC 曖昧列参照

#### 症状

`create_conversation` RPC が `column reference "conversation_id" is ambiguous (code: 42702)` を返す。

#### 原因

```sql
CREATE OR REPLACE FUNCTION create_conversation(...)
RETURNS TABLE(conversation_id UUID, created BOOLEAN)  -- ← 出力列名
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE conversation_id = v_conversation_id  -- ← どちら? 曖昧
  )
```

`RETURNS TABLE(conversation_id UUID)` で定義した出力列名 `conversation_id` と、関数本体中の `ow_conversation_participants.conversation_id` の名前が衝突。PostgreSQL がどちらを参照すべきか判別できない。

#### 修正

migration 065: `ow_conversation_participants` にテーブル別名 `p` を付与。

```sql
IF NOT EXISTS (
  SELECT 1 FROM ow_conversation_participants p
  WHERE p.conversation_id = v_conversation_id  -- ← p. で明示
```

#### 教訓

`RETURNS TABLE(列名 型)` で定義した出力列名は、関数本体内でテーブル列名と衝突しうる。**`RETURNS TABLE` を使う関数では、本体内のテーブル参照に必ずテーブル別名を付けること**。

---

## 3. 学び 77/78 候補(制度化の議論待ち)

本セッションで 2 つの学び候補が発見された。いずれも実害が発生したかは微妙なため、**制度化するかは柴さんが判断**してください。

### 3-1. 学び 77 候補: チャット表示と実ファイルの乖離

#### 内容

Claude Code が生成したコードをチャットに貼り付ける際、Markdown の自動整形で記法が変わることがある。チャット上の表示が実ファイルの内容と乖離する。

#### 発生状況

`companyId: company_id` のような `key: value` 形式がリンク記法 `[company_id](...)` として整形される例が確認された。チャット Claude がレビューする際、実ファイルと異なる内容を見ることになる。

#### 対処方針

レビュー時に違和感のある記法があれば `grep` で実態確認する。重要なコードレビューは Claude Code が実ファイルを Read してチャット Claude に転送する。

---

### 3-2. 学び 78 候補: 「呼び出し側 try/catch なし」≠「throw する」

#### 内容

「API Route が `notify()` を try/catch なしで await している」から「notify が throw したら問題」と推論したが、実際には `notify()` の実装自体が内部で try/catch を持ち外部に throw しない設計だった。

**被呼び出し関数の実装を確認せずに呼び出し側の設計判断をしてはいけない**。

#### 発生状況

Step 1-3/1-4 の「createConversation をどこに挿入するか(P1 vs P2)」議論の前提条件として誤認が発生。最終的に「notify が throw しないなら P1 でも安全、P2 はより安全側」という結論になり実害はなかった。

#### 対処方針

「A が throw する」「A は best-effort」と判断する前に、A の実装(try/catch の有無、エラーの扱い)を必ず確認する。

---

## 4. 将来の宿題リスト

v13 §4-1〜4-5 から継続、Step 1 で新規追加 §4-6〜4-10。

### 4-1. /dashboard/page.tsx 自体の整理(v13 継続)

- 現状: 旧求職者ダッシュボード(/mypage に supersede 済み)
- 完全な dead page なら削除、Phase ν-3 の /mypage 整備時に判断
- 推奨タイミング: **Phase ν-3 完了時**

### 4-2. resolveOwUserId() の統一リファクタ(v13 継続)

- 現状: 6 ファイル中 5 ファイルでロジック分散
  - `src/lib/supabase/resolveOwUserId.ts`(共通関数: applications が使用)
  - `src/app/api/casual-meetings/route.ts`(インライン)
  - `src/app/api/mentor-reservations/route.ts`(インライン)
  - `src/app/api/bookmarks/route.ts`(インライン)
  - `src/app/api/jobseeker/experiences/route.ts`(インライン、エラー時挙動が異なる)
- 推奨タイミング: **Phase η 前**

### 4-3. ON DELETE 設定の全テーブル横断見直し(v13 継続)

- 現状: ow_job_applications だけ RESTRICT、ow_casual_meetings/mentor_reservations/bookmarks は CASCADE
- 「ユーザー退会時のデータ保持ポリシー」を全テーブル横断で議論
- 推奨タイミング: **Phase η 前**

### 4-4. /api/applications の動作確認(v13 継続、更新)

- ✅ Step 1-5 で実動作確認済み(migration 064 で RLS 修正後、シナリオ 1' で確認)

### 4-5. /api/mentor-reservations の動作確認(v13 継続)

- 型チェックのみ通過、実動作確認は未実施
- 推奨タイミング: **Phase ν-5 完了時**

---

### 4-6. ow_messages テーブルの廃止(新規追加)

- 現状: ow_threads 削除後の孤立テーブル、コード参照 0 件
- Phase ν-3 で対話機能を実装する際に使用する予定のテーブルではない(ow_conversations/ow_messages の設計は別途確認が必要)
- 推奨タイミング: **Phase ν-7 で他の旧テーブルとまとめて廃止**

### 4-7. API レスポンスステータスコードの統一(新規追加)

- 現状: `/api/casual-meetings` が `200`、`/api/applications` が `201`
- 「リソース作成」は 201 が REST 標準
- 推奨タイミング: **Phase η 前の統一リファクタフェーズ**

### 4-8. ow_conversation_participants RLS 根本修正(新規追加)

- 現状: INSERT WITH CHECK が「自分が既に participant」を要求し、初回登録不可
- Step 1 では `create_conversation` RPC が SECURITY DEFINER で RLS をバイパスし迂回(migration 063)
- Step 3 で B 画面(lazy 登録: 企業担当者・メンターが初めてアクセス)実装時に根本修正必須
- 推奨タイミング: **Phase ν-3 Step 3 で必須対応**

### 4-9. notify 処理の呼び出し側 try/catch 強化(新規追加)

- 現状: `notify()` は内部で best-effort 処理済み、呼び出し側に try/catch なし
- `notify()` が将来 throw するよう変更された場合のリスクが残る
- 現状実害なし、優先度低
- 推奨タイミング: **Phase η 前の統一リファクタフェーズ**

### 4-10. クライアント側 SELECT の ow_users 経由化(新規追加)

- 発見: `src/app/(jobseeker)/mypage/applications/page.tsx:92`
  ```typescript
  .eq("user_id", user.id)  // ← auth.users.id で比較 → 常に 0 件
  ```
- `ow_job_applications.user_id` は `ow_users.id`(アプリ内 UUID)なので、`auth.users.id` との比較は常に不一致
- migration 064 のクライアント版(RLS 修正と同じパターン)
- **他のクライアント側 SELECT クエリも同パターンの可能性あり**、全面点検が必要
- 推奨タイミング: **Phase ν-3 Step 2(mypage 整備)に合わせて修正**

---

## 5. Phase ν-3 の進捗と次のステップ

### 5-1. ν-3 要素の状態

| # | 要素 | 状態 |
|---|---|---|
| F | 対話の生成トリガー | ✅ Step 1 完了 |
| H | ナビゲーション統合 | 📍 Step 2 で実装 |
| A | 対話一覧画面 | 📍 Step 2 で実装 |
| B | 対話詳細画面 | Step 3 で実装 |
| C | メッセージ送信フォーム | Step 3 で実装 |
| D | 既読処理 | Step 3 で実装 |
| E | 未読表示(boolean) | Step 4 で実装 |
| G | リアルタイム更新 | ⚫ YAGNI |

### 5-2. Step 2 の開始地点

**Step 2: H + A(ナビゲーション統合 + 対話一覧画面)**

#### H: ナビゲーション統合

- `/mypage` または求職者ヘッダーナビゲーションに「対話」リンクを追加
- 未読バッジは Step 4(E 実装後)に付与

#### A: 対話一覧画面

- URL: `/mypage/conversations` または `/conversations`(要確認)
- データ: `ow_conversations` JOIN `ow_conversation_participants` WHERE `user_id = 自分`
- 一覧項目: 企業名(or メンター名) / 最新メッセージ / 未読有無(Step 4 まで非表示)
- `last_message_at` 降順

#### §4-10 の修正も Step 2 に合わせて実施

`/mypage/applications/page.tsx` の `.eq("user_id", user.id)` を `ow_users` 経由に修正する。これにより応募管理が実データ表示されるようになる。

### 5-3. Step 2 で参照する主要クエリ

```sql
-- 自分が参加中の対話一覧
SELECT c.id, c.kind, c.stage, c.company_id, c.mentor_user_id,
       c.last_message_at, c.created_at
FROM ow_conversations c
JOIN ow_conversation_participants p ON p.conversation_id = c.id
WHERE p.user_id = (
  SELECT id FROM ow_users WHERE auth_id = auth.uid()
)
  AND p.left_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;
```

### 5-4. Phase ν 全体の進捗(更新)

```
ν-0 設計確定          ✅ 完了
ν-1 DB migration      ✅ 完了
ν-2 既存データ移行    ✅ 完了
Step 0 前提整備       ✅ 完了
Step 1 F 実装         ✅ 完了 ← 本日完走
  ↓
Step 2: H + A         📍 次セッション開始地点
Step 3: B + C + D
Step 4: E
  ↓
ν-4 企業側 UI
ν-5 メンター側 UI (P4 で保留した kind=mentor 対話生成もここで)
ν-6 編集部 UI
ν-7 旧テーブル廃止
  ↓
🎉 Phase ν 完走 → Phase η(30 社投入)
```

---

## 6. 本セッションの議論経緯(参考資料)

### 6-1. createConversation.ts 設計の判断

```
チャット Claude に migration 063 全文レビュー依頼
  ↓
TS ラッパーの型設計: discriminated union(kind='company'|'mentor')
SupabaseClient 型: @supabase/supabase-js の SupabaseClient(ジェネリクスなし)
  → resolveOwUserId.ts と同じパターンに合わせる
  ↓
コミット 38d26d3(createConversation.ts + migration 063)
```

### 6-2. Step 1-3/1-4 の挿入位置判断(P1 vs P2)

```
最初の設計: notify より後に createConversation を挿入(P1)
  ↓
チャット Claude のレビューで指摘:
「notify は try/catch なしで await されているのでは?」
  ↓
実態確認: notify() は内部で try/catch を持ち外部に throw しない
  → 学び 78 候補 発見
  ↓
P2(notify より前に挿入)で確定
  理由: notify が将来変わってもリスクがない、extra safety
  ↓
コミット 17bbdee(applications), aed7b7d(casual-meetings)
```

### 6-3. Step 1-5 Bug 発見のフロー

```
シナリオ 1(テスト株式会社_021 へ求人応募)
  → RLS 違反 42501 エラー
  → ow_job_applications の RLS ポリシー調査
  → 原因: migration 061 で FK 変更したが RLS ポリシーが旧パターン
  → migration 064 設計 → 柴さんが SQL Editor 適用
  ↓
シナリオ 1'(テスト株式会社_002 へ求人応募)
  → ow_job_applications INSERT ✅
  → createConversation RPC 呼び出し
  → 42702 曖昧列参照エラー
  → RETURNS TABLE(conversation_id) と ow_conversation_participants.conversation_id の衝突
  → migration 065 設計 → 柴さんが SQL Editor 適用
  ↓
シナリオ 1''(テスト株式会社_002 への対話生成 ✅ + participants ✅)
  ↓
シナリオ 5'(テスト株式会社_002 へカジュアル面談)
  → ow_casual_meetings INSERT ✅
  → createConversation: ON CONFLICT → 既存対話再利用 ✅
  → ow_conversations 件数変化なし ✅(シナリオ 6 兼検証)
```

---

## 7. 次セッションの開始テンプレート

### パターン A: Phase ν-3 Step 2 をすぐ始める(推奨)

```
おはよう。引き継ぎ書 v14 を読んでください。
Phase ν-3 Step 1 完走済み、Step 2(H + A: ナビゲーション + 一覧画面)から進めましょう。
```

### パターン B: §4-10 の修正を先に対応したい

```
おはよう。引き継ぎ書 v14 を読んでください。
Step 2 の前に §4-10(mypage/applications の 0 件バグ)を先に直したいです。
```

### パターン C: 別の課題を優先したい

```
おはよう。引き継ぎ書 v14 を読んでください。
Phase ν-3 は一旦保留して、[別の課題] を優先したいです。
```

---

## 8. 数字で見るセッション

- 完走した Step: 1-1, 1-2, 1-3, 1-4, 1-5(全 5 つ)
- 作成した migration: 3 つ(063, 064, 065)
- 新規作成したファイル: 2 つ(createConversation.ts, cleanup SQL)
- 修正したファイル: 2 つ(/api/applications, /api/casual-meetings)
- 作成したコミット: 5 つ(38d26d3, 17bbdee, aed7b7d, da2c1ed, b04402a)
- 解消した致命バグ: 2 つ(Bug 1: RLS 違反, Bug 2: 曖昧列参照)
- 追加した宿題: 5 つ(§4-6〜§4-10)
- 学び候補: 2 つ(77, 78)— 制度化は柴さんが判断
- 動作確認シナリオ: 6 種(1, 1', 1'', 5, 5', 6)を実機検証

---

## 9. 最後に

### 本セッションの意義

Phase ν-3 の最初のサブステップ「Step 1: F の実装(対話生成トリガー)」を **1 セッションで完走** しました。

特筆すべきは、**E2E 動作確認(Step 1-5)で 2 件の致命バグを発見・解消したこと**。

- Bug 1: migration 061 の影響が RLS ポリシーに残存(migration 064 で修正)
- Bug 2: PostgreSQL の RETURNS TABLE と本体中のテーブル列名が衝突(migration 065 で修正)

両バグとも「型チェックは通るが実動作で壊れる」タイプ。**Step 1-5 の E2E 動作確認が正解だった**。「実際に叩いてみるまでわからない」を改めて実証したセッションでした。

また、シナリオ 6(対話再利用)が **シナリオ 5' の副産物として同時検証**されたことも収穫です。`ON CONFLICT DO NOTHING` パターンが期待通りに機能し、同じ企業への複数アクション(求人応募 → カジュアル面談)で対話が重複生成されないことを確認しました。

### 次セッションへ

Step 2 では **求職者が対話一覧を見られるようにする** ことが目標です。対話は既にDBに存在するので、あとは「見せる」だけです。§4-10 の mypage/applications 0 件バグも合わせて修正すると、求職者マイページ全体の実データ接続が一気に進みます。

---

*引き継ぎ書 v14 終了*
