# Phase ν-4: 認証ミスマッチ診断レポート

作成日: 2026-05-08  
発生症状: 担当者_001 でログイン後 `/biz/conversations` ではなく `/mypage` に飛ばされる / `/profile/edit` に Hisato の経歴が表示される

---

## 結論サマリー

| 項目 | 結論 |
|------|------|
| **DB データの正合性** | ✅ 正しい。テスト担当者_001 の設定は問題なし |
| **/mypage リダイレクトの原因** | ⚠️ ブラウザに Hisato の既存セッションが残留していた可能性が高い |
| **「Hisato の経歴」が表示される件** | ℹ️ `/profile/edit` は引き続き MOCK データ（田中翔太ペルソナ）を使用 |
| **対処法** | ブラウザのシークレットモードまたはセッションクリア後に再テスト |

---

## 調査 1: DB データ確認結果

### 1a. `auth_id = 837dd8c8-...` に紐づく ow_users

| ow_users.id | name | email | auth_id | about_me |
|-------------|------|-------|---------|---------|
| `1c21269b-d06a-4ecf-97bd-663c0027e86a` | テスト担当者_001 | contact+biz001@opinio.co.jp | `837dd8c8-d863-465e-9672-d4cd2f1f896a` | null |
| `e826e0bd-f96b-42ec-acda-d8f482e1417d` | 柴 久人 | s.hisato1020@gmail.com | `7f358b59-2269-41fa-9324-4298c3c82cd2` | null |

**結論: auth_id の重複なし。テスト担当者_001 と 柴 久人 は完全に別の ow_users 行。**

### 1b. 柴 久人 (Hisato) の auth_id

`7f358b59-2269-41fa-9324-4298c3c82cd2`（テスト担当者_001 の auth_id とは別物）

### 1c. テスト担当者_001 の正しい ow_users.id

`1c21269b-d06a-4ecf-97bd-663c0027e86a`  
auth_id: `837dd8c8-d863-465e-9672-d4cd2f1f896a` ✅ (Admin API で設定した対象と一致)

### 1d. 4A-5 Participants の正合性

| conversation_id | role | user_id (ow_users) | name | auth_id |
|----------------|------|-------------------|------|---------|
| 0e668917-... | candidate | e826e0bd-... | 柴 久人 | 7f358b59-... |
| 0e668917-... | company_admin | **1c21269b-...** | **テスト担当者_001** | **837dd8c8-...** |
| 7afca1de-... | candidate | e826e0bd-... | 柴 久人 | 7f358b59-... |
| 7afca1de-... | company_admin | f8526fdb-... | テスト担当者_002 | 76612ac9-... |

**結論: 4A-5 のシードデータは正しい。担当者_001 は conv 0e668917 の company_admin として正しく登録されている。**

### 追加確認: ow_company_admins

| user_id | company_id | permission | is_active | is_default | joined_at |
|---------|-----------|-----------|-----------|-----------|----------|
| 1c21269b-... (担当者_001) | fde82347-... (テスト株式会社_001) | admin | true | **false** | **null** |

**⚠️ 注意点**: `is_default = false`, `joined_at = null`  
ただし `getCompanyContext()` のロジック上、is_default が false でも joined_at が null でも、唯一の membership であれば `allMemberships[0]` でフォールバック選択される。**機能上の問題なし。**

### 追加確認: ow_user_roles（テスト担当者_001）

```
0 件
```

**⚠️ 空**。しかし `getTenantContext()` は `getCompanyContext()` 経由で `ow_company_admins` を使って tenant を解決するため、`ow_user_roles` の有無は関係なし。**機能上の問題なし。**

### 追加確認: 柴 久人 (Hisato) の ow_company_admins

```
0 件
```

**Hisato は `ow_company_admins` に登録されていない。**  
→ Hisato のセッションで `/biz/conversations` にアクセスすると `getTenantContext()` が null を返し、`NoTenantPage`（「企業アカウントが必要です」）が表示される。`/mypage` へのリダイレクトは発生しない。

---

## 調査 2: ログイン後リダイレクト先

### 2a. `/biz/auth` のリダイレクト先

```typescript
// /biz/auth/page.tsx line 43-44
const rawNext = searchParams.get("next") ?? "";
const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/biz/dashboard";
```

- `next` パラメータがある場合: そのパスへ遷移
- `next` パラメータがない場合: **`/biz/dashboard`** へ遷移（`/mypage` ではない）

```typescript
// line 52-54: 既存セッション検出時の即時リダイレクト
useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) router.replace(next); // ← 既存セッションがあれば next へ飛ぶ
  });
}, [next, router]);
```

### 2b. jobseeker 側 `/auth` のリダイレクト先

