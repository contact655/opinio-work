# Phase ν-4 不確実性解消レポート

**作成日**: 2026-05-06
**調査手段**: Supabase MCP (SELECT only) + ローカルコードベース grep/read
**前提**: 案 A(§4-19/4-20 → 応募管理 → 企業側対話 UI)スコープ確定済み

---

## 調査 1: §4-8 migration の干渉リスク

### 1-1. RLS ポリシー実態(クエリ結果 生)

#### ow_conversation_participants の全ポリシー

| policyname | cmd | qual (USING) | with_check |
|---|---|---|---|
| `ow_conversation_participants_insert` | INSERT | null | `EXISTS (SELECT 1 FROM ow_conversation_participants existing WHERE existing.conversation_id = ow_conversation_participants.conversation_id AND existing.user_id = auth.uid() AND existing.left_at IS NULL) OR EXISTS (SELECT 1 FROM ow_user_roles WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin')` |
| `ow_conversation_participants_select` | SELECT | `user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()) OR EXISTS (SELECT 1 FROM ow_user_roles WHERE ow_user_roles.user_id = auth.uid() AND ow_user_roles.role = 'admin')` | null |
| `ow_conversation_participants_update` | UPDATE | `user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()) OR EXISTS (...)` | `user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()) OR EXISTS (...)` |

#### ow_conversations の全ポリシー

| policyname | cmd | qual (USING) | with_check |
|---|---|---|---|
| `ow_conversations_insert` | INSERT | null | `candidate_user_id = auth.uid() OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')` |
| `ow_conversations_select` | SELECT | `EXISTS (SELECT 1 FROM ow_conversation_participants p WHERE p.conversation_id = ow_conversations.id AND p.user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())) OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')` | null |
| `ow_conversations_update` | UPDATE | `EXISTS (SELECT 1 FROM ow_conversation_participants WHERE conversation_id = ow_conversations.id AND user_id = auth.uid() AND left_at IS NULL) OR EXISTS (...)` | null |

### 1-2. create_conversation RPC のセキュリティ設定

`information_schema.routines` では見えなかった(Supabase 接続ユーザーの権限制限)が、`pg_proc` で確認:

```
proname:   create_conversation
prosecdef: true   ← SECURITY DEFINER 確認済み
```

関数本体も確認済み(pg_proc.prosrc より)。内容は migration 063 と一致。`SECURITY DEFINER` かつ `SET search_path = public, pg_temp`、呼び出し元の auth.uid() 再認証チェックあり。

### 1-3. 評価: 干渉リスクの有無 + ハイブリッド方針との整合

#### INSERT RLS の現状

```sql
-- 現在の INSERT WITH CHECK (問題のある旧パターン)
existing.user_id = auth.uid()   -- ← ow_users.id (UUID) vs auth.uid() (UUID)
                                 --   型は同じだが「auth.uid() = auth UUID」「user_id = ow_users.id」で意味が異なる
                                 --   auth_id と id を混同している
```

v17 §4-8 の指摘通り: `existing.user_id` は `ow_users.id` (アプリ UUID)、`auth.uid()` は `auth.users.id` (Auth UUID)。**別の UUID 空間を直接比較しているため、この条件は常に false になる。** 現状は `admin` ロールのみが INSERT できる状態。

#### SECURITY DEFINER による安全性

`create_conversation` RPC は `prosecdef: true` = **RLS を完全バイパス**する。§4-8 の INSERT RLS を修正しても、RPC 経由の初回 participant 登録(候補者側の `candidate` ロール)には一切影響しない。

#### ハイブリッド方針との整合

- **Initial participant 登録(RPC 経由)**: SECURITY DEFINER がバイパス → §4-8 修正後も問題なし ✅
- **追加 HR 担当者の参加(「参加する」ボタン → API Route)**: 現在の INSERT WITH CHECK は常に false のため INSERT 不可 → §4-8 で修正が必要 ✅ (修正の動機が明確)

#### 新規 INSERT ポリシーの素案(§4-8 migration 用)

