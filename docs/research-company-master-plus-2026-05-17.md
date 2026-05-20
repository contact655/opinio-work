# 調査レポート: 会社名マスタ「＋新規登録」機能 事前調査

作成日: 2026-05-17  
調査対象: opinio-work リポジトリ  
目的: profile/edit 職歴入力の会社名予測を「未承認フラグ付き INSERT」対応にする前の構造把握

---

## 1. 会社名予測入力の現在地

### 予測コンポーネントのファイルパス

- **`src/app/(jobseeker)/profile/edit/CareerModal.tsx`**
  - L88〜L191: `CompanyMasterSearch` コンポーネント（インライン定義）
  - 企業名入力フィールド + ドロップダウン候補リストを描画
  - 現状は **`MOCK_COMPANIES`（`@/app/companies/mockCompanies`）をインポートし、クライアント側でフィルタリングしている**
  - Supabase / API への fetch は一切行っていない（静的モックのみ）

```tsx
// CareerModal.tsx L100-105（現在地）
const results = MOCK_COMPANIES.filter(
  (c) =>
    query.length > 0 &&
    (c.name.toLowerCase().includes(query.toLowerCase()) || c.name.includes(query))
).slice(0, 6);
```

> **重要**: `/api/companies/search` という本番用の予測 API（後述）がすでに存在するが、
> CareerModal はそれを使用していない。モックのみで動いている。

### 本番用の会社名予測 API（未使用）

- **`src/app/api/companies/search/route.ts`**（GET エンドポイント）
  - `status = 'active'` の企業を `name ILIKE %q%` で検索して返す
  - `createAdminClient()` で RLS をバイパス
  - `id, name, logo_url, industry, employee_count` を返す
  - CareerModal からは呼ばれていない（未接続）

### 学校名フィールドのパターン（流用候補）

- **`src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`** L822〜L870
  - `<input type="text" list="school-options" ...>` + `<datalist>` のネイティブコンボボックス
  - L2279〜L2292: ProfileEditClient トップレベルで `useEffect` 内に `supabase.from("ow_schools").select(...)` を1回だけ fetch、`schools` state に保存して props で渡す
  - マスタにない値も自由入力可（`school_id: null` になる）
  - 選択時に `school_id` を紐づけ、未選択/フリー入力は `null`

**会社名側への流用可否**: 学校名は `datalist`（ネイティブブラウザ候補）で、会社名は独自ドロップダウン（`CompanyMasterSearch`）と構造が異なる。学校名パターンをそのままコピーはできないが、「Supabase から fetch して state で保持 → コンポーネントに props 渡し」という fetch パターンは流用可能。ただし会社名は「＋登録」ボタン追加 + INSERT API 呼び出しが加わるため、独自ドロップダウンのまま拡張するのが自然。

---

## 2. ow_companies のスキーマ実態

### 承認・公開制御に関係するカラム（確認済み）

| カラム | 型 | デフォルト | 意味 |
|---|---|---|---|
| `status` | `TEXT` | `'pending'` | 元から存在。値: `'active'` / `'pending'` / その他。migration 001 で定義 |
| `is_published` | `BOOLEAN NOT NULL` | `false` | migration 031 で追加。biz 側の「公開する」ボタンで `true` になる |

### RLS ポリシー（migration 031 で更新済み）

```sql
CREATE POLICY "ow_companies_published_read"
  ON ow_companies FOR SELECT
  USING (is_published = true OR status = 'active');
```

→ **`is_published = true` または `status = 'active'` のどちらかを満たせば SELECT 可能**。
匿名ユーザーのアプリレイヤーからは、この RLS を通る（admin client は RLS バイパス）。

### `status` の現在の使われ方

- admin ダッシュボード (`src/app/admin/page.tsx` L12): `status = 'pending'` の件数カウント
- admin 一覧 (`src/app/admin/page.tsx` L158): `active` → 承認済 / `pending` → 審査中
- 予測 API (`src/app/api/companies/search/route.ts` L31): `.eq("status", "active")` でフィルタ