```typescript
// /auth/page.tsx line 36-37
const nextUrl = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
// ...
router.push(nextUrl || "/companies"); // ← デフォルトは /companies
```

jobseeker auth のデフォルトも `/mypage` ではない（`/companies`）。

### 2c. `/auth/callback` のリダイレクト先

```typescript
const next = searchParams.get("next") ?? "/companies"; // ← OAuth コールバック、デフォルト /companies
```

**結論: どのコードパスを辿っても「ログイン後に自動で `/mypage` に飛ぶ」経路は存在しない。**

---

## 調査 3: 「/mypage に飛ばされた」原因の仮説

### 仮説 A: ブラウザに Hisato の既存セッションが残留していた（最有力）

1. ブラウザには Hisato（s.hisato1020@gmail.com）の Supabase セッション Cookie が存在
2. 担当者_001 でログインしようと `/biz/auth` を開く
3. `useEffect` で既存セッション（Hisato）を検出 → `router.replace("/biz/dashboard")` が即座に発火
4. 担当者_001 としての **新規ログインが完了せずに** Hisato のセッションで /biz/dashboard に遷移
5. その後 Hisato がサイト内を操作し、**手動で** `/mypage` に移動（または前のタブが `/mypage` のまま）
6. 「/mypage に飛ばされた」と認識

**なぜ「担当者_001 でログインした」と感じたか**: `/biz/auth` のフォームに入力したが、送信前に既存セッション検出リダイレクトが発生した可能性。

### 仮説 B: セッション確認不足でのページ遷移

Supabase セッションが切り替わらないまま `/mypage` を手動で開いた → Hisato のセッションで `/mypage` を表示。

---

## 調査 4: 「Hisato の経歴が表示される」件

### 調査 4a. `/profile/edit` の経歴データソース

```bash
# ow_work_histories テーブル: 存在しない（確認済み）
ERROR: relation "ow_work_histories" does not exist
```

`/profile/edit` ページは **MOCK データ（`src/app/profile/edit/mockProfileData.ts` の `田中翔太` ペルソナ）** を使用中。  
Phase 5 Stage 3 で Supabase 接続予定だが未着手。

### 調査 4b. なぜ「Hisato の経歴」に見えるか

`田中翔太` ペルソナはもともと **Hisato 本人の実際の経歴をベースに作成されたモックデータ**（LayerX, タイミー, リクルート 等）。

**結論: `/profile/edit` は Hisato の実データを読んでいるのではなく、Hisato が自分のキャリアをモデルにして作成したモックデータを表示している。「Hisato の経歴」= MOCK 田中翔太 の経歴、という表現上の混同が発生している。**

---

## 根本的な DB 問題がないことの確認

`getTenantContext()` が担当者_001 で実行されるフロー:

```
1. supabase.auth.getUser() → auth_id = 837dd8c8-...
2. getCompanyContext(supabase, "837dd8c8-..."):
   a. ow_users WHERE auth_id = '837dd8c8-...' → id = '1c21269b-...'  ✅
   b. ow_company_admins WHERE user_id = '1c21269b-...' AND is_active = true
      → 1件: テスト株式会社_001 (fde82347-...)  ✅
   c. resolved = allMemberships[0] = テスト株式会社_001  ✅
3. ow_companies WHERE id = 'fde82347-...'  ✅
4. TenantContext を正常返却
```

**テスト担当者_001 の正しいセッションで `/biz/conversations` にアクセスすれば、対話一覧が正常表示されるはず。**

---

## 推奨アクション

### 即時対応（動作確認再実施）

1. **ブラウザをシークレット/プライベートモードで開く**（Hisato の既存セッション Cookie を排除）
2. `http://localhost:3000/biz/auth` に直接アクセス
3. メール `contact+biz001@opinio.co.jp` / パスワード `OpinioTest_biz001_2026!` でログイン
4. ログイン成功後 `/biz/dashboard` に遷移するはず → そこから `/biz/conversations` に移動
5. 柴 久人との対話1件が表示されることを確認

### 確認ポイント

- `/biz/conversations` ページが「対話管理」として正常表示されるか
- 担当者_001 のログアウト後に Hisato でログインし直し、通常のジョブシーカー機能が壊れていないか

---

## 将来注意事項

- テストユーザーでのブラウザ動作確認は**必ずシークレットモード**で実施する
- `/biz/auth` の既存セッション検出リダイレクト（`if (user) router.replace(next)`）は本番設計として正しい挙動。変更不要
- `ow_company_admins.joined_at = null` は `getCompanyContext()` の fallback ロジックで正常処理される

---

*（調査完了: 2026-05-08）*