```sql
-- 追加する条件: ow_company_admins に同 company_id で登録された HR 担当者が参加可能
-- 既存の INSERT ポリシーを置き換える
DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants
FOR INSERT
WITH CHECK (
  -- 条件 A: 同じ対話の既存 participant (ow_users.id 経由で正確に比較)
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    JOIN ow_users u ON u.id = existing.user_id
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND existing.left_at IS NULL
  )
  -- 条件 B: 同社の ow_company_admins に登録された HR 担当者が自社対話に参加
  OR EXISTS (
    SELECT 1 FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.company_id = ca.company_id
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 C: admin (運営)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

**判定: GO**
- `create_conversation` RPC は SECURITY DEFINER 確認済み → §4-8 修正で壊れない
- INSERT RLS の現状の `auth.uid()` 直接比較は常に false → 修正が必要かつ安全
- ハイブリッド方針(RPC 維持 + API Route 追加参加)と整合する設計が可能

---

## 調査 2: 「田中翔太」の表示箇所

### 2-1. grep 結果

```
src/app/(jobseeker)/mypage/MypageClient.tsx:303:  おかえりなさい、田中翔太さん
src/app/(jobseeker)/mypage/MypageClient.tsx:366:  {MOCK_USER.currentRole}
src/app/(jobseeker)/mypage/MypageClient.tsx:388:  {MOCK_USER.profileCompletion}%
src/app/(jobseeker)/mypage/MypageClient.tsx:393:  width: `${MOCK_USER.profileCompletion}%`
src/app/(jobseeker)/page.tsx:18:  name: "田中 翔太"            ← トップページ mock データ
src/app/(jobseeker)/page.tsx:577:  { name: "田中 翔太", ... }  ← トップページ求職者カード
src/app/mypage/mockMypageData.ts:117:  name: "田中 翔太"        ← mock データファイル
src/app/mypage/mockMypageData.ts:221:  meta: "田中翔太さん · タイミー · ..."
src/app/mypage/mockMypageData.ts:351:  requester_name: "田中 翔太"
src/lib/business/mockTenantContext.ts:112:  candidateName: "田中 翔太"
src/lib/business/mockMeetings.ts:54:  applicantName: "田中 翔太"
src/app/jobs/mockJobData.ts:134:  { name: "田中 翔太", ... }
src/app/companies/[id]/mockDetailData.ts:413:  name: "田中 翔太さん"
src/app/(jobseeker)/profile/edit/mockProfileData.ts:47:  name: "田中 翔太"
src/app/profile/edit/mockProfileData.ts:47:  name: "田中 翔太"
```

### 2-2. 名前表示ロジックの実態

`MypageClient.tsx` の名前決定経路:

```typescript
// MypageWrapper (line 910) — Supabase から正しく取得している
const userName = owUser?.name ?? "ユーザー";  // ow_users.name を使用

// dashboard ビュー (line 351) — userName を正しく使用
{userName}  ← ここは正しい

// dashboard ビュー (line 303) — ハードコードされたリテラル ⚠️
おかえりなさい、田中翔太さん  ← userName を使っていない
```

つまり:
- メインヘッダー部分(`{userName}`)は Supabase の `ow_users.name` を正しく表示する
- ダッシュボードビューのウェルカムメッセージ(line 303)は **ハードコードされた「田中翔太さん」のリテラル文字列**

`MOCK_USER.currentRole` (line 366) と `MOCK_USER.profileCompletion` (line 388/393) は名前ではないが、**プロフィールデータも mock のまま**であることを確認。

### 2-3. 評価: 修正対象箇所の確定リスト

#### UI に表示される「田中翔太」の修正対象

| # | ファイル | 行番号 | 内容 | 修正方針 |
|---|---|---|---|---|
| 1 | `MypageClient.tsx` | 303 | `田中翔太さん` リテラル | `{userName}さん` に置換(1行) |
| 2 | `MypageClient.tsx` | 366 | `{MOCK_USER.currentRole}` | `owUser` から取得するか引数追加が必要 |
| 3 | `MypageClient.tsx` | 388/393 | `{MOCK_USER.profileCompletion}` | プロフィール完成度計算は未実装(Phase 5 以降) → 現状 mock 据え置きでも可 |

#### mock データファイル内(UI に影響しない)

`mockMypageData.ts`, `mockTenantContext.ts`, `mockMeetings.ts`, `mockJobData.ts`, `mockDetailData.ts`, `mockProfileData.ts`, `page.tsx`(トップページのデモカード) — これらはすべて mock データの宣言であり、現在の Supabase 接続済みコンポーネントの表示には使われていない。**変更不要。**

**判定: 修正対象 2 箇所**(UI に直接影響するもの)

1. `MypageClient.tsx:303` — `田中翔太さん` → `{userName}さん` (1行修正、確実)
2. `MypageClient.tsx:366` — `MOCK_USER.currentRole` → `owUser` の値を使う(要引数追加 or props 変更)

修正 2 は `MypageWrapper` が `owUser` を持っているため、`owUser?.current_role` 相当のカラムが `ow_users` にあるかどうかで実装方針が分かれる。→ §4-19 着手時に確認。

作業量の再見積もり: **変更なし(小のまま)**。ハードコードが 1 箇所で、他は mock データファイルの定数。

---

## 調査 3: 企業側対話 UI の認証経路

### 3-1. ow_conversations 構造(クエリ結果 生)

```
column_name         data_type                   is_nullable
------------------------------------------------------------
id                  uuid                        NO
kind                text                        NO
stage               text                        NO
company_id          uuid                        YES   ← nullable (mentor 対話は null)
mentor_user_id      uuid                        YES   ← nullable (company 対話は null)
candidate_user_id   uuid                        NO
status              text                        NO
last_message_at     timestamptz                 YES
created_at          timestamptz                 NO
```

⚠️ **`updated_at` カラムは存在しない。** ORDER BY に使えるのは `last_message_at`(nullable) と `created_at` のみ。

ow_company_admins 確認済みカラム:

```
column_name         data_type     is_nullable
----------------------------------------------
id                  uuid          NO
user_id             uuid          YES   ← カラム名は user_id (ow_user_id ではない)
company_id          uuid          NO
department          text          YES
role_title          text          YES
permission          text          NO
is_active           boolean       NO
created_at          timestamptz   NO
invited_by_user_id  uuid          YES
invitation_token    text          YES
invited_email       text          YES
invited_at          timestamptz   YES
accepted_at         timestamptz   YES
joined_at           timestamptz   YES
is_default          boolean       NO
```

### 3-2. JOIN パターン素案(実行せず、設計用)

```sql
-- /biz/conversations 一覧: ログイン中の HR 担当者が属する会社の全対話を取得
SELECT c.id, c.kind, c.stage, c.status, c.company_id,
       c.candidate_user_id, c.last_message_at, c.created_at
