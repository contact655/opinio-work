# Phase ν-4 マスタープラン

作成日: 2026-05-06
対象ブランチ: main 直接コミット
前提: Phase ν-3 完了（Step 4-6まで実装済み）、handover v17 コミット済み（d9012b0）

---

## 確定済み設計決定

| 項目 | 決定内容 |
|------|---------|
| **実施順** | Plan A: §4-19/4-20（負債返済）→ 応募管理 → 企業側対話 UI |
| **Lazy registration** | ハイブリッド方式（RPC 初回 candidate 登録 + API Route 追加 HR 登録） |
| **migration 070** | INSERT RLS + SELECT RLS 緩和を1ファイルにまとめる |
| **MOCK_USER.currentRole（line 366）** | mock 据え置き、TODO コメントのみ追加 |
| **未読バッジ** | ν-4 では変更なし（赤ドット維持） |
| **コミット形式** | `feat(nu-4): Sub-step 4A-X: <description>` |
| **承認フロー** | 各 Sub-step 完了後、柴さんの承認を得てから次へ進む |

---

## 不確実性解消サマリー（2026-05-06 調査済み）

### 調査1: §4-8 INSERT RLS 干渉リスク
- **結論**: `create_conversation` RPC は `prosecdef: true`（SECURITY DEFINER）のため RLS をバイパスする
- **影響**: migration 070 の INSERT RLS 修正は既存 RPC フローを破壊しない → GO

### 調査2: 「田中翔太」表示箇所
- **結論**: `MypageClient.tsx:303` がハードコード（`おかえりなさい、田中翔太さん`）
- **影響**: 2箇所のみ UI 修正が必要（line 303 + line 366 の TODO コメント）
- **その他の出現**: mock データファイル内の宣言のみ → UI への影響なし

### 調査3: 企業側認証・DB スキーマ
- **結論**:
  - `ow_conversations` に `updated_at` カラムなし → ORDER BY は `last_message_at DESC NULLS LAST, created_at DESC`
  - `ow_company_admins.user_id`（正しいカラム名、`ow_user_id` ではない）
  - `getTenantContext()` は再利用可能
- **⚠️ 重大発見**: `ow_conversations` テーブルが空（Step 4-4 でテストデータ削除済み）
  → Sub-step 4A-5 でテストデータ再投入が必要

### 総合判定: **GO** — Plan A をそのまま実施

---

## Sub-step 一覧

| # | タイトル | サイズ | 優先度 |
|---|----------|--------|--------|
| 4A-0 | ハードコード名グレップ確認 | XS | 必須（最初） |
| 4A-1 | MypageClient ハードコード修正 | XS | 必須 |
| 4A-2 | getUser() → getSession() 置換（5ファイル） | S | 必須 |
| 4A-3 | /mypage/applications フロー確認 | XS | 確認のみ |
| 4A-4 | migration 070 作成・適用 | M | 必須 |
| 4A-5 | テストデータ作成（biz 検証用） | S | 必須 |
| 4A-6 | /biz/conversations 一覧ページ実装 | L | メイン |
| 4A-7 | /biz/conversations/[id] 詳細・返信・join API | L | メイン |
| 4A-8 | 引き継ぎ書 v18 作成 | S | 最後 |

---

## Sub-step 4A-0: ハードコード名グレップ確認

**目的**: 「田中翔太」以外のハードコードされた実在ユーザー名・メールアドレスが UI に漏れていないか確認

**作業内容**:
```bash
# ハードコードされた名前・メールを検索
grep -r "田中翔太" src/app --include="*.tsx" --include="*.ts" -n
grep -r "tanaka@" src/app --include="*.tsx" --include="*.ts" -n
grep -r "hshiba\|柴久人\|柴さん" src/app --include="*.tsx" --include="*.ts" -n
```

**完了条件**:
- 検索結果を確認し、UI レンダリングに影響するハードコードを特定する
- mock データファイル（`mock*.ts`）内の出現は問題なし
- ページコンポーネント（`page.tsx`, `*Client.tsx`）内のハードコードをリストアップ

**コミット**: なし（確認のみ）

---

## Sub-step 4A-1: MypageClient ハードコード修正

**目的**: `/mypage` の歓迎メッセージを Supabase から取得した実ユーザー名で表示する

**対象ファイル**: `src/app/(jobseeker)/mypage/MypageClient.tsx`

**変更内容**:

