# 引き継ぎ書 v15 — Phase ν-3 Step 2 完走(対話一覧 A + ナビゲーション H 実装完了)

**作成日時**: 2026-05-06 (Step 2 完走後)
**前バージョン**: v14 (Step 1 完走 + 致命的欠陥制覇)
**最新コミット**: `12f6b39` (Step 2-4: A UI 整形 + H ナビ統合)

---

## 0. このドキュメントの読み方

Phase ν-3 の第 2 サブステップ「Step 2: H + A(ナビゲーション統合 + 対話一覧画面)」が **本日のセッションで完走** しました。次セッションで Step 3 から再開するため、以下の順序で読んでください:

1. **§1 Step 2 完走の状態**(3 分)— 何が完了したか
2. **§2 発見・解消した致命バグ 2 件**(5 分)— migration 066/067 の経緯(発見 λ と発見 ν)
3. **§3 学び 77/78/79 候補**(5 分)— 制度化するか議論待ち
4. **§4 将来の宿題リスト**(5 分)— §4-11〜4-17 が今回追加
5. **§5 Phase ν-3 の進捗と次のステップ**(10 分)— Step 3 の開始地点

§6 以降は本セッションの議論経緯、次セッションの開始テンプレート、数字サマリーを残した参考資料です。

---

## 関連ドキュメント

- `docs/product-insights.md`: プロダクト戦略・設計・UX レベルの気づきを記録。
  技術負債(本書 §4)とは性質が異なる、事業の根幹に関わる論点を集約。
  Phase η 前に議論が必要なエントリは要確認。

---

## 1. Step 2 完走の状態

### 1-1. 結論

**Phase ν-3 Step 2「H + A(ナビゲーション統合 + 対話一覧画面)」は本日のセッションで完全に完走**。
`/mypage/conversations` が実データ表示、MypageClient・applications 双方からナビゲーション可能。

### 1-2. 各 Sub-step の成果

| Step | 内容 | コミット |
|---|---|---|
| 2-1 | §4-10 修正: /mypage/applications の user_id クエリを owUser.id に変更 | `ae0436b` |
| 2-2 | migration 066: ow_conversations / ow_conversation_participants SELECT RLS 修正 | `8bfe597` |
| 2-3 | /mypage/conversations ページ新規作成(最小 UI: JSON dump で RLS 検証) | `8bfe597` |
| 2-4 | A UI 整形 + H ナビゲーション統合(3 ファイル修正) | `12f6b39` |
| 2-5 | 動作確認(シナリオ A1〜A6) + テストデータクリーンアップ | —(手動実施) |

### 1-3. 主要な変更

#### DB 変更(migration)

```
supabase/migrations/066_fix_ow_conversations_select_rls.sql
supabase/migrations/067_fix_ow_conversation_participants_select_no_recursion.sql
```

#### 新規ファイル

```
src/app/(jobseeker)/mypage/conversations/page.tsx
```

#### 修正ファイル

```
src/app/(jobseeker)/mypage/applications/page.tsx  (§4-10 修正 + SIDEBAR_ITEMS 更新)
src/app/(jobseeker)/mypage/MypageClient.tsx        (「対話」サイドバー項目追加)
```

### 1-4. 確定した設計パッケージ(Step 2)

