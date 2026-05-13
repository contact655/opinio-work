# Debug: ログアウトボタンが反応しない問題

調査日: 2026-05-13  
症状: https://opinio.jp でドロップダウン → ログアウトをクリックしても反応なし

---

## 結論（TL;DR）

**原因は 2 つ。メインは `router.push("/")` ＋ `setUser(null)` 未呼び出しの組み合わせ。**

| # | 問題 | ファイル | 重要度 |
|---|------|---------|--------|
| 1 | `handleLogout` が `setUser(null)` を呼ばず、`router.push("/")` が React 状態をリセットしない | `JobseekerHeader.tsx:69–74` | 🔴 Primary |
| 2 | `/about`・`/industries` ページが存在しない（フッターリンク → 404 プリフェッチ） | `JobseekerFooter.tsx` | 🟡 別件 |

---

## 調査詳細

### 1. 実際に使われているヘッダーの特定

`/`（トップ）は `src/app/(jobseeker)/layout.tsx` 配下。このレイアウトは `<Header>` ではなく **`<JobseekerHeader>`** を使っている：

```typescript
// src/app/(jobseeker)/layout.tsx
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
export default function JobseekerLayout({ children }) {
  return (
    <div>
      <JobseekerHeader />
      <main>{children}</main>
      <JobseekerFooter />
    </div>
  );
}
```

調査対象は `src/components/jobseeker/JobseekerHeader.tsx`（`src/components/Header.tsx` ではない）。

---

### 2. `handleLogout` の実装（問題箇所）

```typescript
// src/components/jobseeker/JobseekerHeader.tsx:69–74
async function handleLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();   // ← 1. セッション Cookie を削除
  setDropdownOpen(false);           // ← 2. ドロップダウンを閉じる
  router.push("/");                 // ← 3. "/" に soft navigate（問題）
}
```

**欠けているのは `setUser(null)` の呼び出し。**

---

### 3. バグのメカニズム

#### Step-by-step

```
ユーザーが "/" にいて「ログアウト」をクリック
  │
  ├─ supabase.auth.signOut() ── OK（Cookie は削除される）
  ├─ setDropdownOpen(false) ─── OK（ドロップダウンは閉じる）
  └─ router.push("/") ──────── ← ここが問題
              │
              ├─ Next.js App Router のソフトナビゲーション
              ├─ 同一レイアウト内では JobseekerHeader は「再マウントされない」
              ├─ useEffect([], []) は空 deps = マウント時のみ実行 → 再実行されない
              └─ user ステートが null にならない → アバターがそのまま表示
```

#### `Header.tsx`（/biz/ 側）との比較

```typescript
// src/components/Header.tsx（問題なし）
async function handleLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  setUser(null);              // ← setUser(null) を呼んでいる ✅
  setRoles([]);
  setProfileDropdownOpen(false);
  window.location.href = "/"; // ← フルリロード ✅
}
```

`Header.tsx` は `setUser(null)` と `window.location.href` の 2 重保険で確実に UI をリセットしている。  
`JobseekerHeader.tsx` はどちらも欠けている。

#### Next.js の `router.push()` vs `window.location.href` の違い

| | `router.push("/")` | `window.location.href = "/"` |
|---|---|---|
| 既にその URL にいる場合 | 同一パスでも再 fetch するが Client Component は再マウントされない | ブラウザが強制リロード → 全 React state がリセットされる |
| `useEffect([], [])` の再実行 | ❌ 同一レイアウト内では再実行されない | ✅ 完全マウントで必ず実行 |
| `user` state のリセット | ❌ `setUser(null)` を呼ばないと残る | ✅ state ごと破棄 |

---

### 4. `getSession()` と 未クリアの Cookie

`signOut()` が呼ばれた後、Cookie（セッション）自体は削除される。しかし `useEffect` が再実行されないため `user` state は古い値のまま。  
→ ユーザーには「ログアウトしたはずなのに avatar がそのまま」に見える  
→ 再度クリックすると `getSession()` が null を返し、ようやく UI が変わる

---

### 5. `/about` と `/industries` の 404 について（別件）

`JobseekerFooter.tsx` のリンク定義：

```typescript
{ href: "/about",      label: "Opinioについて" },
{ href: "/industries", label: "対象業界" },
```

これらのページは存在しない。Next.js の `<Link>` はビューポート内リンクを自動 prefetch するため、`?_rsc=` クエリ付きの RSC リクエストが飛んで 404 になる。  
**ログアウト不具合とは無関係。** 別途ページを作るか、`<a>` タグに変えるか、リンクを削除する対応が必要。

---

## 修正案

### Fix（`JobseekerHeader.tsx`）

```typescript
// Before（現状）
async function handleLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  setDropdownOpen(false);
  router.push("/");
}

// After（修正）
async function handleLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  setDropdownOpen(false);
  setUser(null);               // ← 追加: React state を即時クリア
  window.location.href = "/"; // ← 変更: フルリロードで確実にリセット
}
```

**`window.location.href` を採用する理由**:
- フルリロードにより `useEffect([], [])` が再実行される
- `user` state ごと破棄されるため `setUser(null)` と `window.location.href` は実は両方なくても片方で十分だが、2 重保険として両方書く
- `Header.tsx`（/biz/ 側）と実装を統一できる
- httpOnly Cookie の削除もミドルウェア経由で確実に処理される

`router.push` をそのまま使う場合でも `setUser(null)` と `router.refresh()` の組み合わせで対応可能だが、フルリロードが最も確実。

---

## 修正対象ファイル

```
src/components/jobseeker/JobseekerHeader.tsx
  L69–74  handleLogout 関数
```

---

**作成者**: Claude Code  
**作成日**: 2026-05-13