1. **line 303**: `おかえりなさい、田中翔太さん` → `おかえりなさい、{userName}さん`
   - `userName` 変数は line 910 で `owUser?.name ?? "ユーザー"` として定義済み

2. **line 366**: `{MOCK_USER.currentRole}` → TODO コメントを追加するのみ（mock 据え置き）
   ```tsx
   {/* TODO: Phase ν-5 で Supabase ow_users.current_role に接続する */}
   {MOCK_USER.currentRole}
   ```

3. **line 388**: `{MOCK_USER.profileCompletion}` → TODO コメントを追加するのみ
   ```tsx
   {/* TODO: Phase ν-5 で実データ計算に切り替える */}
   {MOCK_USER.profileCompletion}
   ```

4. **line 393**: プロフィール完成度バーの関連箇所 → TODO コメントを追加するのみ

**完了条件**:
- `/mypage` を開くと歓迎メッセージが Supabase の `owUser.name` を表示する
- ログアウト状態でリロードしても「ユーザー」フォールバックが表示される
- `userName` 変数が既に `line 351` で使用済みなのでビルドエラーなし

**コミット**: `feat(nu-4): Sub-step 4A-1: fix hardcoded name in MypageClient greeting`

---

## Sub-step 4A-2: getUser() → getSession() 置換（5ファイル）

**目的**: Client Component での `getUser()` 呼び出しを `getSession()` に置換し、Navigator Lock タイムアウトを解消する

**背景**:
- `getUser()` はブラウザの Navigator Lock を取得し、React Strict Mode の二重マウントで競合が発生する
- Client Component での表示用途には `getSession()` で十分（サーバー検証不要）
- Server Component・middleware・API Route での `getUser()` はそのまま維持する（認証クリティカル）

**対象ファイル（5ファイル）**:

1. `src/app/(jobseeker)/mypage/applications/page.tsx`（line 77）
2. `src/app/(jobseeker)/mypage/conversations/page.tsx`（確認）
3. `src/app/(jobseeker)/mypage/conversations/[id]/page.tsx`（確認）
4. その他 `(jobseeker)` 配下の Client Component（4A-0 のグレップ結果で確定）
5. （5ファイル目は調査結果次第）

**置換パターン**:
```typescript
// Before
const { data: { user } } = await supabase.auth.getUser();

// After
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
```

**downstream の変更**: `user.id` は `session.user.id` と同値のため、`.eq("auth_id", user.id)` 等の downstream は変更不要

**完了条件**:
- 5ファイルすべてで `getUser()` → `getSession()` 置換完了
- TypeScript エラーなし
- `/mypage` 各ページが正常に表示される

**コミット**: `feat(nu-4): Sub-step 4A-2: replace getUser() with getSession() in 5 Client Components`

---

## Sub-step 4A-3: /mypage/applications フロー確認

**目的**: 応募管理ページが既に Supabase 接続済みであることを確認し、追加実装の要否を判断する

**確認内容**:
1. `src/app/(jobseeker)/mypage/applications/page.tsx` を開き、全フローを目視確認
2. SELECT クエリ（`ow_job_applications`）が正常に動作するか確認
3. 新規応募 INSERT フローの実装状況を確認
4. 画面上で実際にデータが表示されているか（テストアカウントでログイン）

**完了条件**:
- 追加実装が不要な場合: 「確認完了、追加作業なし」とレポート
- 追加実装が必要な場合: 必要な変更をリストアップして柴さんに報告

**コミット**: なし（確認のみ）または軽微な修正のみ

---

## Sub-step 4A-4: migration 070 作成・適用

**目的**: `ow_conversation_messages` の INSERT RLS と `ow_conversations` / `ow_conversation_participants` の SELECT RLS を修正する

**ファイル**: `supabase/migrations/070_fix_conversation_rls.sql`

**内容**:

### Part 1: INSERT RLS 修正（§4-8 対応）

現状の問題:
```sql
-- migration 060 の壊れた RLS（auth.uid() は ow_users.id と比較できない）
CREATE POLICY "participants_can_insert_messages" ON ow_conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_conversation_participants
      WHERE conversation_id = ow_conversation_messages.conversation_id
        AND user_id = auth.uid()  -- ← 常に false（UUID 空間が異なる）
    )
  );
```

修正後:
```sql
-- 正しいパターン: ow_users 経由で auth_id を照合
DROP POLICY IF EXISTS "participants_can_insert_messages" ON ow_conversation_messages;

CREATE POLICY "participants_can_insert_messages" ON ow_conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_conversation_participants p
      JOIN ow_users u ON u.id = p.user_id
      WHERE p.conversation_id = ow_conversation_messages.conversation_id
        AND u.auth_id = auth.uid()
    )
  );
```

