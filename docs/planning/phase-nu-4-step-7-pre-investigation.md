# Sub-step 4A-7 事前不確実性調査

**調査日**: 2026-05-07  
**調査者**: Claude (Sub-step 4A-7 実装前)  
**用途**: migration 070 適用後に 4A-7 を即着手できるよう不確実性を潰す

---

## 目次

1. [メッセージテーブルの実態](#1-メッセージテーブルの実態)
2. [候補者側返信フォームの実装パターン](#2-候補者側返信フォームの実装パターン)
3. [ow_conversation_participants.role の命名規則](#3-ow_conversation_participantsrole-の命名規則)
4. [候補者プロフィールサマリー表示用データ](#4-候補者プロフィールサマリー表示用データ)
5. [⚠️ 重大発見サマリー](#5-️-重大発見サマリー)
6. [Hisato 確認待ち事項](#6-hisato-確認待ち事項)
7. [マスタープラン更新の必要性](#7-マスタープラン更新の必要性)

---

## 1. メッセージテーブルの実態

### 1-A. DB に存在するメッセージ系テーブル一覧

| テーブル名 | 用途 | Phase ν との関係 |
|-----------|------|----------------|
| `ow_conversation_messages` | Phase ν 対話のメッセージ | **✅ アクティブ** |
| `ow_message_reads` | 既読管理（last_read_at 補完用） | 補助テーブル（現在未使用） |
| `ow_messages` | 旧スキーマ（ow_threads ベース） | ❌ Phase ν とは無関係 |
| `candidate_messages` | 旧系統（tenant_id ベース） | ❌ Phase ν とは無関係 |
| `iv_messages` | 面接系旧テーブル | ❌ Phase ν とは無関係 |
| `scout_messages` | スカウト旧テーブル | ❌ Phase ν とは無関係 |

**結論: Phase ν では `ow_conversation_messages` のみを使う。**

### 1-B. `ow_conversation_messages` カラム定義

| カラム | 型 | NOT NULL | デフォルト | 備考 |
|--------|-----|---------|-----------|------|
| `id` | uuid | ✅ | gen_random_uuid() | PK |
| `conversation_id` | uuid | ✅ | — | FK → ow_conversations.id |
| `sender_participant_id` | uuid | ❌ | — | FK → ow_conversation_participants.id |
| `body` | text | ✅ | — | メッセージ本文 |
| `sent_at` | timestamptz | ✅ | now() | 送信時刻 |
| `edited_at` | timestamptz | ❌ | — | 編集時刻 |
| `deleted_at` | timestamptz | ❌ | — | 論理削除 |

### 1-C. `ow_conversation_messages` RLS ポリシー

| cmd | ポリシー名 | 状態 | 詳細 |
|-----|-----------|------|------|
| INSERT | `ow_conversation_messages_insert` | ✅ 正常（migration 068 修正済み） | `sender_participant_id` が自分の participant であることを ow_users JOIN で検証 |
| SELECT | `ow_conversation_messages_select` | ✅ 正常 | participant として登録済みの conversation のメッセージを閲覧可 OR admin |
| UPDATE | `ow_conversation_messages_update` | ⚠️ **UUID 不一致バグ残存** | `participant.user_id = auth.uid()` — auth UUID と ow UUID を直接比較 → 常に false |

**INSERT WITH CHECK（正常）:**
```sql
EXISTS (
  SELECT 1 FROM ow_conversation_participants
  WHERE ow_conversation_participants.id = ow_conversation_messages.sender_participant_id
    AND ow_conversation_participants.user_id IN (
      SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
    )
    AND ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id
    AND ow_conversation_participants.left_at IS NULL
)
```

**UPDATE USING（⚠️ UUID 不一致）:**
```sql
EXISTS (
  SELECT 1 FROM ow_conversation_participants
  WHERE ow_conversation_participants.id = ow_conversation_messages.sender_participant_id
    AND ow_conversation_participants.user_id = auth.uid()  -- ❌ UUID 空間不一致
    AND ow_conversation_participants.left_at IS NULL
)
OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
```

**4A-7 への影響**: メッセージ「編集」機能を実装しなければ UPDATE ポリシーの bug は blocking にならない。削除（deleted_at 更新）も UPDATE なので同様に blocking。→ 初期実装では編集・削除なしで回避可。

### 1-D. `ow_message_reads` RLS バグ

`ow_message_reads` の INSERT ポリシーも UUID 不一致バグあり（`user_id = auth.uid()` 直接比較）。
ただし現在の実装は `ow_message_reads` を使用せず、`ow_conversation_participants.last_read_at` で既読管理している。4A-7 でも同様のパターンを踏襲すれば blocking にならない。

### 1-E. メッセージ挿入経路

| 経路 | 有無 | 詳細 |
|------|------|------|
| `create_message` RPC | ❌ 存在しない | pg_proc に一切ヒットなし |
| API Route | ❌ 存在しない | `/api/conversations/messages` 等は未実装 |
| **直接 INSERT (Client → Supabase)** | ✅ 使用中 | `/mypage/conversations/[id]/page.tsx` の `handleSend` |

```typescript
// 現在の送信パターン（候補者側）
supabase.from("ow_conversation_messages").insert({
  conversation_id: conversationId,
  sender_participant_id: myParticipantId,  // ow_conversation_participants.id
  body: inputText.trim(),
});
```

**4A-7 での方針**: 同じパターンで直接 INSERT。API Route は不要（RLS で制御できる）。

---

## 2. 候補者側返信フォームの実装パターン

### 2-A. ファイル構成

```
src/app/(jobseeker)/mypage/conversations/
  page.tsx          ← "use client", 240行, 対話一覧
  [id]/page.tsx     ← "use client", 365行, 対話詳細 + 返信フォーム
```

### 2-B. `/mypage/conversations/[id]/page.tsx` の構造

| セクション | 内容 |
|-----------|------|
| 型定義 | `MessageRow`, `ConversationDetail` |
| `SIDEBAR_ITEMS` | ハードコードのサイドバーリンク（系統 B 独自） |
| `loadData()` | 全データ取得ロジック（useCallback） |
| `handleSend()` | メッセージ送信（直接 INSERT → loadData() refresh） |
| JSX | サイドバー + チャット UI（ヘッダー + メッセージ一覧 + 入力エリア） |

**認証経路:**
```typescript
const { data: { session } } = await supabase.auth.getSession();  // ✅ Client Component で正しい
const user = session?.user;

const { data: owUser } = await supabase.from("ow_users")
  .select("id").eq("auth_id", user.id).maybeSingle();  // auth UUID → ow_users.id 変換
```

**データ取得 SELECT 構造:**
```
1. ow_conversations (詳細) — RLS で participant のみアクセス可
2. ow_conversation_participants (自分の participant_id 取得)
3. ow_conversation_messages (with JOIN: participants → ow_users)
4. ow_conversation_participants UPDATE (last_read_at = now())
```

**Realtime 未使用**: `loadData()` を送信後に再呼び出しするポーリング方式。初期実装でこれを踏襲すれば良い。

**myParticipantId の役割**: `sender_participant_id !== myParticipantId` で自分/相手メッセージを判定。入力フォームは `myParticipantId` が null の場合（参加者未登録）に非表示。

### 2-C. 4A-7 でどこを変えるか

| 要素 | 候補者側 | 企業側（4A-7） |
|------|---------|--------------|
| auth | getSession() → ow_users lookup | 同じ + company_admin チェック |
| 自分の participant 取得 | `.eq("user_id", owUser.id)` | 同じ |
| メッセージ INSERT | 直接 insert | 同じ |
| 表示: 相手名 | 企業名 / メンター名 | 候補者名（ow_users.name） |
| 表示: プロフィール | 企業ロゴ | 候補者アバター |
| Realtime | ポーリング | 同じ（初期実装） |
| 既読更新 | last_read_at UPDATE | 同じ |

---

## 3. ow_conversation_participants.role の命名規則

### 3-A. 現在の実データ

```sql
SELECT DISTINCT role, COUNT(*) FROM ow_conversation_participants GROUP BY role;
-- 結果: role='candidate', cnt=1
```

**現在は `candidate` のみが使われている。`company_member` は存在しない。**

### 3-B. create_conversation RPC が使う role 値

RPC の引数: `p_kind text, p_candidate_user_id uuid, p_company_id uuid, p_mentor_user_id uuid`

RPC 内部（SECURITY DEFINER）で participants に行を作成する際、candidate には `role = 'candidate'` が設定されている（実データから確認済み）。

### 3-C. HR 参加者の role 命名推奨

| 候補 | メリット | デメリット |
|------|---------|-----------|
| `'company_member'` | マスタープランに記載 | データ上の先例なし。"member"は曖昧 |
| `'hr'` | 短くて明確。企業 HR 担当者を直感的に表す | 役職名に依存 |
| `'company_hr'` | プレフィックスで系統が分かる | やや冗長 |
| `'company_admin'` | ow_company_admins テーブルの呼称と一致 | admin と紛らわしい（admin = 運営の意も） |

**推奨: `'hr'`**  
理由: 短い、直感的、candidate との対称性が明確（`candidate` vs `hr`）。`company_member` は master plan の仮称であり、実データとの対応なし。

### 3-D. 実装への影響

`/mypage/conversations/[id]/page.tsx` の表示ロジック:
```typescript
const senderName = participant?.ow_users?.name ?? "運営";
// role は現時点で表示分岐に使っていない → HR が追加されても表示ロジック変更不要
```

4A-7 の企業詳細ページでは:
```typescript
// 自分（HR）のメッセージ判定
const isMe = msg.sender_participant_id === myParticipantId;
// → role でなく participant_id で判定するため、role 値は参加者識別のメタデータとして使う
```

---

## 4. 候補者プロフィールサマリー表示用データ

### 4-A. ow_users の全カラム

| カラム | 型 | 備考 |
|--------|-----|------|
| `id` | uuid | PK（ow UUID） |
| `auth_id` | uuid | auth.users.id に対応 |
| `email` | text | メールアドレス |
| `name` | text | 表示名 |
| `avatar_color` | text | アバター背景グラデーション |
| `cover_color` | text | カバー背景色 |
| `about_me` | text | 自己紹介文 |
| `age_range` | text | 年代（例: "30代"） |
| `location` | text | 居住地 |
| `social_links` | jsonb | SNS リンク |
| `is_mentor` | boolean | メンターフラグ |
| `mentor_registered_at` | timestamptz | — |
| `mentor_themes` | text[] | メンター相談テーマ |
| `is_active_mentor` | boolean | — |
| `visibility` | text | 'public' デフォルト |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

**⚠️ `current_role` カラムが存在しない。**  
候補者の現在の職種・役職情報を `ow_users` から取得することはできない。

### 4-B. 4A-7 候補者サマリー表示に使えるカラム

| 表示項目 | カラム | 取得可否 |
|---------|--------|---------|
| 氏名 | `name` | ✅ |
| アバター | `avatar_color` | ✅ |
| 自己紹介 | `about_me` | ✅（null の可能性あり） |
| 年代 | `age_range` | ✅（null の可能性あり） |
| 居住地 | `location` | ✅（null の可能性あり） |
| 現職 / 職種 | — | ❌ **存在しない** |
| メール | `email` | ✅（表示するか要検討） |

### 4-C. ow_conversations から候補者情報を JOIN する方法

**確認済み**: `ow_conversations.candidate_user_id` = `ow_users.id`（ow UUID 空間）

```sql
-- 候補者情報の取得パターン（Supabase JS）
supabase.from("ow_conversations")
  .select(`
    id, kind, stage, status,
    candidate:ow_users!candidate_user_id(
      id, name, avatar_color, about_me, age_range, location
    ),
    ow_companies(name, logo_url, logo_letter)
  `)
  .eq("id", conversationId)
  .maybeSingle()
```

### 4-D. 応募情報（ow_job_applications）との連携

**現状の制約**:  
`ow_job_applications.conversation_id` カラムは存在するが、現在の `/api/applications/route.ts` は INSERT 時に `conversation_id` をセットしていない（Sub-step 4A-3 で確認済み）。

→ `conversation_id` で直接 JOIN は不可。代替手段:

```sql
-- 代替: candidate_user_id + company_id を使って応募情報を取得
SELECT ja.*
FROM ow_job_applications ja
JOIN ow_jobs j ON j.id = ja.job_id
WHERE ja.user_id = <candidate_user_id>
  AND j.company_id = <company_id>
ORDER BY ja.created_at DESC
LIMIT 1;
```

---

## 5. ⚠️ 重大発見サマリー

### 重大発見 1: `ow_conversation_messages` UPDATE 自体に UUID 不一致バグ残存

- ポリシー: `participant.user_id = auth.uid()` （直接比較 → 常に false）
- **影響範囲**: メッセージ編集・論理削除（`deleted_at` 更新）が一般ユーザーには不可
- **4A-7 への影響**: 初期実装でメッセージ編集・削除機能を持たなければ blocking にならない
- **推奨**: 4A-7 実装では送信・閲覧のみ。編集削除は Phase ν-5 候補として migration 071 で対処

### 重大発見 2: `ow_users` に `current_role` カラムが存在しない

- マスタープランの 4A-7「候補者プロフィールサマリー」に現職/役職情報を表示する設計があるが、そのカラムが DB に存在しない
- `about_me`, `age_range`, `location` は存在する（ただし null の可能性あり）
- **4A-7 への影響**: 役職なしで name + about_me + age_range のみを表示する設計に変更が必要
- **将来対応**: ow_users への `current_role` 追加は Phase ν-5 の migration 候補

### 重大発見 3: `ow_conversation_messages` への挿入 RPC が存在しない

- `create_message` 等の RPC は一切存在しない
- 候補者側もクライアントから直接 INSERT している（RLS で制御）
- migration 068 の INSERT ポリシーは正しく修正済みで、直接 INSERT は機能する
- **4A-7 への影響**: HR 側も同じパターン（直接 INSERT）で実装する。これは現状の設計通りなので問題なし

---

## 6. Hisato 確認待ち事項

### Q1: ow_conversation_participants.role = `'hr'` でよいか

現在の実データは `'candidate'` のみ。マスタープランには `'company_member'` と記載があるが、`'hr'` の方が直感的で実態に即している。4A-7 で HR が対話に参加する際のロール名として `'hr'` を採用してよいか。

→ 採用する場合: 4A-7 の join API Route で `role: 'hr'` を INSERT

### Q2: `current_role` カラムなしでの候補者サマリー設計合意

`ow_users` に役職カラムが存在しないため、4A-7 の企業詳細ページでの候補者サマリーは
以下のみ表示:
- 氏名（name）
- アバター（avatar_color + 頭文字）
- 自己紹介（about_me、null なら非表示）
- 年代（age_range、null なら非表示）
- 居住地（location、null なら非表示）

この設計で問題ないか。役職情報は Phase ν-5 で `ow_users` に `current_role` 追加後に対応。

### Q3: メッセージ送信を API Route 経由にするか、直接 INSERT にするか

現在の候補者側は直接 INSERT（RLS 制御）。HR 側（4A-7）も同じパターンにするか、
または `/api/biz/conversations/[id]/messages` API Route を経由するか。

セキュリティ観点では service role を使った API Route の方が RLS バグに影響されにくいが、
実装コストが増える。推奨は **直接 INSERT**（候補者側と対称）だが、Hisato の方針を確認したい。

---

## 7. マスタープラン更新の必要性

| 更新箇所 | 現状の記載 | 正しい内容 |
|---------|-----------|-----------|
| 4A-7「participant の role 値」 | `company_member`（仮称） | `'hr'` 推奨に変更 |
| 4A-7「候補者プロフィールサマリー」 | 現職/役職を表示する設計 | `current_role` 不在のため name/about_me/age_range/location のみ |
| 4A-7「メッセージ送信経路」 | 不明確 | RPC なし。直接 INSERT（RLS で制御）が現状の正しい設計 |
| Phase ν-5 候補 | （未記載） | ① `ow_conversation_messages` UPDATE/DELETE の UUID 不一致修正（migration 071）② `ow_users.current_role` 追加 |

---

*（調査完了: 2026-05-07）*
