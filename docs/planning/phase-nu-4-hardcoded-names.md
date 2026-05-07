# Phase ν-4 Sub-step 4A-0: ハードコード名グレップ結果

調査日: 2026-05-06
調査担当: Claude (Sub-step 4A-0)
コード変更: なし（調査のみ）

---

## 調査コマンド

```bash
grep -rn "田中翔太" src/app --include="*.tsx" --include="*.ts"
grep -rn "田中\|Tanaka\|たなか" src/app --include="*.tsx" --include="*.ts"
grep -rn "tanaka@\|tanaka\." src/app --include="*.tsx" --include="*.ts"
grep -rn "hshiba\|柴久人\|柴さん" src/app --include="*.tsx" --include="*.ts"
grep -rn "おかえりなさい\|こんにちは、\|ようこそ" src/app --include="*.tsx" --include="*.ts"
```

---

## 発見件数サマリー

| 分類 | 件数 |
|------|------|
| **UI 影響あり（4A-1 修正対象）** | **1件** |
| UI 影響なし（mock データファイル内） | 6件 |
| 管理者メール（意図的ハードコード） | 3件 |
| その他（カラーマップ等）| 2件 |

---

## ① UI 影響あり — 4A-1 で修正が必要

### `src/app/(jobseeker)/mypage/MypageClient.tsx:303`
```tsx
おかえりなさい、田中翔太さん
```
- **分類**: ページコンポーネント内のリテラル文字列
- **影響**: `/mypage` を開いたすべてのログインユーザーに「田中翔太さん」と表示される
- **修正方針**: `userName` 変数（line 910: `owUser?.name ?? "ユーザー"`）に切り替える
- **対応**: **Sub-step 4A-1 で修正**

---

## ② UI 影響なし — mock データファイル内（修正不要）

### `src/app/(jobseeker)/mypage/mockMypageData.ts:221`
```ts
meta: "田中翔太さん · タイミー · 2025.10.12",
```
- mock データファイル内の宣言。Supabase 接続時に丸ごと置き換わるため放置可。

### `src/app/(jobseeker)/profile/edit/mockProfileData.ts:98`
### `src/app/profile/edit/mockProfileData.ts:98`（旧パス、重複）
```ts
email: "tanaka@example.com",
```
- mock データファイル内の宣言。UI には表示されるが架空のメールアドレス（example.com）であり問題なし。

### `src/app/companies/[id]/mockDetailData.ts:275,413`
```ts
name: "田中 健一さん",   // line 275
name: "田中 翔太さん",   // line 413
```
- mock データファイル内の人名データ。Supabase 接続後に置き換わる予定。現状問題なし。

---

## ③ トップページ mock カード — 許容範囲

### `src/app/(jobseeker)/page.tsx:18,577`
```tsx
// MENTORS 配列（line 18）
{ name: "田中 翔太", path: "元 Salesforce → スタートアップ CRO", ... }

// デモカード（line 577）
{ name: "田中 翔太", path: "元Salesforce営業 → 現CRO", ... }
```
- トップページのデモ表示用 mock カード。実ユーザーデータとは無関係。
- 「田中翔太」というペルソナ名が表示されるが、これはデモ用コンテンツとして意図的。
- **今後 Phase ν-5 以降で実メンターデータに切り替える際に自然消滅する。現時点では放置可。**

---

## ④ 管理者メール — 意図的ハードコード（Phase ν-4 スコープ外）

### `src/app/for-companies/page.tsx:89`
```tsx
<a href="mailto:hshiba@opinio.co.jp">
```
- 企業向けページの「お問い合わせ」リンク。意図的に公開されている問い合わせ先。
- Phase ν-4 スコープ外。将来的に環境変数化が望ましいが今は放置可。

### `src/app/api/consultation/book/route.ts:70`
```ts
const adminEmail = process.env.adminEmail || "hshiba@opinio.co.jp";
```

### `src/app/api/consultation-request/notify/route.ts:16`
```ts
const adminEmail = process.env.adminEmail || "hshiba@opinio.co.jp";
```
- API Route 内のフォールバック。環境変数 `adminEmail` が未設定の場合のみ使用される。
- `process.env.adminEmail` を設定すれば解消できるが、Phase ν-4 スコープ外。

---

## ⑤ カラーマップ — 名前ではなく姓キーの辞書

### `src/app/career-consultation/CareerConsultationClient.tsx:68`
### `src/app/career-consultation/[id]/page.tsx:25`
```ts
const COVER_COLORS: Record<string, string> = {
  "柴": "#0f172a",
  "田中": "#0070d2",
  ...
};
```
- 姓の先頭文字をキーとするカラーマッピング辞書。
- 「田中」は表示名ではなく、アバターカラーのルックアップキー。修正不要。

---

## 判定まとめ

| ファイル | 行 | 内容 | 判定 |
|---------|---|------|------|
| `MypageClient.tsx` | 303 | `田中翔太さん` リテラル | **🔴 4A-1 修正対象** |
| `mockMypageData.ts` | 221 | mock データ宣言 | ✅ 放置可 |
| `mockProfileData.ts` | 98 | mock メールアドレス | ✅ 放置可 |
| `mockDetailData.ts` | 275, 413 | mock 人名データ | ✅ 放置可 |
| `page.tsx` (top) | 18, 577 | デモ用 mock カード | ✅ 放置可（ν-5 で自然消滅） |
| `for-companies/page.tsx` | 89 | mailto リンク | ✅ 意図的（スコープ外） |
| `route.ts` × 2 | 70 / 16 | 管理者メール fallback | ✅ 許容（スコープ外） |
| `CareerConsultation*.tsx` | 68 / 25 | 姓キーのカラーマップ | ✅ 修正不要 |

---

## Sub-step 4A-1 への引き継ぎ

**修正対象は1件のみ**:
- `src/app/(jobseeker)/mypage/MypageClient.tsx:303`
- `おかえりなさい、田中翔太さん` → `おかえりなさい、{userName}さん`
- `userName` は line 910 で `owUser?.name ?? "ユーザー"` として定義済み

**TODO コメント追加対象（コード変更ではなくコメント追加）**:
- `MypageClient.tsx:366` — `{MOCK_USER.currentRole}`
- `MypageClient.tsx:388` — `{MOCK_USER.profileCompletion}%`
- `MypageClient.tsx:393` — プロフィール完成度バー幅