### Part 2: SELECT RLS 緩和（企業側アクセス）

企業側管理者が `ow_conversations` と `ow_conversation_participants` を参照できるよう緩和:

```sql
-- ow_conversations: company_admin も参照可能に
DROP POLICY IF EXISTS "company_or_participant_can_select" ON ow_conversations;

CREATE POLICY "company_or_participant_can_select" ON ow_conversations
  FOR SELECT USING (
    -- 参加者として登録済み
    EXISTS (
      SELECT 1 FROM ow_conversation_participants p
      JOIN ow_users u ON u.id = p.user_id
      WHERE p.conversation_id = ow_conversations.id
        AND u.auth_id = auth.uid()
    )
    OR
    -- 企業管理者として company_id が一致
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ow_company_admins ca
        JOIN ow_users u ON u.id = ca.user_id
        WHERE ca.company_id = ow_conversations.company_id
          AND u.auth_id = auth.uid()
          AND ca.is_active = true
      )
    )
  );

-- ow_conversation_participants: 上記と同様の緩和
-- （詳細は uncertainty-resolution.md の SQL 草案を参照）
```

**適用方法**: 柴さんに SQL ファイルを渡して Supabase ダッシュボードから手動実行（MCP write 禁止）

**完了条件**:
- `supabase/migrations/070_fix_conversation_rls.sql` 作成
- ロールバックファイル `supabase/rollbacks/070_rollback.sql` 作成
- 柴さんが適用完了後、MCP で SELECT テストを実行して確認

**コミット**: `feat(nu-4): Sub-step 4A-4: migration 070 - fix conversation INSERT RLS + SELECT relaxation`

---

## Sub-step 4A-5: テストデータ作成（biz 検証用）

**目的**: `ow_conversations` テーブルにテストデータを投入し、`/biz/conversations` 実装の検証を可能にする

**背景**: Step 4-4 でテストデータが削除され、現在 `ow_conversations` は空（0件）

**投入データ**:
1. `ow_conversations` に 2〜3件のレコード（kind: 'company', stage: 'inquiry' / 'casual_meeting'）
2. `ow_conversation_participants` に対応する参加者レコード（candidate + company_admin）
3. `ow_conversation_messages` に数件のテストメッセージ

**方法**: SQL ファイルを作成し、柴さんに手動実行を依頼（INSERT は Supabase ダッシュボード経由）

**完了条件**:
- MCP で `SELECT count(*) FROM ow_conversations` → 2件以上
- MCP で messages が存在することを確認
- biz 管理者アカウントが participant として登録されているか確認

**コミット**: `feat(nu-4): Sub-step 4A-5: add test data seed for biz conversations`（SQLファイルのコミット）

---

## Sub-step 4A-6: /biz/conversations 一覧ページ実装

**目的**: 企業側の対話一覧ページを実装する

**ファイル**: `src/app/biz/conversations/page.tsx`（新規 or 既存確認）

**データ取得**:
```typescript
// getTenantContext() を使って company_id を取得
// ow_conversations WHERE company_id = tenantId
// ORDER BY last_message_at DESC NULLS LAST, created_at DESC
// JOIN ow_conversation_participants（候補者情報）
// JOIN ow_users（候補者名）
// JOIN ow_conversation_messages（最新メッセージ）
```

**UI 要件**:
- 対話一覧カード: 候補者名、最新メッセージプレビュー、stage バッジ、経過時間
- stage フィルター: inquiry / casual_meeting / interview / offer / closed
- 未読バッジ: 赤ドット（詳細計算は Phase ν-5 以降、現状は常時表示 or 非表示）
- 対話が0件の場合の空状態表示

**デザイン**: 既存 `/biz/meetings` ページのスタイルに準拠

**完了条件**:
- テストデータ（4A-5 で投入）が一覧に表示される
- stage フィルターが動作する
- 各カードをクリックすると 4A-7 の詳細ページに遷移する
- TypeScript エラーなし

**制約**:
- 流用範囲: ロジック骨格のみ参考にする
  （getSession → ow_users 取得 → SELECT conversations → 未読判定の流れ）
  候補者側 `/mypage/conversations` の `SIDEBAR_ITEMS` や `<aside>` JSX、
  レイアウト構造はコピーしない
  （`phase-nu-4-step-6-pre-investigation.md` で「企業側は系統 A で BusinessLayout を直接 wrap」と確定）
