# Phase ν-4 スコープ比較分析

**作成日**: 2026-05-06
**ベース**: 引き継ぎ書 v17 §5-2 + コードベース実態調査
**ステータス**: Hisato 確認待ち

---

## 0. 調査方法

- `docs/handoff/handover-2026-05-06-step-4-complete.md` §5-2, §4-8, §4-19, §4-20, §4-22 精読
- `supabase/migrations/060_rls_phase_nu_conversation_tables.sql` (INSERT RLS 内容確認)
- `supabase/migrations/064_fix_ow_job_applications_rls.sql` (応募管理 RLS 確認)
- `supabase/migrations/067_fix_ow_conversation_participants_select_no_recursion.sql` (INSERT RLS 残存確認)
- `src/app/(jobseeker)/mypage/applications/page.tsx` (実装状況確認)
- `src/app/(jobseeker)/mypage/page.tsx` + `MypageClient.tsx` (名前表示の実態確認)
- `grep -r "supabase.auth.getUser"` 全ファイル一覧取得 → Server Component か Client Component か分類

---

## 1. 各候補の実態確認

### 候補 1: 企業側対話 UI

**実装ゼロ。** `/biz/conversations/` ディレクトリは存在しない。

ブロッカー — `ow_conversation_participants` の INSERT RLS (§4-8):