FROM ow_conversations c
WHERE c.company_id IN (
  SELECT ca.company_id
  FROM ow_company_admins ca
  JOIN ow_users u ON u.id = ca.user_id
  WHERE u.auth_id = auth.uid()
    AND ca.is_active = true
)
ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
```

### 3-3. 評価: SELECT RLS 緩和案の具体的なポリシー文

#### 現行 SELECT RLS の問題点

現行ポリシーは「participant として登録されている人のみ SELECT 可能」。企業 HR 担当者は participant でなければ対話を閲覧できない。確定設計では「同社の ow_company_admins に登録された HR は全対話を閲覧可能」にしたい。

#### 追加が必要な SELECT 条件(緩和案)

```sql
-- migration で既存 ow_conversations_select を DROP → 再 CREATE
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations
FOR SELECT
USING (
  -- 条件 A: 参加者(従来通り)
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
  )
  -- 条件 B: 同社の ow_company_admins 登録済み HR 担当者(緩和案)
  OR (
    ow_conversations.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid()
        AND ca.is_active = true
    )
  )
  -- 条件 C: admin (運営)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

#### getTenantContext() の再利用可否

`src/lib/business/dashboard.ts:100` に存在。biz 側 Server Component 向けのヘルパー関数で、`company_id`(tenantId)と `owUserId` を返す。`/biz/conversations` ページでそのまま再利用可能。

**判定: 設計確定**

- `ow_company_admins.user_id` = カラム名は `user_id`(ow_user_id ではない)
- `ow_conversations.updated_at` は存在しない → `ORDER BY last_message_at DESC NULLS LAST, created_at DESC` を使う
- SELECT RLS 緩和案の SQL は上記で具体化済み
- `getTenantContext()` を biz/conversations ページで再利用可能

---

## 調査 4: 案 A 前提崩れチェック

### §4-19 作業量再見積もり

「田中翔太」の表示箇所は UI に影響するものが **2 箇所のみ**。mock データファイルの定数は変更不要。

- line 303: 1 行修正(確実)
- line 366: `owUser` から取得する props 変更が必要(ただし `ow_users` に `current_role` 的なカラムが存在するかは未確認)

**再見積もり: 変更なし(小のまま)**。ただし line 366 の修正は `ow_users` のカラム確認が先行作業になる可能性がある。

### §4-20 置換の単純さチェック(5 ファイル個別)

