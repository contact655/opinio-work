# 調査報告: /mypage hydration エラー #418/#423/#425 の原因箇所特定

作成: 2026-05-19  
目的: 修正なし。事実のみ確認・記録。  
対象: commit `c03d34b` 時点の実装

---

## 1. バージョン確認

```json
"next":      "14.2.35"
"react":     "^18"
"react-dom": "^18"
```

インストール済みのマイナーバージョンは `package-lock.json` / `node_modules` の実物で確認要（`^18` は 18.x 系任意）。

---

## 2. React #418 / #423 / #425 の意味（React 18 error decoder 準拠）

| エラー番号 | React 18 メッセージ（要約） | 発生タイミング |
|-----------|--------------------------|--------------|
| **#418** | "Hydration failed because the initial UI does not match what was rendered on the server." | SSR で生成した HTML と、クライアントが最初に描画するコンポーネントツリーの構造/属性が一致しない |
| **#423** | "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering." | hydration 中にエラーが発生し、Suspense 境界の外であったため root 全体がクライアントレンダリングに切り替わった |
| **#425** | "Text content does not match server-rendered HTML." | テキストノードの内容がサーバーレンダリング結果とクライアントの初回レンダリングで異なる |

→ 3つは「ツリー構造の不一致（#418）」「テキスト内容の不一致（#425）」「その結果としてのハイドレーション失敗（#423）」で連動して発生する組み合わせ。

---

## 3. /mypage のファイル構成

```
find src/app -path "*mypage*" の結果:

src/app/(jobseeker)/mypage/
  page.tsx                              ← async Server Component（認証 + Supabase データ取得）
  layout.tsx                            ← Server Component（MypageMockProvider でラップ）
  MypageClient.tsx                      ← "use client"（全ビュー管理、props で DB データ受け取り）
  _components/
    MypageLayout.tsx                    ← "use client"（サイドバー・グリッドレイアウト）
    MypageMockContext.tsx               ← "use client"（isMentor Context）
  applications/page.tsx
  conversations/page.tsx
  conversations/[id]/page.tsx

src/app/mypage/mockMypageData.ts       ← 静的 mock データ（Date() 呼び出しなし）

src/components/profile/
  UserProfileCard.tsx                  ← "use client" ではない（grep で確認）
  MergedTimeline.tsx                   ← "use client" ではない
  CompanyLogoImg.tsx                   ← "use client"（useState で broken フォールバック）
  SchoolLogoImg.tsx                    ← "use client"
```

---

## 4. page.tsx の構成（Server Component）

- `async function MypagePage()` — Server Component
- Supabase から `owUser`, `skillTags`, `educations`, `certifications`, `timelineCareers`, `companyBookmarks`, `casualMeetings`, `mentorReservations` を取得
- `page.tsx` 内で `toLocaleDateString("ja-JP", ...)` を呼び出してフォーマット済み文字列を生成し、`CasualMeeting.applied_at` / `MentorReservation.applied_at` として props に含める
- 最終的に `<MypageClient ...props />` を return して終了
- `page.tsx` は SSR 時にサーバー上で一度だけ実行 → フォーマット済み文字列は props として固定 → クライアント hydration 時には再計算しない → `page.tsx` 内の日付フォーマットは hydration 差の原因ではない

---

## 5. hydration 差を生む箇所の検出

### 🔴 CANDIDATE 1（最高優先度）: MergedTimeline.tsx L97 — レンダリング中の `new Date()`

**ファイル**: `src/components/profile/MergedTimeline.tsx`  
**行**: L95–110（関数 `formatDuration`）