```sql
-- migration 060 現在の INSERT ポリシー(抜粋)
CREATE POLICY "ow_conversation_participants_insert"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants AS existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()   -- ← 旧パターン (UUID 型不一致)
      AND existing.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

問題点:
1. `auth.uid()` 直接比較(UUID 型不一致 + ow_users 経由でない旧パターン)
2. 「既に participant である人しか新規参加者を追加できない」設計 → 企業担当者が初めてアクセスする lazy 登録が不可能

現在の回避策: `create_conversation` RPC が `SECURITY DEFINER` で RLS バイパスして初回 participant 挿入。しかし企業側からの「対話を開いたとき自動で参加者登録される」lazy 登録フローは未実装。

影響ページ想定: 最低 2 ページ(対話一覧 `/biz/conversations`、対話詳細 `/biz/conversations/[id]`)+ API Route 1 本(participant lazy 登録)。

---

### 候補 2: 応募管理機能 (/mypage/applications)

**実態: 既にかなり出来ている。**

- ファイル: `src/app/(jobseeker)/mypage/applications/page.tsx` (342 行)
- Supabase 接続済み: `ow_job_applications` から `SELECT` している
- RLS: migration 064 で `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` パターンに修正済み
- フィルタータブ(すべて / 書類選考中 / 面接中 / 内定)、プログレスステップ表示まで実装済み

残っている問題:
1. **getUser() の Auth Lock リスク**: Client Component で `supabase.auth.getUser()` を使用(line 77)。`(jobseeker)` 配下で JobseekerHeader と同一ページに乗るため、Header の getSession 修正後も applications 側の getUser が残存している
2. **応募(INSERT)フローが未確認**: `/jobs/[id]/apply/page.tsx` が存在するが、ow_job_applications への INSERT が正常に動くかの動作確認が取れていない(§4-5 相当の未確認)

biz 側の `/biz/applications` は既に実装完了(Server Component + Supabase 接続済み)。

---

### 候補 3: §4-19 / §4-20

#### §4-19: マイページ TOP「田中翔太」表示矛盾

実態調査結果: **`MypageClient.tsx` の名前表示は既に Supabase から正しく取得している。**

```typescript
// MypageClient.tsx line 910
const userName = owUser?.name ?? "ユーザー";  // ← ow_users.name から取得
```

`MypageClient.tsx` は `MOCK_USER` を import しているが、`userName` の決定に使っていない。ただし `MOCK_BOOKMARKS_ARTICLES`, `MOCK_BOOKMARKS_MENTORS`, `MOCK_RECEIVED_REQUESTS` は mock のまま参照。

「田中翔太」が表示される具体箇所: v17 明記なし。`MOCK_USER.name` を直接参照している場所がある可能性があるが、`grep` 調査では `userName` を使う経路が優先されているように見える。**どの画面・どのコンポーネントで表示されるか要確認。**

推定作業量: 小(原因特定 → 1 箇所修正で完了の可能性が高い)

#### §4-20: getUser() 残存 — 実態調査結果

`grep -r "supabase.auth.getUser"` で取得した `(jobseeker)` 配下ファイルを、Server Component / Client Component で分類した:

| ファイル | コンポーネント種別 | Auth Lock リスク |
|---|---|---|
| `mypage/page.tsx` | **Server Component** | なし(Server は Lock 不使用) |
| `mypage/applications/page.tsx` | **Client Component** | ⚠️ あり |
| `mypage/company-membership/new/page.tsx` | **Client Component**(callback 内) | ⚠️ あり |
| `mypage/work-history/new/page.tsx` | **Client Component**(callback 内) | ⚠️ あり |
| `auth/page.tsx` | **Client Component**(useEffect 内) | ⚠️ あり |
| `mentors/[id]/reserve/page.tsx` | **Server Component** | なし |
| `profile/edit/page.tsx` | **Server Component** | なし |
| `jobs/[id]/apply/page.tsx` | **Server Component** | なし |
| `companies/[id]/casual-meeting/page.tsx` | **Server Component** | なし |
| `companies/[id]/page.tsx` | **Client Component**(Promise.all 内) | ⚠️ あり |

**実際のリスクあり Client Component: 5 ファイル**(v17 の「12 件」は Server Component を含んでいたため過大見積もり)

置換ルール: Server Component の `getUser()` はサーバー認証として正当 → **変更不要**。Client Component の `getUser()` のみ `getSession()` に置換。

---

### 候補 4: 未読件数バッジ (§4-22)

現状実装 (`src/app/(jobseeker)/mypage/conversations/page.tsx` line 224):

```tsx
{hasUnreadMap.get(conv.id) && (
  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500"
       aria-label="未読あり" title="未読あり" />
)}
```

拡張に必要な変更:
1. `hasUnreadMap: Map<string, boolean>` → `unreadCountMap: Map<string, number>` に変更
2. JS 側の `some()` → `filter().length` に変更
3. バッジ表示: 赤丸 → 数値入りバッジ(LINE スタイル: `w-5 h-5 text-xs text-white`)

データ取得変更なし(3 クエリ構成は同じ)。純 UI 変更。

推定作業量: 極小(15〜20 行の変更)

---

## 2. 比較表

| 軸 | 候補 1: 企業側対話 UI | 候補 2: 応募管理 | 候補 3: §4-19/4-20 | 候補 4: 未読件数バッジ |
|---|---|---|---|---|
| **ユーザー価値** | 高: 企業担当者が対話に参加できない現状を解消。対話機能の双方向化で Opinio Work の核心価値が完成 | 中: 求職者が応募状況を一元管理。既にほぼ実装済みなので「完成させる」意味が強い | 低〜中: Auth Lock は潜在バグ解消(緊急性低)、名前表示は UX 違和感解消 | 低: 赤丸バッジで十分 MVP。件数は「情報過多」との見解が Hisato 思想と一致するかは v17 明記なし |
| **技術的依存関係** | §4-8 の migration が必須ブロッカー。migration 1 本 → biz 側 UI 実装の順。他候補に依存なし | 依存なし。RLS は migration 064 で解決済み | 依存なし。§4-19 と §4-20 は独立 | 候補 1 完了後に企業側にも同機能が必要になる可能性あり |
| **実装規模** | 大: migration 1 本 + `/biz/conversations/` 2 ページ + API Route(lazy 登録)。想定 4〜5 sub-step | 極小〜小: getUser → getSession 置換 1 箇所 + 応募 INSERT 動作確認。1 sub-step | 小: §4-19 は原因特定後 1〜2 行。§4-20 は 5 ファイルの置換(各 1 行)。合計 2〜3 sub-step | 極小: 15〜20 行変更。0.5 sub-step |
| **リスク** | 高: §4-8 の INSERT RLS 修正で既存 `create_conversation` RPC(SECURITY DEFINER)との干渉確認が必要。企業側 RLS の認証経路(tenant_id / company_id)との整合も要確認 | 低: 既存ページへの最小変更。RLS 修正済み | 低: §4-20 の Server Component 誤判定リスクあり(見落とし)。§4-19 は原因特定次第 | 極低: UI のみ。他機能への影響なし |

---

## 3. 優先順位の提案

### 推奨: §4-19/4-20 で負債返済 → 企業側対話 UI

**1 位: 候補 3(§4-19/4-20 消化)**

理由:
- 工数極小(半日〜1 日)で潜在バグと UX 違和感を一掃できる
- §4-20 の Auth Lock 修正は「応募管理ページ」「会員登録ページ」等の主要ページに残存しており、今後のリリース前に確実に潰すべき負債
- 企業側 UI 開発に入る前の「テーブルの上をきれいにする」作業として適切

**2 位: 候補 2(応募管理機能 完成)**

理由:
- 候補 3 の中に `applications/page.tsx` の getUser 修正が含まれる → そのまま動作確認まで完走するのが自然
- 既に 342 行の実装があり「仕上げ」工数が小さい
- ow_job_applications SELECT は機能しているが INSERT フロー(`/jobs/[id]/apply`)の確認がまだ

**3 位: 候補 1(企業側対話 UI)**

理由:
- Phase ν の対話機能を双方向化する最重要機能
- ただし §4-8 migration が必須先行作業のため、スコープが「migration + biz UI」のセットになる
- Phase ν-4 のメインスコープとして適切な規模感

**4 位: 候補 4(未読件数バッジ)**

理由:
- MVP として赤丸バッジで十分
- 企業側の対話 UI が整ってからでも遅くない(企業側の未読表示と同時設計のほうが一貫性がある)
- Hisato 思想(数値データ撤廃)と「未読件数」表示の整合性も未確認のため、後回し推奨

---

## 4. 推奨 Phase ν-4 のスコープ案

### 案 A: 負債返済 → 企業側対話 UI(推奨)

```
Sub-step 4A-1: §4-19 原因特定 + 修正(mypage TOP の名前)
Sub-step 4A-2: §4-20 Client Component getUser → getSession 置換(5 ファイル)
Sub-step 4A-3: 応募管理 /mypage/applications の動作確認 + INSERT 確認
Sub-step 4A-4: migration for §4-8(ow_conversation_participants INSERT RLS 修正)
Sub-step 4A-5: /biz/conversations 一覧ページ
Sub-step 4A-6: /biz/conversations/[id] 詳細 + 返信フォーム + lazy 登録 API
```

総工数見積: 中(2〜3 セッション)

### 案 B: 企業側対話 UI のみ集中(大きく前進したい場合)

```
Sub-step 4B-1: migration §4-8 修正
Sub-step 4B-2: /biz/conversations 一覧ページ
Sub-step 4B-3: /biz/conversations/[id] 詳細 + 返信 + lazy 登録 API
```

負債(§4-19/4-20)は Phase ν-5 に持ち越し。

### 案 C: 小さく完結させたい場合(バッファ小のとき)

```
Sub-step 4C-1: §4-20 getUser 置換(5 ファイル、1 時間)
Sub-step 4C-2: §4-19 名前修正(30 分)
Sub-step 4C-3: 候補 4 未読件数バッジ(1 時間)
```

次の大きな作業(企業側 UI)は Phase ν-5 に回す。

---

## 5. 先に潰しておくべき不確実性

### 不確実性 1: §4-8 migration の干渉リスク(高優先)

現在 `create_conversation` RPC は `SECURITY DEFINER` で INSERT RLS をバイパスしている。
§4-8 の INSERT RLS 修正後も RPC がバイパスし続けるのかを確認が必要:

```sql
-- 確認クエリ(Phase ν-4 着手前に実行)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'ow_conversation_participants' AND cmd = 'INSERT';