| ファイル | getUser の使われ方 | 後続で user.xxx を使う箇所 | 置換の単純さ |
|---|---|---|---|
| `mypage/applications/page.tsx` | line 76-77, `user.id` を `.eq("auth_id", user.id)` に使用 | 1 箇所(auth_id) | ⭐ 単純(1行パターン置換) |
| `mypage/company-membership/new/page.tsx` | line 53-54, `user.id` を 3 回 + `user.user_metadata?.full_name` を使用 | 4 箇所 | ⭐⭐ やや多い(機械的置換、複数行) |
| `mypage/work-history/new/page.tsx` | line 80-81, `user.id` を `user_id:` に使用 | 1 箇所 | ⭐ 単純 |
| `auth/page.tsx` | line 46, `.then(({ data: { user } }) => { if (user) ... })` | 1 箇所(存在チェックのみ) | ⭐ 単純(分割代入のキー名変更) |
| `companies/[id]/page.tsx` | line 2656, Promise.all の中の 1 つ。`authResult.data.user` を `isAuthenticated` と `.eq("auth_id", ...)` に使用 | 2 箇所 | ⭐⭐ やや複雑(Promise.all 内、変数名が authResult) |

全 5 ファイルの共通パターン:
```typescript
// Before
const { data: { user } } = await supabase.auth.getUser();
if (!user) { ... }
// user.id を使う

// After
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
if (!user) { ... }
// user.id はそのまま使える(user 変数名を維持できる)
```

`const user = session?.user` で **変数名 `user` を維持できる** ため、後続の `user.id` 参照は全て無変更で動く。`getUser()` → `getSession()` + `const user = session?.user` の 2 行置換パターンで全ファイル対応可能。

**§4-20 再見積もり: 変更なし(小のまま)**。単純機械的置換で全 5 ファイル完結。

---

## ⚠️ 重大発見

### `ow_conversations` テーブルが空

```sql
SELECT id, kind, company_id, candidate_user_id, created_at
FROM ow_conversations LIMIT 5;
-- 結果: 0 行
```

動作確認用テストデータは Step 4-4 でクリーンアップ済みのため期待通り。ただし **Phase ν-4 の企業側 UI の動作確認には、改めてテストデータの投入が必要**。

参考: `create_conversation` RPC が SECURITY DEFINER で存在確認済みのため、求職者側の申込フローから対話を生成することは可能。

### ow_conversations に `updated_at` カラムが存在しない

`ORDER BY c.updated_at DESC` は使用不可。`last_message_at DESC NULLS LAST, created_at DESC` で代替する。分析ドキュメント §3-2 の SQL 素案は誤りだったため上記で修正済み。

---

## 総合判定

**Phase ν-4 を案 A のまま進めて良いか: GO**

| 不確実性 | 判定 | 理由 |
|---|---|---|
| §4-8 migration の干渉リスク | **GO** | create_conversation は prosecdef=true 確認済み。RLS 修正で壊れない |
| 「田中翔太」の表示箇所 | **GO** | 2 箇所のみ、1 箇所は 1 行置換で完了 |
| 企業側対話 UI の認証経路 | **GO** | SELECT RLS 緩和案のSQL を具体化。updated_at の非存在も発見・代替確定 |

案 A の Sub-step 順序は変更なし:
```
4A-1: §4-19 (MypageClient.tsx:303 + :366)
4A-2: §4-20 getUser → getSession 置換(5 ファイル)
4A-3: 応募管理 /mypage/applications 動作確認 + INSERT 確認
4A-4: migration(§4-8 INSERT RLS + SELECT RLS 緩和案をセット 1 本)
4A-5: /biz/conversations 一覧ページ
4A-6: /biz/conversations/[id] 詳細 + 返信フォーム + lazy 登録 API
```

---

## Hisato 確認待ち事項

**Q1: §4-19 line 366 の `MOCK_USER.currentRole` の扱い**

`MypageClient.tsx:366` では現在 `MOCK_USER.currentRole`(= "株式会社LayerX · プロダクトマネージャー")が表示されている。

選択肢:
- A. `ow_users` に `current_role` 的なカラムがあれば取得する
- B. Phase 5 Stage 3 まで mock のままにしておく(名前(line 303)だけ直す)

`ow_users` の全カラムは未確認。§4-19 着手前に MCP で確認可能。

**Q2: §4-8 migration を SELECT RLS 緩和案とセットで 1 本にしますか?**

INSERT RLS 修正(追加参加用)と SELECT RLS 緩和(同社 HR が全対話を閲覧可能)は機能的にセットです。migration 070 として 1 本にまとめる案を推奨しますが、分けたい場合は 2 本になります。

---

*調査終了 — 実装ゼロ、SELECT + grep/read のみ*
