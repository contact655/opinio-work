# Phase ν-4 Sub-step 4A-3: 応募管理動作確認

調査日: 2026-05-07
担当: Claude (Sub-step 4A-3)

---

## 1. Code Read サマリー

### ファイル構成

```
src/app/(jobseeker)/jobs/[id]/apply/
  page.tsx          ← Server Component（認証ガード + データ取得）
  ApplicationForm.tsx ← Client Component（フォーム UI + fetch 呼び出し）

src/app/api/applications/route.ts  ← API Route (POST)
src/lib/supabase/resolveOwUserId.ts ← auth_id → ow_users.id 変換ヘルパー
```

### 認証経路

| レイヤー | 関数 | 種別 | 判定 |
|---------|------|------|------|
| `apply/page.tsx` (line 9) | `supabase.auth.getUser()` | Server Component | ✅ 正しい（認証クリティカル、リダイレクト判定） |
| `api/applications/route.ts` (line 16) | `supabase.auth.getUser()` | API Route | ✅ 正しい（認証クリティカル） |
| `ApplicationForm.tsx` | なし（fetch のみ） | Client Component | ✅ 正しい（認証不要、API Route に委譲） |

`getUser()` を Server Component と API Route のみで使用 → Navigator Lock 問題なし ✅

### INSERT パターン

```typescript
// api/applications/route.ts
const owUserId = await resolveOwUserId(supabase, user.id);
// resolveOwUserId: SELECT ow_users.id WHERE auth_id = user.id (auth UUID)

await supabase.from("ow_job_applications").insert({
  job_id,
  user_id: owUserId,   // ← ow_users.id（アプリ内 UUID）を使用
  name,                // ← user.user_metadata.name ?? user.email
  email,               // ← user.email
  phone,
  message,
  status: "pending",
});
```

### RLS 整合性チェック

**INSERT WITH CHECK（`users can insert own applications` ポリシー）:**
```sql
user_id IN (
  SELECT ow_users.id FROM ow_users
  WHERE ow_users.auth_id = auth.uid()
)
```

**コードが INSERT する `user_id`**: `resolveOwUserId` が返す `ow_users.id`（= `auth.uid()` から導出）

→ **完全一致。RLS と INSERT パターンは整合している** ✅

**SELECT USING（`users can read own applications` ポリシー）:**
```sql
user_id IN (
  SELECT ow_users.id FROM ow_users
  WHERE ow_users.auth_id = auth.uid()
)
```

**`/mypage/applications` の SELECT**: `owUser.id`（= `auth_id = user.id` で取得した `ow_users.id`）で `.eq("user_id", owUser.id)` を使用

→ **完全一致。RLS と SELECT パターンは整合している** ✅

### 応募後フロー

1. `ApplicationForm` が `POST /api/applications` を呼ぶ
2. API Route が `ow_job_applications` に INSERT
3. best-effort で `createConversation` 実行（`ow_conversations` にも行作成）
4. best-effort でメール通知（admin + user）
5. 成功時: `{ id, status: "pending" }` で `201` を返す
6. `ApplicationForm` の `submitted = true` → 成功モーダル表示
7. 「応募状況を確認する」ボタンで `/mypage/applications` に遷移

### 重複応募チェック

- 事前クエリで既存応募を確認 → 409 返却 + UI でエラーメッセージ表示
- UNIQUE 制約による race condition 対策も実装済み（`error.code === "23505"`）

---

## 2. ow_job_applications の現状

- **現在の行数**: 0 件（2026-05-07 時点）
- **テーブルスキーマ**: id, job_id, user_id, name, email, phone, message, resume_url, status, created_at, updated_at, conversation_id
- **status 値**: pending / doc_review / interview1 / interview_final / offered / accepted（`/mypage/applications` のフィルター定義より）

---

## 3. SELECT 側の動作確認（完了済み）

| ステップ | 結果 | 確認者 |
|---------|------|--------|
| `/mypage/applications` を開く（0件状態） | ✅「応募はまだありません」表示、コンソールエラーなし | Hisato（手元確認済み） |