```typescript
function formatDuration(start: string, end: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();  // ← 問題箇所

  const totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());    // ← タイムゾーン依存

  if (totalMonths <= 0) return "";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}ヶ月`;
  if (months === 0) return `${years}年`;
  return `${years}年${months}ヶ月`;               // ← テキスト内容がここに出る
}
```

**この関数がレンダリング中に呼ばれる箇所**（実コード、grep 確認済み）:

| 行 | 呼び出し箇所 | `end` が null になる条件 |
|----|------------|------------------------|
| L491 | `CareerCardContent` コンポーネント render | `data.ended_at === null`（is_current=true の職歴） |
| L572 | `EducationCard` コンポーネント render | `data.graduated_at === null`（在学中の学歴） |
| L624 | グループ内の `ChildCareerCard` render | `data.ended_at === null` |
| L855 | inline render | `data.ended_at` が null のとき |
| L900 | career-group の `formatDuration(groupStart, groupEnd)` | `groupEnd === null`（グループに is_current 行がある） |
| L938 | education entry inline render | `e.graduated_at === null` |

**なぜ hydration 差が生まれるか**:

`end === null`（現職 / 在学中）の場合、`new Date()` が呼ばれる。

- **サーバー側**（Node.js / Vercel）: `new Date()` → UTC 時刻 → `getMonth()` = UTC 月
- **クライアント側**（ブラウザ / 日本ユーザー）: `new Date()` → JST（UTC+9）時刻 → `getMonth()` = JST 月

**具体例**: UTC 23:00 にサーバーが SSR → サーバーは 5月と判定 → クライアント（JST 8:00 翌日）は 6月と判定 → `totalMonths` が 1 ずれる → "X年Yヶ月" が異なる → **#425（テキスト不一致）** → **#418 / #423 cascading**

JST 以外でも、UTC 0:00 をまたぐ瞬間（月末 → 翌1日）は同様。`getFullYear()` も同様の問題あり（年末）。

**影響を受けるユーザー**: `ow_experiences.is_current = true` の職歴データを持つユーザー、または `ow_user_educations.is_current = true` の学歴データを持つユーザー。データが 0 件の場合は影響なし（`formatDuration` 自体が呼ばれない）。

---

### 🟡 CANDIDATE 2（中優先度）: MypageLayout.tsx L114 — `process.env.NODE_ENV` による条件レンダリング

**ファイル**: `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx`  
**行**: L114–151

```tsx
{process.env.NODE_ENV === "development" && (
  <div style={{ background: "var(--bg-tint)", ... }}>
    {/* MOCK: メンター切替バナー */}
  </div>
)}
```

**なぜ hydration 差の候補か**:

`process.env.NODE_ENV` は Next.js がクライアントバンドルにビルド時インライン化する。通常はサーバー・クライアントで同値。しかし:
- `next dev` 環境: サーバーも `"development"` → クライアントも `"development"` → **一致（問題なし）**
- `next build && next start` または Vercel: `"production"` → **一致（問題なし）**

→ **通常の Next.js 運用では hydration 問題は生じない**。ただし、環境変数を意図せず上書きしている場合（`.env.development.local` 等）は差が生じる可能性がある。

**判定**: 低優先度。通常は問題なし。念のため候補として記録。

---

### 🟢 CANDIDATE 3（低優先度・onClick 内のみ）: window.location.href / window.scrollTo

**ファイル**: `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx`

```tsx
// L171
onClick={() => { window.location.href = "/mypage"; }}
// L172
onClick={() => { window.location.href = "/mypage/applications"; }}
// L173
onClick={() => { window.location.href = "/mypage/conversations"; }}
// L201
onClick={() => { window.location.href = "/profile/edit"; }}
```

**ファイル**: `src/app/(jobseeker)/mypage/MypageClient.tsx`

```tsx
// L696
window.scrollTo({ top: 0, behavior: "smooth" });
```

**判定**: **hydration 問題ではない**。いずれも onClick / useCallback のコールバック内で、レンダリング中には実行されない。サーバー側で HTML を生成する際にも、関数参照として JSX に渡されるだけで関数本体は呼ばれない。

---

### 🟢 CANDIDATE 4（低優先度）: CompanyLogoImg.tsx / SchoolLogoImg.tsx — `useState(false)` for broken

```tsx
const [broken, setBroken] = useState(false);
// broken=true のとき LetterCircle を返す（分岐あり）
```

**判定**: **hydration 問題ではない**。初期状態は `false` → SSR 時も hydration 時も `<img>` を表示。`onError` は画像ロード失敗時にのみ発火（ブラウザのみ）。初回レンダリング結果は一致する。

---

## 6. まとめ

| 候補 | ファイル:行 | 優先度 | hydration 差の発生条件 |
|------|-----------|-------|----------------------|
| `formatDuration` 内の `new Date()` | `MergedTimeline.tsx:97` | 🔴 最高 | is_current=true の職歴/学歴データがある + サーバー(UTC)とクライアント(JST)で `getMonth()` が異なる瞬間 |
| `process.env.NODE_ENV` 条件レンダリング | `MypageLayout.tsx:114` | 🟡 低 | 通常の Next.js 運用では問題なし |
| `window.*` 呼び出し | `MypageLayout.tsx:171-201`, `MypageClient.tsx:696` | 🟢 なし | onClick 内のため render 時に実行されない |
| `useState(false)` (broken) | `CompanyLogoImg.tsx:31` 等 | 🟢 なし | 初期値が一定のため hydration 差なし |

**最有力根本原因**: `MergedTimeline.tsx` L97 の `new Date()` — UTC/JST タイムゾーン差による `totalMonths` の計算ズレ → `"X年Yヶ月"` テキストの不一致 → **#425** → **#418 / #423**

**断定のために追加で必要な事実**:
- 実際に `is_current=true` の職歴/学歴データが存在するユーザーでエラーが発生しているか（データ条件の確認）
- ブラウザコンソールのエラーメッセージに "Text content does not match" が含まれているか（#425 の具体テキスト）
- エラー再現の時刻が UTC/JST 月境界付近か（タイムゾーン仮説の検証）

**修正方針（実装しない・記録のみ）**:
- `formatDuration` の `new Date()` を固定値に置き換える: `end === null` のとき `new Date()` ではなく、サーバー側でも同様に呼ばれる文字列（例: 今日の YYYY-MM を props で渡す、または `useEffect` で初期値を上書き）
- または、現在進行中の職歴の duration 表示をクライアント専用（`useEffect` 後に更新）にして、初回 SSR では空/ゼロで render する
