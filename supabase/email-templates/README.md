# Supabase Auth メールテンプレート

OPINIO ブランドに統一した Supabase Auth のメールテンプレート集です。

## 適用手順

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクト `xtutnecqeamftygufxco` を選択
3. 左メニューから **Authentication → Email Templates** を開く
4. 各テンプレートを以下の通り設定する

---

## テンプレート一覧

### 1. Confirm signup（メール確認）
- **ファイル**: `confirm-signup.html`
- **Supabase の設定先**: "Confirm signup" タブ
- **使用変数**: `{{ .ConfirmationURL }}`

### 2. Magic Link（マジックリンクログイン）
- **ファイル**: `magic-link.html`
- **Supabase の設定先**: "Magic Link" タブ
- **使用変数**: `{{ .SiteURL }}`, `{{ .TokenHash }}`
- **注意**: Supabase の Magic Link テンプレートはデフォルトで `{{ .ConfirmationURL }}` を使うが、このテンプレートでは Token Hash 方式を採用

### 3. Reset password（パスワードリセット）
- **ファイル**: `reset-password.html`
- **Supabase の設定先**: "Reset Password" タブ
- **使用変数**: `{{ .ConfirmationURL }}`

---

## 設定方法（各テンプレート共通）

1. ファイルの内容をコピー
2. Supabase Dashboard の該当タブで "Body" フィールドに貼り付け
3. Subject（件名）も合わせて設定：

| テンプレート | 推奨件名 |
|------------|---------|
| Confirm signup | 【opinio.jp】メールアドレスを確認してください |
| Magic Link | 【opinio.jp】ログインリンクをお送りしました |
| Reset password | 【opinio.jp】パスワードをリセットしてください |

4. "Save" をクリックして保存

---

## デザイン仕様

- **ヘッダー**: グラデーション `linear-gradient(135deg, #002366, #3B5FD9)` + OPINIO ロゴ
- **CTA ボタン**: `background: #002366`（royal blue）
- **フォント**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif`
- **フォールバック URL**: モノスペースフォント、青文字で表示
- **フッター**: `#f8fafc` 背景、注意書き + opinio.jp リンク

---

## テスト方法

Supabase Dashboard → Authentication → Users から "Send magic link" や "Send password reset" でテスト送信できます。