| 設計記号 | 内容 | 採用理由 |
|---|---|---|
| D2改 | Sub-step 5 つに再編(2-1〜2-5) | 実態確認が必要な §4-10 修正を先行させるため |
| E1 | §4-10 修正対象は /mypage/applications のみ | 他ページで同パターン未発見 |
| F2 | A は標準実装(空状態 + last_message_at 降順) | シンプル優先 |
| G1 | URL は /mypage/conversations | mypage 配下に統一 |
| H1 | メッセージプレビューなし | Step 3 で C 実装後に追加 |
| M1 | migration 066 のスコープは SELECT のみ | スコープ規律遵守(INSERT は §4-8、Step 3) |
| N3 | 別 URL + サイドバー連携 | MypageClient + applications + conversations 全てに「対話」リンク |
| Q2 | Client Component で実装 | RLS 動作確認が目的のため client-side fetch |
| R1 | シングルクエリ + JOIN(RLS に頼る) | ow_users 経由 RLS が正常動作することを確認 |
| S1 | クライアント側でフィルタ | Phase ν-5 で mentor 実装時にフィルタ追加 |
| T1 | kind('company' / 'mentor')のみで区別 | stage は B 画面で表示 |
| Y1 | migration 067 で SELECT を単純化(自己参照削除) | 無限再帰解消のため |
| Z1 | applications と同じレイアウト構造を踏襲 | デザイン統一 |
| AA1 | stage は表示しない | B 画面で対処 |
| BB3 | フィルタなし | Phase ν-5 で mentor 実装時に追加 |
| CC1 | MypageClient + applications + conversations すべてに「対話」リンク | 一貫したナビゲーション |
| EE4 | MypageClient のラベルを「対話」に統一 | 他サイドバーと整合 |

### 1-5. 動作確認の状態

全シナリオを実機検証済み:

| シナリオ | 内容 | 結果 |
|---|---|---|
| A1 | /mypage/conversations にアクセス(クリーンアップ後) | ✅ 空状態表示 |
| A2 | テスト株式会社_002 へ求人応募 → 対話 1 件生成 | ✅ 一覧に表示 |
| A3-b | テスト株式会社_001 へカジュアル面談 → 対話 1 件追加 | ✅ 2 件表示 |
| A4 | /mypage から「対話」クリック → /mypage/conversations 遷移 | ✅ |
| A5 | /mypage/applications から「対話」クリック → /mypage/conversations 遷移 | ✅ |
| A6 | テストデータクリーンアップ | ✅ 全 4 テーブル 0 件確認 |

---

## 2. 発見・解消した致命バグ 2 件

### 2-1. 発見 λ: ow_conversations SELECT RLS の auth.uid() 直接比較

#### 症状

`/mypage/conversations` で会話一覧が常に 0 件返る(エラーなし)。

#### 原因

`ow_conversations_select` ポリシー内で `ow_conversation_participants.user_id = auth.uid()` と直接比較していた。しかし `user_id` には `ow_users.id`(アプリ内 UUID)が格納されており、`auth.uid()`(Auth UUID)とは常に不一致。

migration 061 で FK 先を変更した際の RLS ポリシー未更新(Bug 1 の ow_job_applications と同じパターン)。

#### 修正

migration 066: ow_conversations / ow_conversation_participants の SELECT ポリシーを `IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` パターンに統一。

#### 教訓

「既存と同じパターンで書く」と指示しても、その既存自体が問題を抱えていることがある。**「踏襲する既存実装」の正確な SQL を確認してから記述すること**。

---

### 2-2. 発見 ν: ow_conversation_participants SELECT の無限再帰

#### 症状

`/mypage/conversations` で `infinite recursion detected in policy for relation "ow_conversation_participants"` (PostgreSQL 42P17) エラー。

#### 原因

migration 066 で書いた `ow_conversation_participants_select` ポリシーの USING 句が同テーブルを自己参照していた:

```sql
EXISTS (
  SELECT 1 FROM ow_conversation_participants self  -- ← 自己参照!
  WHERE self.conversation_id = ow_conversation_participants.conversation_id
    AND self.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
)
```

PostgreSQL がポリシーを評価するたびに同テーブルの SELECT ポリシーを再評価→無限ループ。

#### 修正

migration 067: 自己参照を排除し `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` のシンプルな条件に置き換え。

```sql
USING (
  user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);
```

#### 教訓

RLS ポリシーの USING 句内で同テーブルを参照すると無限再帰になる(PostgreSQL 典型パターン)。**ポリシー設計時は自己参照を含まない条件のみを使うこと**。

---

## 3. 学び 77/78/79 候補(制度化の議論待ち)

本セッションで 3 つの学び候補が発見・継続確認された。**制度化するかは柴さんが判断**してください。

