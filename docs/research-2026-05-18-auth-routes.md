# 調査報告: ログイン/認証ルート事実確認

作成: 2026-05-18  
目的: 修正なし。事実のみ確認・記録。  
対象: commit `040340d`（c213f8b 適用後）時点の状態。

---

## 1. src/app/ トップレベルルート一覧

```
ls src/app/ の実行結果（抜粋・全件）:
(jobseeker)     ← ルートグループ（URL には影響しない）
_dev
about
admin
api
articles
auth
biz
business
career-consultation
companies
consultation-cases
consultation-request
favicon.ico
fonts
globals.css
jobs
layout.tsx
mentor
mentor-terms
mypage
not-job-changing
onboarding
opengraph-image.tsx
privacy
profile
robots.ts
scout
sitemap.ts
terms
users
```

---

## 2. 認証系 page.tsx の実体パス

```
find src/app -name "page.tsx" -path "*auth*" の結果:

src/app/biz/auth/page.tsx
src/app/biz/auth/signup/page.tsx
src/app/biz/auth/accept-invite/page.tsx
src/app/(jobseeker)/auth/page.tsx
src/app/auth/signup/page.tsx
src/app/auth/signin/page.tsx
src/app/auth/login/page.tsx
```

### 各ファイルの役割（head -5 で確認）

| ファイル | 役割 |
|---------|------|
| `src/app/(jobseeker)/auth/page.tsx` | **主たる求職者認証ページ**。`"use client"` + `useSearchParams`。URL は `/auth`（ルートグループは URL に出ない） |
| `src/app/auth/signup/page.tsx` | `/auth` へ `redirect("/auth")` するだけのリダイレクタ |
| `src/app/auth/signin/page.tsx` | `/auth?mode=login` へ `redirect(...)` するだけのリダイレクタ |
| `src/app/auth/login/page.tsx` | `/auth?mode=login` へ `redirect(...)` するだけのリダイレクタ |
| `src/app/biz/auth/page.tsx` | 企業側ログイン（別系統） |
| `src/app/biz/auth/signup/page.tsx` | 企業側サインアップ |
| `src/app/biz/auth/accept-invite/page.tsx` | 企業側招待受諾 |

**事実**: `/auth` の実体は `src/app/(jobseeker)/auth/page.tsx` の1ファイルのみ。
`/auth/signup`・`/auth/signin`・`/auth/login` は全て `/auth` へのリダイレクタであり、
認証ロジックを持たない。

### auth/callback

```
src/app/auth/callback/route.ts  ← page.tsx ではなく Route Handler（1ファイル）
```

---

## 3. middleware.ts の認証リダイレクト先（grep -n "auth" 結果）

```
L7:  *   - 未ログイン: /biz/auth にリダイレクト
L8:  *   - /biz/auth と /biz/auth/signup は素通り
L13: * /admin/ 配下のアクセス制御（二重防御 — layout.tsx の auth_is_admin() と重複）
L14: *   - 未ログイン: /biz/auth にリダイレクト   ← コメントが古い（c213f8b 前の記述）
L15: *   - ロール確認は layout.tsx で行う
L17: const BIZ_PUBLIC_PATHS = ["/biz/auth", "/biz/auth/signup", "/biz/auth/accept-invite"];
L48: const { data: { user } } = await supabase.auth.getUser();
L51:   url.pathname = pathname.startsWith("/admin") ? "/auth" : "/biz/auth";
```

### 重要: コメント（L14）と実装（L51）の乖離

| 対象パス | コメント記載 | 実装（L51）の実際 |
|---------|------------|----------------|
| `/biz/*` | `/biz/auth` | `/biz/auth` ← 一致 |
| `/admin/*` | `/biz/auth`（古いコメント） | `/auth` ← c213f8b で修正済み |

**事実**: L14 のコメント「未ログイン: /biz/auth にリダイレクト」は
`/admin/*` に対して誤りが残っている（コードは正しいが、コメントが古い）。
実装は正しい（L51 の三項演算子）。コメントのみ乖離している。

---

## 4. /admin 配下のログイン入口

### middleware（L51）: 未認証時
```typescript
url.pathname = pathname.startsWith("/admin") ? "/auth" : "/biz/auth";
```
→ `/admin/*` 未認証 → `/auth?next=<元パス>` にリダイレクト

### admin/layout.tsx（L38）: 認証後のロール確認
```typescript
redirect("/auth?next=/admin");   // user が null の場合
redirect("/");                   // isAdmin が false の場合（ロールなし）
```

**事実**:
- `/admin` のログイン入口は求職者側と **共通の `/auth`**（`/biz/auth` とは別系統）。
- ガードは2段階: middleware（未認証チェック）→ layout.tsx（`auth_is_admin()` RPC）。
- ロールなしの場合は `/`（トップ）に飛ばされる（`/auth` ではない点に注意）。

---

## 5. /biz/* の現存確認（c213f8b 後）

```
ls src/app/biz/ の結果:
applications
auth
companies
company
conversations
dashboard
jobs
meetings
members
organization
posts
select-company
```

**事実**: `/biz/` ディレクトリは健在。c213f8b は `/biz/auth` を削除していない。
`/biz/auth/page.tsx`・`/biz/auth/signup/page.tsx`・`/biz/auth/accept-invite/page.tsx`
いずれも存在する（c213f8b の変更対象は middleware.ts と admin/layout.tsx の2行のみで、
`/biz/` のファイル群には無変更）。

---

## まとめ（事実の整理）

```
認証ページ構成（URL ベース）:

/auth                   ← 求職者・admin 共通ログイン画面
                           実体: src/app/(jobseeker)/auth/page.tsx
/auth/signup            ← /auth へリダイレクト（実質エイリアス）
/auth/signin            ← /auth?mode=login へリダイレクト
/auth/login             ← /auth?mode=login へリダイレクト
/auth/callback          ← OAuth コールバック（Route Handler）

/biz/auth               ← 企業側ログイン（別実装・別 UI）
/biz/auth/signup        ← 企業側サインアップ
/biz/auth/accept-invite ← 企業側招待受諾

ガード対象:
  /biz/* → middleware → 未認証: /biz/auth へ
  /admin/* → middleware → 未認証: /auth へ
             admin/layout.tsx → user=null: /auth?next=/admin へ
                              → isAdmin=false: / へ
```

### 次セッションで把握すべき残論点

- `middleware.ts` L14 のコメント（`/admin/` 配下は `/biz/auth` と記述）が
  実装と乖離している。コードは正しいが、コメントは古い。
  修正するなら `/auth` に書き直す1行変更（今回は修正しない）。
- `admin/layout.tsx` の `getUser()` が null を返す問題（再ログイン要求）の
  原因は本調査では未特定。middleware の `getUser()` との整合性は別途調査が必要。