### 新カラム追加の要否（案）

`status` カラムは既存だが、値のバリエーションが `active` / `pending` しか確認されていない。
「ユーザーが登録した未承認企業」を区別する方法の案:

| 案 | 方法 | 必要な DB 変更 |
|---|---|---|
| A | `status = 'user_submitted'` を新規追加（既存 `status` 列を活用） | 不要（コードだけ変更） |
| B | `is_user_submitted: BOOLEAN` カラム新設 | migration 1本（ALTER TABLE） |
| C | `source: TEXT` カラム新設（`'admin'` / `'user'` 等） | migration 1本（ALTER TABLE） |

**案A が最小**: migration 不要。`status` の CHECK 制約もないため `user_submitted` を INSERT するだけ。
ただし admin が現状 `status = 'pending'` を「審査中」として使っているため意味が重複しないよう注意が必要。

---

## 3. 公開面で ow_companies を読んでいる箇所の全洗い出し

### 「公開面」（求職者・一般ユーザー向け）と判定した箇所

| ファイル | 関数/用途 | is_published/status フィルタ |
|---|---|---|
| `src/lib/search/companies.ts` | `searchCompanies()` — `/companies` 検索結果グリッド | `.eq("is_published", true)` ✅ |
| `src/lib/search/companies.ts` | `fetchDistinctIndustries()` — フィルタ選択肢 | `.eq("is_published", true)` ✅ |
| `src/lib/search/companies.ts` | `fetchDistinctLocations()` — フィルタ選択肢 | `.eq("is_published", true)` ✅ |
| `src/lib/supabase/queries.ts` | `getCompaniesForList()` — `/companies/list` | `.eq("is_published", true)`（本番のみ）✅ |
| `src/lib/supabase/queries.ts` | `getCompanies()` — `/jobs` など | **フィルタなし** ⚠️ |
| `src/lib/supabase/queries.ts` | `getCompanyById()` — `/companies/[id]` 詳細 | `.eq("is_published", true)`（本番のみ）✅ |
| `src/lib/supabase/queries.ts` | `getJobs()` の companies サブクエリ | **フィルタなし** ⚠️ |
| `src/lib/supabase/queries.ts` | `getJobById()` の company サブクエリ | **フィルタなし** ⚠️ |
| `src/app/api/companies/search/route.ts` | 会社名予測 API | `.eq("status", "active")` ✅ |
| `src/app/(jobseeker)/mypage/page.tsx` L114,147,191 | mypage 経歴・ブックマーク・面談での企業ロゴ取得 | **フィルタなし**（user_id/ids で絞る）— 許容範囲 |
| `src/app/(jobseeker)/u/[id]/page.tsx` L153 | 公開プロフィール経歴の企業ロゴ取得 | **フィルタなし**（ids で絞る）— 許容範囲 |
| `src/app/(jobseeker)/companies/[id]/posts/page.tsx` L17,36 | 企業ポストページ | **フィルタなし** ⚠️（会社詳細の子ページ） |

### verified フィルタを足す場合の影響範囲の所見

- **`is_published = true` で既にフィルタ済みの箇所**: `searchCompanies`, `getCompaniesForList`, `getCompanyById` → ここに `status != 'user_submitted'` 等を追加するだけで対応可能。1〜2行。
- **フィルタなしの公開向け箇所**: `getCompanies()` / `getJobs()` の company サブクエリ → RLS が効いているため匿名アクセスは `is_published OR status='active'` を通る。`user_submitted` を `status='pending'` 扱いにすれば追加フィルタ不要になる可能性あり（要確認）。
- **会社名予測 API は別経路**: `/api/companies/search/route.ts` は `status='active'` フィルタ済み。未承認企業を `status='user_submitted'` にすれば自動除外される。

**前回 `is_published` 横展開との比較**: 前回は `getCompanyById` 1箇所と `getCompaniesForList` 1箇所の修正で済んだ。今回も「予測候補に出さない」のみなら予測 API 1箇所（status 条件が既にある）、「公開ページに出さない」なら `searchCompanies` + `getCompaniesForList` の2箇所で済む見込み。前回と同規模。