### 3-1. 学び 77 候補: チャット表示と実ファイルの乖離(継続)

v14 から継続。**本セッションで 3 回連続発動(うち 1 回は Claude Code 自身のレビューミスも含む)**。

引き継ぎ書 v14 §0 の文言修正で、Claude Code が「チャット要約に書かれていない §6 は存在しない」と誤判断し、実ファイルを grep してから気づいた事例が追加された。

**制度化推奨度: 高**。

対処方針: チャット上の表示が実ファイルと乖離する可能性がある場合、必ず Read または grep で実態確認してからレビュー判断を行う。

---

### 3-2. 学び 78 候補: 「呼び出し側 try/catch なし」≠「throw する」(継続)

v14 から継続。本セッション中に新たな発動なし。

**制度化判断は柴さん**。

---

### 3-3. 学び 79 候補(NEW): 既存設計の踏襲時も実態確認

#### 内容

「ow_casual_meetings の RLS パターンを踏襲する」と指示してもらって migration 066 を設計したが、参照元の既存パターン自体が自己参照を含んでいた(=同じ問題を引き継いだ)。

「既存と同じパターンで書く」は、**既存が正しいという前提が成り立つ場合のみ有効**。

#### 発生状況

Step 2-2 で migration 066 を設計。`ow_conversation_participants_select` の USING 句に自己参照(`SELECT 1 FROM ow_conversation_participants self`)を書いた。Step 2-3 の動作確認で発覚→ migration 067 で修正。

#### 対処方針

「踏襲する既存実装」の SQL を pg_policies から取得して確認してから記述する。学び 73「実態確認ファースト」の応用パターン。

**制度化推奨度: 中〜高**。

---

## 4. 将来の宿題リスト

v14 §4-1〜4-10 から継続。Step 2 で新規追加 §4-11〜4-17。

### 4-1. /dashboard/page.tsx 自体の整理(v13 継続)

- 現状: 旧求職者ダッシュボード(/mypage に supersede 済み)
- 推奨タイミング: **Phase ν-3 完了時**

### 4-2. resolveOwUserId() の統一リファクタ(v13 継続)

- 現状: 6 ファイル中 5 ファイルでロジック分散
- 推奨タイミング: **Phase η 前**

### 4-3. ON DELETE 設定の全テーブル横断見直し(v13 継続)

- 現状: ow_job_applications だけ RESTRICT、他は CASCADE
- 推奨タイミング: **Phase η 前**

### 4-4. /api/applications の動作確認(✅ Step 1-5 で完了)

### 4-5. /api/mentor-reservations の動作確認(v13 継続)

- 推奨タイミング: **Phase ν-5 完了時**

### 4-6. ow_messages テーブルの廃止(v14 継続)

- 推奨タイミング: **Phase ν-7 で他の旧テーブルとまとめて廃止**

### 4-7. API レスポンスステータスコードの統一(v14 継続)

- 推奨タイミング: **Phase η 前の統一リファクタフェーズ**

### 4-8. ow_conversation_participants RLS 根本修正(v14 継続、**Step 3 で必須**)

- INSERT WITH CHECK が「自分が既に participant」を要求し、初回登録不可
- Step 3 で B 画面(lazy 登録: 企業担当者・メンターが初めてアクセス)実装時に根本修正必須
- 推奨タイミング: **Phase ν-3 Step 3 で必須対応**

### 4-9. notify 処理の呼び出し側 try/catch 強化(v14 継続)

- 推奨タイミング: **Phase η 前の統一リファクタフェーズ**

### 4-10. クライアント側 SELECT の ow_users 経由化(✅ Step 2-1 で完了)

- `/mypage/applications/page.tsx` の `.eq("user_id", user.id)` を `owUser.id` に修正済み

---

### 4-11. ow_conversation_messages の RLS(NEW)

- メッセージ送信機能 C 実装時に同じ「auth.uid() 直接比較」パターンの可能性大
- Step 3 実装前に pg_policies で事前確認必須
- 推奨タイミング: **Phase ν-3 Step 3**