- レイアウト: `BusinessLayout` コンポーネントを直接 wrap する形で新規作成
  （`/biz/layout.tsx` は存在しない。`/biz/dashboard/page.tsx` と同じパターン）
  これは Phase ν-3 以前から存在する候補者側の系統 A/B 不整合に企業側を
  引きずられないための予防策。

**コミット**: `feat(nu-4): Sub-step 4A-6: implement /biz/conversations list page`

---

## Sub-step 4A-7: /biz/conversations/[id] 詳細・返信・join API Route 実装

**目的**: 企業側の対話詳細ページと返信機能、および HR 参加者追加 API を実装する

### 詳細ページ: `src/app/biz/conversations/[id]/page.tsx`

**データ取得**:
- `ow_conversations` 詳細（stage, status, kind）
- `ow_conversation_messages` 全件（sent_at ASC）
- `ow_conversation_participants` 全員（role, user情報）
- 企業管理者が participant に登録されているか確認

**UI 要件**:
- チャット形式メッセージ表示（求職者側 `/mypage/conversations/[id]` と同様のデザイン）
- 返信入力エリア（textarea + 送信ボタン）
- stage 変更ドロップダウン（inquiry → casual_meeting → interview → offer → closed）
- 参加者一覧（HR 追加ボタン含む）
- 候補者プロフィールサマリーを表示
  - 表示カラム: `name`, `about_me`, `age_range`, `location`
  - `ow_users.current_role` は存在しないため表示しない
    （詳細は `phase-nu-4-step-7-pre-investigation.md` 重大発見 2 参照）
  - 「プロフィール詳細を見る」リンクを 1 つ配置（候補者の詳細プロフィール画面へ）

### 返信 API: `src/app/api/biz/conversations/[id]/messages/route.ts`

```typescript
// POST: メッセージ送信
// 1. getTenantContext() で owUserId 取得
// 2. ow_conversation_participants で自分の participant_id を取得
//    → なければ lazy registration（INSERT into ow_conversation_participants）
// 3. ow_conversation_messages に INSERT
// 4. ow_conversations.last_message_at を UPDATE
```

- 送信パターン: 候補者側返信フォームと同じパターンに揃える
  （`phase-nu-4-step-7-pre-investigation.md` の「候補者側返信フォームの実装パターン」参照）
  対称性とメンテナンス容易性を優先するため、候補者側と HR 側で送信経路を
  バラバラにしない

### Lazy Registration: ハイブリッド方式

- **候補者 → candidate participant**: 既存 RPC `create_conversation` が担当（変更なし）
- **HR → company_admin participant**: 返信時に API Route で lazy registration
  ```typescript
  // 返信 API 内部
  const { data: existingParticipant } = await supabase
    .from('ow_conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', owUserId)
    .maybeSingle();

  if (!existingParticipant) {
    // 初回返信時に自動登録
    await supabase.from('ow_conversation_participants').insert({
      conversation_id: conversationId,
      user_id: owUserId,
      role: 'company_admin',  // CHECK 制約許可値(2026-05-08 修正: 'hr' → 'company_admin')
    });
  }
  ```

### Stage 変更 API: `src/app/api/biz/conversations/[id]/stage/route.ts`

```typescript
// PATCH: stage 変更
// 認証チェック + company_id 照合後、UPDATE
```

**完了条件**:
- テストデータのメッセージが詳細画面に表示される
- HR が返信を送信できる（初回は lazy registration が走る）
- stage 変更が DB に反映される
- TypeScript エラーなし

**コミット**: `feat(nu-4): Sub-step 4A-7: implement /biz/conversations/[id] detail + reply + lazy join`

---

## Sub-step 4A-8: 引き継ぎ書 v18 作成

**目的**: Phase ν-4 の実施内容をまとめ、次のセッションへの引き継ぎ書を作成する

**ファイル**: `docs/handoff/handover-2026-05-06-nu4-complete.md`（日付は実際の完了日に更新）

**記載内容**:
- Phase ν-4 実施サマリー（各 Sub-step の完了状況）
- migration 070 の詳細と確認結果
- テストデータの状況
- 残タスク（Phase ν-5 以降のスコープ）
- 次のセッションでやること

**Phase ν-4 実装で得た技術的知見**:

- **DML CTE の実行保証**: PostgreSQL の WITH 句内の DML CTE（INSERT/UPDATE/DELETE）は、
  最終 SELECT から参照されない場合、実行されないことがある（最適化により除去される）。
  確実に実行したい場合は最終 SELECT で明示的に参照する。
  例: `SELECT (SELECT id FROM update_conv1) AS updated_id`
  （Sub-step 4A-5 で update_conv1/2 が未実行となり last_message_at が null になった事例から）

- **ow_conversation_participants の role CHECK 制約**:
  許可値は `'candidate' / 'company_admin' / 'mentor' / 'editor' / 'operator'`。
  `'hr'` は許可されていない。企業側参加者には `'company_admin'` を使う。
  （Sub-step 4A-5 シードデータ投入時に CHECK 違反で発覚）

**Phase ν-5 候補スコープの仮置き**:
- 候補者側マイページのサイドバー系統統一: 現状 /mypage 本体（系統 A:
  「マイアクティビティ」サイドバー + MOCK 切替バー）と /mypage/conversations、
  /mypage/applications 等（系統 B: シンプルサイドバー）で UI が分断している。
  Phase ν-3 以前から存在する既知の課題（優先順位を下げて放置）。
  Phase ν-5 で layout 設計を見直して統一する。

  影響ページ調査が必要（系統 A: /mypage、系統 B: 現時点で /mypage/conversations
  と /mypage/applications を確認、他にも該当ページがある可能性）。
  原因は Next.js App Router の layout.tsx 階層分岐にあると推測。
- migration 071: `ow_conversation_messages` UPDATE ポリシーの UUID 不一致バグ修正
  （4A-6/4A-7 事前調査で発見。UPDATE の `user_id = auth.uid()` 直接比較が常に false
  → メッセージ編集・論理削除が一般ユーザーに不可。4A-7 では編集・削除機能を
  持たないため non-blocking だが、将来実装時に必要）
- `ow_users.current_role` カラムの追加検討
  （現職情報の表示に必要。追加するなら `ow_companies` との関連設計も検討。
  4A-7 の候補者プロフィールサマリーでは非表示で回避済み）

**完了条件**:
- 引き継ぎ書が作成され、コミット済み
- 柴さんへの報告・次フェーズの提案が含まれている

**コミット**: `docs(handoff): add v18 — Phase nu-4 complete`

---

## 依存関係・実施順序

```
4A-0（グレップ確認）
    ↓
4A-1（MypageClient 修正）
    ↓
4A-2（getUser → getSession 置換）
    ↓
4A-3（applications 確認）
    ↓
4A-4（migration 070）← 柴さん手動適用が必要
    ↓
4A-5（テストデータ投入）← 柴さん手動実行が必要
    ↓
4A-6（/biz/conversations 一覧）
    ↓
4A-7（/biz/conversations/[id] 詳細）
    ↓
4A-8（引き継ぎ書 v18）
```

---

## 制約・ルール

1. **各 Sub-step 完了後に柴さんの承認を得てから次へ進む**
2. **DB への直接 write は禁止** → SQL ファイルを作成し、柴さんに手動実行を依頼する
3. **worktree 禁止** → main ブランチに直接コミットする
4. **`getUser()` を Server Component で使う場合は変更しない**（auth-critical なため）
5. **mock データファイル内のハードコードは変更しない**（UI への影響なし）
6. **コミットは各 Sub-step 単位** → まとめてコミットしない

### worktree 運用ルール（Phase ν-4 中の追加ルール）

- Phase ν-4 中は worktree を使わない（main で直接作業）
- もし Claude Code が自動で worktree を作ろうとした場合、ユーザー確認を取る
- 作業前に必ず `git worktree list` で worktree が main 1 つだけであることを確認
- dev server は main で 1 つだけ起動する（複数起動禁止）

---

## 完了条件（Phase ν-4 全体）

- [ ] 4A-0: ハードコード名の UI 影響箇所を特定・報告
- [ ] 4A-1: `/mypage` の歓迎メッセージが実ユーザー名を表示する
- [ ] 4A-2: 5 Client Component ファイルで `getSession()` に切り替え完了
- [ ] 4A-3: `/mypage/applications` の動作確認完了
- [ ] 4A-4: migration 070 適用済み、INSERT RLS が機能する
- [ ] 4A-5: テストデータ投入済み、MCP で確認完了
- [ ] 4A-6: `/biz/conversations` 一覧ページが動作する
- [ ] 4A-7: `/biz/conversations/[id]` 詳細・返信が動作する
- [ ] 4A-8: 引き継ぎ書 v18 作成・コミット済み