-- RPC のセキュリティ設定確認
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name = 'create_conversation';
```

### 不確実性 2: §4-19「田中翔太」の表示箇所特定(低優先、着手時に確認)

`MypageClient.tsx` の `userName` は `owUser?.name` を参照しており正しい。
しかし `MOCK_USER` が import されておりダッシュボード内の特定ビュー(受けた相談一覧等)で `MOCK_USER.name` を直接参照している可能性がある。
Phase ν-4 着手時にブラウザで実際の表示箇所を確認してから修正方針を決める。

### 不確実性 3: 企業側対話 UI の認証経路(候補 1 着手時に要設計)

企業側の対話 UI は「どの企業の対話を表示するか」を `tenant_id`(会社 ID)で絞る必要がある。
現在の `getTenantContext()` が `ow_conversation_participants` と `ow_conversations` をどう絞るか、
`company_id` カラムとの JOIN 設計を Phase ν-4 着手前に確認する:

```sql
-- 確認クエリ: ow_conversations の company_id 参照
SELECT id, kind, company_id, candidate_user_id FROM ow_conversations LIMIT 5;
```

---

## 6. Hisato 確認待ち

以下 3 点について判断をお願いします。

**Q1: Phase ν-4 のスコープは案 A / B / C のどれを選択しますか？**

- **案 A(推奨)**: 負債返済 → 企業側対話 UI の順で進む(2〜3 セッション)
- **案 B**: 企業側対話 UI に集中する。負債は後回し
- **案 C**: 今回は小さく完結させ、企業側 UI は Phase ν-5 に回す

**Q2: 未読件数バッジ(候補 4)は赤丸のままで OK ですか？**

v17 §3-2 では「あり/なしフラグのみ、件数は Phase ν-4 以降で UX レビュー込みで判断」と記録されています。Hisato 思想の「数値データ撤廃」と未読件数表示の整合性についてご意見をお聞かせください。

**Q3: 企業側対話 UI で「企業担当者の lazy 登録」はどのタイミングで行いますか？**

選択肢:
- A. 企業担当者が対話詳細 `/biz/conversations/[id]` を開いたとき自動登録
- B. 対話一覧から明示的に「参加する」ボタンを押したとき登録
- C. 運営が手動で participant を追加(RPC 経由、UI は不要)

v17 明記なし。§4-8 の migration 設計に影響するため、着手前に確認が必要です。

---

*分析終了 — 実装ゼロ、grep / read のみ*