### 4-12. ow_conversation_participants の INSERT/UPDATE RLS(NEW)

- INSERT: §4-8 と統合、B 画面 lazy 登録時に migration 068 で対処
- UPDATE: D 既読処理(last_read_at 更新)時に migration 069 で対処
- 推奨タイミング: **Phase ν-3 Step 3**

### 4-13. ow_conversations の UPDATE RLS(NEW)

- ow_conversation_participants 参照かつ auth.uid() 直接比較(旧パターン残存)
- 対話 stage 変更等で必要になる時に修正
- 推奨タイミング: **Phase ν-3 Step 3**

### 4-14. types.ts の自動生成(NEW)

- `ow_conversations` が types.ts に含まれていないため `(supabase as any)` でキャスト
- Supabase CLI で `npx supabase gen types typescript --project-id xtutnecqeamftygufxco > src/lib/supabase/types.ts` を実行して根本解消
- 推奨タイミング: **Phase η 前**

### 4-15. /mypage 配下のレイアウト統一(NEW)

- 発見 μ: MypageClient(SPA、リッチ)と applications/conversations(別 URL、シンプル)が混在
- ユーザーが /mypage トップ → /mypage/applications で UI が大きく変わる
- 大規模リファクタ案件
- 推奨タイミング: **Phase η 以降**

### 4-16. SIDEBAR_ITEMS の共通化リファクタ(NEW)

- applications/conversations が各自 SIDEBAR_ITEMS を持つ(共通化されていない)
- 軽微な技術負債
- 推奨タイミング: **Phase η 前の統一リファクタ**

### 4-17. Icons.message の重複解消(NEW、優先度低)

- MypageClient で「メンター相談」と「対話」が同じ inline SVG アイコン
- UI 区別性のため別アイコン化（対話は MessageSquare、メンター相談は既存のまま等）
- 推奨タイミング: **Phase η 前(優先度低)**

---

## 5. Phase ν-3 の進捗と次のステップ

### 5-1. ν-3 要素の状態

| # | 要素 | 状態 |
|---|---|---|
| F | 対話の生成トリガー | ✅ Step 1 完了 |
| A | 対話一覧画面 | ✅ Step 2 完了 |
| H | ナビゲーション統合 | ✅ Step 2 完了 |
| B | 対話詳細画面 | 📍 Step 3 で実装 |
| C | メッセージ送信フォーム | Step 3 で実装 |
| D | 既読処理 | Step 3 で実装 |
| E | 未読表示(boolean) | Step 4 で実装 |
| G | リアルタイム更新 | ⚫ YAGNI |

### 5-2. Step 3 の開始地点

**Step 3: B + C + D(対話詳細 + メッセージ送信 + 既読処理)**

#### B: 対話詳細画面

- URL: `/mypage/conversations/[id]`
- データ: `ow_conversation_messages` WHERE `conversation_id = 対話 ID`
- 表示: メッセージ一覧(送信者名 / 内容 / タイムスタンプ)
- **事前確認必須**: `ow_conversation_messages` の RLS ポリシーを pg_policies で確認(§4-11)

#### C: メッセージ送信フォーム

- /mypage/conversations/[id] ページ下部に送信フォーム
- API Route: `/api/conversations/[id]/messages` POST
- DB: `ow_conversation_messages` INSERT
- Y2 ポリシー: 送信失敗はエラー表示のみ、ページは壊さない

#### D: 既読処理

- `ow_conversation_participants.last_read_at` を UPDATE
- メッセージ一覧 fetch 時に自動更新(ページアクセス = 既読)
- **§4-12 の UPDATE RLS 修正が前提**(migration 068 として対処)

#### Step 3 の事前 RLS 確認クエリ

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('ow_conversation_messages')
ORDER BY cmd, policyname;
```

### 5-3. Phase ν 全体の進捗(更新)

```
ν-0 設計確定          ✅ 完了
ν-1 DB migration      ✅ 完了
ν-2 既存データ移行    ✅ 完了
Step 0 前提整備       ✅ 完了
Step 1 F 実装         ✅ 完了
Step 2 H + A 実装     ✅ 完了 ← 本日完走
  ↓
