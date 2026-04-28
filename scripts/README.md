# Development Scripts

Opinio Work の開発・テストに使うユーティリティスクリプト。

---

## get_session_cookie.mjs

Supabase の Magic Link を使って認証済みセッションを取得し、`curl` 用の `Cookie:` ヘッダーを出力します。パスワード不要で service_role key だけで動作します。

### 必要な環境変数

`.env.local` に以下が設定されていること（自動読み込みされます）:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 使い方

```bash
# 柴さん本人の Cookie を取得
node scripts/get_session_cookie.mjs hshiba@opinio.co.jp

# テストユーザーの Cookie を取得
node scripts/get_session_cookie.mjs tanaka.shota@example.com
```

### 出力例

```
Cookie: sb-xtutnecqeamftygufxco-auth-token={"access_token":"...","refresh_token":"...",...}
```

（セッションサイズが大きい場合は `.0` `.1` に自動チャンク分割されます）

### curl での使用例

```bash
# Cookie を変数に格納
COOKIE=$(node scripts/get_session_cookie.mjs hshiba@opinio.co.jp | grep "^Cookie:")

# 認証済みエンドポイントをテスト
curl -s -o /dev/null -w "%{http_code}" -H "$COOKIE" http://localhost:3001/biz/dashboard

# API エンドポイントをテスト (jobseeker 側)
curl -s -X POST http://localhost:3000/api/casual-meetings \
  -H "$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"company_id":"...","contact_email":"test@example.com"}'
```

### 注意事項

- **開発環境専用**: service_role key を使用するため、本番環境では使わないこと
- **メール送信なし**: Magic Link のトークンをサーバー側で直接取得するため、実際にメールは届きません
- **Cookie の有効期限**: 生成した Cookie は短時間（約1時間）で expire するため、テストごとに再取得を推奨
- **チャンク形式**: `@supabase/ssr` の `createChunks` を使うため、Next.js アプリの Cookie 形式と完全一致します

---

## その他のスクリプト

| ファイル | 説明 |
|---------|------|
| `run-sql.mjs` | Supabase に SQL を直接実行 |
| `run-migration.mjs` | マイグレーションファイルを適用 |
| `seed-sample-users.mjs` | テストユーザーを ow_users に seeding |
| `seed-fit-data-full.mjs` | フィット度データを全社に seeding |
| `seed-job-details.mjs` | 求人詳細データを seeding |
