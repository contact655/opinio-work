# 調査レポート: ログイン不安定（「ログイン押下 → トップに戻り未ログイン表示のまま」）

作成日: 2026-05-18  
調査種別: コード変更なし・調査のみ  
対象ユーザー: s.hisato1020@gmail.com  
症状: ログイン押下後、トップに戻り未ログイン表示のまま。シークレット窓では成功。

---

## 1. /auth ページのログイン成功後の遷移ロジック

**ファイル**: `src/app/(jobseeker)/auth/page.tsx` L143–167

```tsx
// handleLogin（L143-167）
const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

if (loginError) {
  setError("..."); setLoading(false); return;
}

router.push(nextUrl === "/" ? "/companies" : nextUrl);
router.refresh();
```

### ポイント

| 項目 | 内容 |
|------|------|
| `signInWithPassword` | `await` あり。認証自体に race condition はない |
| ログイン成功後の遷移先 | `nextUrl` が `"/"` のとき `/companies`、それ以外は `nextUrl` |
| `nextUrl` の値 | ヘッダーの `<Link href="/auth">` は `?next=` なし → `rawNext=""` → `nextUrl="/"` |
| 実際の遷移先 | `router.push("/companies")` |
| その直後 | `router.refresh()` を呼び出す |

`router.push()` は **クライアントサイドナビゲーション**（フルリロードなし）。  
`router.refresh()` はサーバーコンポーネントのデータを再取得するが、  
**クライアントコンポーネントの state はリセットしない**。

---

## 2. ヘッダーの user state 取得経路

**ファイル**: `src/components/jobseeker/JobseekerHeader.tsx` L25–49

```tsx
useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession()
    .then(async ({ data: { session } }) => {
      const authUser = session?.user;
      if (!authUser) return;
      const { data: owUser } = await supabase
        .from("ow_users").select("name").eq("auth_id", authUser.id).maybeSingle();
      setUser({ email: authUser.email ?? "", name: owUser?.name ?? ... });
    })
    .catch(() => { /* loading 解除のみ */ })
    .finally(() => { setLoading(false); });
}, []);  // ← 依存配列は空（マウント時1回のみ）
```

### 決定的な構造上の問題

**`onAuthStateChange` のサブスクリプションが存在しない。**

Supabase が提供する `supabase.auth.onAuthStateChange` は、`signInWithPassword` 成功後に
`SIGNED_IN` イベントを発行する。しかしヘッダーはこれを購読していない。

取得経路は**マウント時の `getSession()` 一回のみ**。

### JobseekerHeader はレイアウト内のコンポーネント

Next.js App Router ではレイアウトコンポーネントはページ間ナビゲーションをまたいで**永続する**。  
`router.push("/companies")` でページを移動しても、  
ヘッダーは**アンマウントされず `useEffect` も再実行されない**。

結果: `/auth` でログインに成功しても、ヘッダーの `user` state は `null` のまま。  
ログイン・無料登録ボタンが引き続き表示される。

### SSR/CSR の境界

```tsx
// ヘッダーは loading=true でレンダリング開始
const [loading, setLoading] = useState(true);

// !loading になるまでボタンエリアは何も描画しない
{!loading && ( user ? <アバター/> : <ログインボタン/> )}
```

SSR 時は `loading=true` のままなのでボタンは描画されない（hydration ミスマッチ回避）。  
CSR でマウント後に `getSession()` が解決して初めてボタンが現れる。  
この設計自体は正しいが、`onAuthStateChange` がないため**ログイン後の更新ができない**。

---

## 3. 別件A（hydration errors #418/#423/#425）との因果

### 別件A の所在

別件A の hydration errors は `/mypage` の `MypageClient.tsx` 内で発生している。  
ヘッダー (`JobseekerHeader`) は `/mypage` ページとは別の React ツリー要素だが、  
同一のレイアウト木 (`src/app/(jobseeker)/layout.tsx` 等) の中に存在する。

### 因果の有無

| 問い | 判定 | 根拠 |
|------|------|------|
| 別件A が直接ヘッダーの `user` state を壊すか | **なし** | hydration errors は `MypageClient` のサーバー/クライアント不一致。ヘッダーは別ツリー |
| 別件A が「ログインボタンが押せない」ように見せるか | **間接的にあり得る** | React ツリー全体が破損すると親コンポーネントのイベントハンドラが動かなくなる場合がある。ただし `/mypage` 以外のページでも症状が出ているなら無関係 |
| ログイン不安定は別件A がなくても発生するか | **はい** | 構造上の問題（`onAuthStateChange` 欠如 + CSR ナビゲーション後に state 未更新）はページに依存しない |

**結論: ログイン不安定と別件A は独立した別バグ。** 別件A が解消してもログイン不安定は残る。

---

## 4. 「ログイン処理が走ったが UI に反映されず黙ってトップに戻る」コード経路

### 経路 A: ログインは成功したが state が更新されないケース