Step 3: B + C + D     📍 次セッション開始地点
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

### 6-1. Step 2-1: §4-10 修正

```
Step 2 開始前に「§4-10 と同パターンが他にないか」洗い出し
  → grep: mypage/applications のみ対象と確認
  → 2-step owUser.id 解決パターン実装
  → コミット ae0436b
```

### 6-2. Step 2-2: migration 066 設計〜発見 λ

```
A 対話一覧のクエリ設計前に ow_conversations RLS ポリシーを調査
  → pg_policies で確認: user_id = auth.uid() 直接比較(旧パターン)
  → migration 066 設計: ow_conversations + ow_conversation_participants SELECT ポリシー修正
  → 柴さんが SQL Editor で適用
  → schema_migrations に 063-066 の 4 件が記録されたことを確認
```

### 6-3. Step 2-3: 最小 UI 実装〜発見 ν

```
conversations/page.tsx 新規作成(JSON dump 最小 UI)
  → ブラウザ確認: infinite recursion エラー(42P17)
  → pg_policies で ow_conversation_participants SELECT を調査
  → 原因: USING 句内の自己参照 `SELECT 1 FROM ow_conversation_participants self`
  → migration 067 設計: 自己参照なし版に置き換え
  → 柴さんが SQL Editor で適用
  → 再確認: 件数 0, [] 表示, エラーなし ✅
  → コミット 8bfe597
```

### 6-4. Step 2-4: UI 整形 + ナビ統合

```
実態確認: applications/page.tsx 構造 + MypageClient サイドバー + アイコン
  → 3 ファイル並行修正
  → conversations/page.tsx: 整形 UI(ロゴ + 名前 + 日付 + 空状態)
  → applications/page.tsx: SIDEBAR_ITEMS に「対話」追加
  → MypageClient.tsx: SidebarItem 追加(window.location.href で外部遷移)
  → ラベル「対話一覧」→「対話」に統一(レビュー後の最終調整)
  → npx tsc --noEmit: EXIT:0
  → コミット 12f6b39
```

---

## 7. 次セッションの開始テンプレート

```
おはよう。引き継ぎ書 v15 を読んでください。
Phase ν-3 Step 2 完走済み、Step 3(B + C + D: 対話詳細 + メッセージ送信 + 既読)から進めましょう。
```

---

## 8. 数字で見るセッション

- 完走した Step: 2-1, 2-2, 2-3, 2-4, 2-5(全 5 つ)
- 作成した migration: 2 つ(066, 067)
- 新規作成したファイル: 1 つ(/mypage/conversations/page.tsx)
- 修正したファイル: 2 つ(/mypage/applications, MypageClient.tsx)
- 作成したコミット: 3 つ(ae0436b, 8bfe597, 12f6b39)
- 解消した致命バグ: 2 つ(発見 λ: SELECT RLS、発見 ν: 無限再帰)
- UX 課題発見: 1 つ(発見 μ: レイアウト混在、§4-15)
- 制度化候補の学び: 3 件(77/78 継続, 79 NEW)
- 動作確認シナリオ: A1, A2, A3-b, A4, A5, A6 を実機検証

---

## 9. Phase ν 全体の進捗サマリー

```
ν-0 設計確定          ✅
ν-1 DB migration      ✅ migration 061〜067 適用済み
ν-2 既存データ移行    ✅
Step 0 前提整備       ✅
Step 1 F 実装         ✅ (F: 対話生成トリガー)
Step 2 H + A 実装     ✅ (H: ナビ統合, A: 対話一覧)
Step 3 B + C + D      📍 次セッション (B: 詳細, C: 送信, D: 既読)
Step 4 E              (E: 未読表示)
ν-4 企業側 UI
ν-5 メンター側 UI
ν-6 編集部 UI
ν-7 旧テーブル廃止
→ Phase η (30 社投入)
```

---

*引き継ぎ書 v15 終了*