---

## 4. INSERT 側の動作確認（Hisato による操作が必要）

### テスト用求人

以下のいずれかの URL にアクセスして申込テスト:

| URL | 職種 | 企業 |
|-----|------|------|
| `/jobs/07aa743f-fe8e-4eda-93f7-009743fa1e09/apply` | カスタマーサクセスマネージャー | テスト株式会社_003 |
| `/jobs/10fc2e95-430b-403a-85a8-e8f47664119c/apply` | プロダクトマネージャー | テスト株式会社_004 |
| `/jobs/dda042db-7f07-44dd-8d93-5e57e318bc61/apply` | フロントエンドエンジニア | テスト株式会社_005 |

### 確認手順

1. ログイン状態で上記 URL のいずれかにアクセス
2. フォームを確認（名前・メールが自動入力されているか）
3. 「この求人に応募する」ボタンを押す
4. 成功モーダルが表示されるか確認
5. 「応募状況を確認する」ボタンで `/mypage/applications` に遷移
6. 応募が一覧に表示されるか確認

### Supabase MCP で確認するクエリ（Claude Code 側で実行）

```sql
SELECT id, job_id, user_id, name, status, created_at
FROM ow_job_applications
ORDER BY created_at DESC
LIMIT 5;
```

### 確認チェックリスト

| 確認項目 | 期待値 | 実際の結果 | 判定 |
|---------|--------|-----------|------|
| フォームに名前が自動入力される | `ow_users.name` or `auth.user_metadata.name` | - | 未確認 |
| フォームにメールが自動入力される | ログインメールアドレス | - | 未確認 |
| 送信ボタン押下後に成功モーダル表示 | 成功モーダル | - | 未確認 |
| `ow_job_applications` に 1 行追加 | 1 行（status = pending） | - | 未確認 |
| `/mypage/applications` に応募が表示 | 追加した応募が表示される | - | 未確認 |
| 同じ求人への再応募を試みる | 「すでに応募しています」エラー | - | 未確認 |
| `ow_conversations` にも行追加（best-effort） | 1 行（kind = company） | - | 未確認 |

---

## 5. 静的解析による懸念点・改善余地

### 5a. `authName` の取得元（低優先度）

```typescript
// apply/page.tsx:20
const authName = (user.user_metadata?.name as string | undefined) ?? user.email ?? "";
```

- `user_metadata.name` はサインアップ時に設定した値。後から `ow_users.name` を変更しても同期されない
- `ow_users.name` から取得するのがより正確だが、Server Component で追加クエリが必要
- **Phase ν-5 改善候補**: `ow_users.name` を参照するよう統一する

### 5b. `conversation_id` カラムが応募テーブルにある

- `ow_job_applications.conversation_id` が存在するが、`api/applications/route.ts` は INSERT 時に `conversation_id` をセットしていない
- `createConversation` で別途 `ow_conversations` に行が作られるが、`ow_job_applications` との JOIN リンクはない
- **Phase ν-5 改善候補**: 応募と対話を紐付けたい場合は `conversation_id` をセットする処理が必要

### 5c. 企業側の `ow_company_admins` RLS の UNIQUE 制約とは別問題

- INSERT ポリシーは `ow_users` 経由で `auth.uid()` 照合 → 問題なし
- ただし `ow_job_applications` の RLS は `api/applications/route.ts`（API Route = service role ではなく user context）経由なので **RLS が実際に適用される**
- `resolveOwUserId` で取得した `owUserId` が正しく `ow_users.id` であれば RLS を通過できる ✅

---

## 6. 結論

**静的解析**: コードフローと RLS は完全一致 → バグなし ✅

**INSERT 動作確認**: Hisato による手元操作が必要（Claude Code はログインブラウザ操作不可）

上記「4. INSERT 側の動作確認」の手順に従って操作後、結果をこのファイルの「確認チェックリスト」に記入してください。