```
① ユーザー: ヘッダーの「ログイン」クリック → /auth へ移動
   （router.push or <Link>、どちらもクライアントサイドナビ）

② /auth マウント時 useEffect: getSession() → session なし → ログインフォーム表示

③ ユーザー: メール+パスワード入力 → 「ログイン」ボタン

④ signInWithPassword 成功 → Supabase が cookie/localStorage にセッションを書き込む

⑤ router.push("/companies") → クライアントサイドナビゲーション
   ↓ ヘッダーはアンマウントされない（レイアウト継続）
   ↓ ヘッダーの useEffect は再実行されない
   ↓ user state = null のまま

⑥ router.refresh() → サーバーコンポーネント再フェッチ
   ↓ クライアント state には一切影響しない
   ↓ user state = null のまま

⑦ 画面: /companies に移動しているが、ヘッダーは「ログイン」ボタン表示
   ユーザーは「ログインできていない？」と思う
```

### 経路 B: すでにセッションがある状態で「ログイン」を再クリックするケース

```
⑧ ユーザー: 「ログイン」ボタンを再クリック → /auth へ移動

⑨ /auth マウント時 useEffect: getSession() → 有効なセッション検出
   → router.replace(nextUrl || "/") = router.replace("/") → トップページへ
   （nextUrl は "/" ← ?next= パラメータなし）

⑩ 画面: トップページに戻る。ヘッダーはまだ「ログイン」表示
   （④で書き込まれたセッションはブラウザにあるが state は更新されていない）

⑪ ユーザー: 「また何も起きなかった」と感じる → ⑧ に戻る（無限ループ）
```

### 経路 C: getSession() が例外を投げる、または ow_users クエリで遅延するケース

```
ヘッダー useEffect:
  getSession() が遅延 or ネットワークエラー
  → .catch() が呼ばれる
  → finally: setLoading(false) → user = null のまま「ログイン」ボタン表示
  （実際にはセッションが存在していても表示が「未ログイン」になる）
```

---

## 5. 結論: 根本原因と修正方針

### 根本原因（最有力仮説）

**「ヘッダーが `onAuthStateChange` を購読していない」ことによる、  
クライアントサイドナビゲーション後の state 未更新。**

1. `signInWithPassword` 自体は成功している（エラーは出ない）
2. セッションはブラウザに正しく保存されている
3. しかし `router.push()` はフルリロードではないため、レイアウト内のヘッダーは再マウントされない
4. `onAuthStateChange` がないため、ログインイベントを受け取れない
5. 結果: セッションあり・ヘッダー「ログイン」表示という矛盾した状態に陥る
6. 再度「ログイン」をクリック → `/auth` がセッション検出 → `router.replace("/")` → ループ

### なぜシークレット窓では成功したか

シークレット窓では初回ナビゲーションがフルページロードになりやすい。  
特に `/auth` から別ドメインや新しいパスへの `router.push()` 後に Next.js が  
ハードナビゲーションにフォールバックした場合、ヘッダーが再マウントされて  
`getSession()` が正常に実行される。  
また、通常窓でキャッシュ・localStorage が汚染されていた可能性も排除できない。

### 別件A と統合して直すべきか、独立で直せるか

| 観点 | 判定 |
|------|------|
| 原因の独立性 | 完全に独立（別件A は MypageClient の SSR/CSR ミスマッチ、ログイン不安定はヘッダーの state 更新欠如） |
| 修正の独立性 | 独立して修正可能 |
| 推奨順序 | **ログイン不安定を先に直す**（全ページに影響・ユーザーへの心理的ダメージが大きい） |

### 修正提案（実施は別セッション）

**修正 1（必須）: JobseekerHeader に `onAuthStateChange` を追加**

```tsx
// src/components/jobseeker/JobseekerHeader.tsx
useEffect(() => {
  const supabase = createClient();

  // 初回マウント時のセッション取得（既存コードと同じ）
  supabase.auth.getSession().then(async ({ data: { session } }) => { ... });

  // ログイン/ログアウトイベントを購読（新規追加）
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data: owUser } = await supabase
          .from("ow_users").select("name").eq("auth_id", session.user.id).maybeSingle();
        setUser({ email: session.user.email ?? "", name: owUser?.name ?? ... });
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
      }
    }
  );

  return () => subscription.unsubscribe();  // クリーンアップ
}, []);
```

**修正 2（推奨）: handleLogin 後の遷移をフルリロードに変更**

```tsx
// /auth/page.tsx handleLogin の末尾
// 変更前:
router.push(nextUrl === "/" ? "/companies" : nextUrl);
router.refresh();

// 変更後:
window.location.href = nextUrl === "/" ? "/companies" : nextUrl;
// (router.refresh() は不要になる)
```

フルリロードにすることで、ヘッダーが必ずマウントし直され `getSession()` が走る。  
ログイン直後の1回だけの操作なので UX 劣化は最小限。

**修正 3（補助）: 既ログイン時の `/auth` リダイレクト先を `/mypage` に変更**

```tsx
// /auth/page.tsx の既ログイン検出 useEffect
if (user) router.replace(nextUrl !== "/" ? nextUrl : "/mypage");
//                                                   ^^^^^^^^
// "/" の場合でも /mypage に誘導（ログイン済みユーザーのトップは /mypage が自然）
```

---

## 付記: 別件A（hydration errors）との切り分けチェックリスト

| 確認方法 | 判定 |
|---------|------|
| `/companies` でログイン後に「ログイン」ボタンが残るなら | ログイン不安定バグ（ヘッダー state 問題） |
| `/mypage` でのみ遷移が無反応なら | 別件A（hydration errors） |
| シークレット窓で `/companies` からログインしても残るなら | より深い問題（Supabase セッション自体の問題） |

---

*変更は一切行っていません。このファイルの作成のみです。*