---

## 4. データ構造・モック

### ow_experiences テーブルの会社名保持方法

`supabase/migrations/031_opinio_phase1_core_schema.sql` L243〜L273:

```sql
CREATE TABLE IF NOT EXISTS ow_experiences (
  company_id          UUID REFERENCES ow_companies(id) ON DELETE SET NULL,
  company_text        TEXT,
  company_anonymized  TEXT,
  -- CHECK: 3パターンのうち必ず1つだけ入ること
  CONSTRAINT experience_company_xor CHECK (
    (company_id IS NOT NULL)::int +
    (company_text IS NOT NULL)::int +
    (company_anonymized IS NOT NULL)::int = 1
  )
);
```

- **master パターン** → `company_id: UUID`（ow_companies の FK）
- **custom パターン** → `company_text: TEXT`（自由文字列、FK なし）
- **anon パターン** → `company_anonymized: TEXT`（匿名表示名）

### 「＋登録」した会社を経歴に紐づける際の現実装との繋ぎ方

ow_companies に INSERT して得た UUID を、`ow_experiences.company_id` に格納すれば OK（`company_text` や `company_anonymized` は NULL）。これは既存の master パターンそのもの。追加実装は不要。

### CareerModal の現在のモック状況

- `mockProfileData.ts` の `MOCK_PROFILE.experiences` は `companyType: "master"`, `companyId: "layerx"`（スラッグ文字列）を使っている
- CareerModal は `MOCK_COMPANIES`（スラッグ ID）を参照中
- 本番の `ow_experiences.company_id` は UUID — **現状 CareerModal は本番 DB と接続されていない（フル mock 動作）**

---

## 5. スコープ所感: 軽いか重いか

### 第1段の構成要素と重さ

| 構成要素 | 変更ファイル | 重さ |
|---|---|---|
| ① `CompanyMasterSearch` に「＋登録」ボタン追加 | `CareerModal.tsx` 1ファイル | 軽い |
| ② 未承認 INSERT API 新設 | `src/app/api/companies/register/route.ts`（新規）+ 既存 `route.ts` の活用検討 | 中 |
| ③ CareerModal を MOCK → `/api/companies/search` に切り替え | `CareerModal.tsx` 内 `CompanyMasterSearch` の fetch 差し替え | 軽い |
| ④ 予測候補から未承認除外 | `src/app/api/companies/search/route.ts` の `status` 条件で自動除外（案A なら変更不要） | 不要〜軽い |
| ⑤ 公開面（/companies カルーセル・一覧）から除外 | `src/lib/search/companies.ts` の `.eq("is_published", true)` で自動除外（未承認は is_published=false のまま） | 不要 |
| ⑥ 経歴保存 API（ow_experiences への INSERT）との接続 | 既存 `src/app/api/jobseeker/experiences/route.ts` があるか確認済み | 要確認（API 存在は確認済み、内容詳細は未調査） |

### 結論: **「中規模（2〜3ファイル、1〜2本の新規 API）」**

- `/companies` 公開ページへの影響: **ほぼゼロ**（`is_published=false` のまま INSERT すれば `searchCompanies` の既存フィルタで自動除外）
- 一番重いのは「CareerModal を mock から Supabase 接続に切り替える」こと（現在フル mock のため、fetch 差し替え + 経歴保存 API との結合テストが必要）
- schema 変更: 案A（`status='user_submitted'`）なら **migration 不要**
- 前回 B 案（申込カード再設計）より重いが、各工程は独立していて分割実装可能

---

## 確認できなかった点

- `src/app/api/jobseeker/experiences/route.ts` の詳細内容（CareerModal からの保存フローの詳細）
- ow_companies.status の CHECK 制約の有無（001 migration では制約なし、後続 migration で追加された可能性あり）
- 本番 DB の ow_companies レコードで `status` が実際に何の値を持っているか（MCP 経由で要確認）

---

*変更は一切行っていません。このファイルの作成のみです。*
