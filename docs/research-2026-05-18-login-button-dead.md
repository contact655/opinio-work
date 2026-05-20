# 調査レポート: 「ログイン」ボタン無反応

作成日: 2026-05-18  
調査種別: コード変更なし・調査のみ  
症状: opinio.jp トップ右上の「ログイン」ボタンを押しても URL も画面も変わらず無反応

---

## 1. ログインボタンの実装

**ファイル**: `src/components/jobseeker/JobseekerHeader.tsx` L247–258

```tsx
{!loading && (
  user ? (
    /* アバター + ドロップダウン */
  ) : (
    <>
      <Link href="/auth">ログイン</Link>
      <Link href="/auth?mode=signup">無料登録</Link>
    </>
  )
)}
```

- Next.js の `<Link>` コンポーネント（`onClick` なし、`preventDefault` なし）
- `loading` フラグ: `useState(true)` で初期化 → `getSession()` の `finally` で `false` に遷移
- `loading=true` の間はボタン非表示（ちらつき防止）
- `user` は `supabase.auth.getSession()` の結果

---

## 2. /auth ルートの実態

| パス | ファイル | 備考 |
|------|---------|------|
| `/auth` | `src/app/(jobseeker)/auth/page.tsx` | ✅ 存在（route group → URL は `/auth`） |
| `/auth/login` | `src/app/auth/login/page.tsx` | `/auth?mode=login` へリダイレクト |
| `/auth/signin` | `src/app/auth/signin/page.tsx` | `/auth?mode=login` へリダイレクト |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | `/auth?mode=signup` へリダイレクト |
| `/biz/auth` | `src/app/(business)/biz/auth/page.tsx` | 企業側ログイン（別ページ） |

`/auth` は正常に存在する。ルーティング自体の問題ではない。

---

## 3. /auth ページのセッション検出ロジック（最有力原因）

**ファイル**: `src/app/(jobseeker)/auth/page.tsx`

```tsx
useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    const user = session?.user ?? null;
    if (user) router.replace(nextUrl || "/");  // ← すでにログイン済みなら "/" へ戻す
  });
}, [nextUrl, router]);
```

- ページ描画直後に `getSession()` を呼び出す
- **セッションが有効なら即 `router.replace("/")` → トップページに戻る**
- 高速回線では「/auth を開いた瞬間に / に戻る」ため、ユーザーから見ると**何も起きていないように見える**

---

## 4. 最有力仮説: ヘッダーとセッション状態の不整合

### 再現シナリオ

1. ユーザーが Supabase セッションを持っている（有効なログイン状態）
2. しかし何らかの理由でヘッダーが「未ログイン」状態を表示している
   - `getSession()` が失敗 or タイムアウト → `user = null` のまま `loading = false`
   - `ow_users` テーブルのレコードが存在しないことによるアプリレベルのログアウト扱い
3. ユーザーが「ログイン」ボタンを押す → `/auth` へ遷移
4. `/auth` ページの `useEffect` が Supabase セッションを検出 → `router.replace("/")`
5. トップページに戻る → 「何も起きなかった」ように見える

### サブ仮説: /mypage hydration errors の影響

別件A として把握済みの React hydration errors (#418/#423/#425) が `/mypage` で発生中。
これらは `/mypage` 上のナビゲーション不能（React ツリー破損）を引き起こすことが確認済み。
ヘッダーも `/mypage` の React ツリー内にあるため、同じ hydration エラーによって
`loading` フラグや `user` state の更新が正常に反映されない可能性がある。

---

## 5. その他の可能性（低確率）

| 仮説 | 評価 | 根拠 |
|------|------|------|
| `/auth` ルートが存在しない | ❌ 否定 | `src/app/(jobseeker)/auth/page.tsx` で確認済み |
| `<Link>` のクリックが CSS でブロックされている | ❌ 低確率 | `z-index` 問題なら他の UI も壊れるはず |
| `handleClickOutside` (dropdown) が伝搬を止めている | ❌ 否定 | `mousedown` リスナーで `preventDefault` なし |
| ミドルウェアがリダイレクトしている | ❌ 否定 | `src/middleware.ts` は `/biz/` と `/admin/` のみ対象 |

---

## 6. 修正方針（実施は別セッション）

### 根本修正（推奨）

`/auth/page.tsx` の `useEffect` より前に、**初期レンダリング時にセッションを SSR で確認**するか、
または「すでにログイン済みの場合は /auth にリダイレクトされてきたことを検知してダッシュボードや /mypage に案内する UI」を追加する。

```tsx
// 案: ログイン済みユーザーが /auth を開いた場合の表示
if (user) {
  return (
    <div>
      <p>すでにログイン済みです。</p>
      <Link href="/mypage">マイページへ</Link>
    </div>
  );
}
```

### 先決事項

別件A（/mypage hydration errors #418/#423/#425）を先に修正する。
ヘッダーが正しく `user` を表示できていれば、ログイン済みユーザーにはボタンが表示されないため
この問題が自然解消する可能性がある。

---

## 確認できなかった点

- 実際に「ログイン済み状態でログインボタンが表示される」事象が本番で再現するか
  （ブラウザの Application タブで `supabase-auth-token` cookie を確認すれば判定可能）
- `/auth/page.tsx` の `getSession()` 失敗率（Vercel ログで要確認）

---

*変更は一切行っていません。このファイルの作成のみです。*
