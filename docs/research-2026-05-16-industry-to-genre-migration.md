# 調査レポート: industry カラム廃止・ジャンル統一の影響範囲

**調査日**: 2026-05-16  
**前提思想**: `docs/decision-2026-05-16-genre-as-first-class.md`（確定済み）  
**ステータス**: 調査完了・実装設計待ち

---

## エグゼクティブサマリー

`ow_companies.industry` カラムは **コード全体で 80 箇所以上** が参照している。  
「置き換える」ではなく「共存フェーズを経て廃止」の戦略が現実的。  
本番企業（テストデータ除く）は実質 3 社で、データ移行コストは小さい。  
影響範囲は **求職者側 UI・企業側管理 UI・API・型定義・migration の全層** に及ぶ。

---

## 1. industry カラムの参照箇所一覧

### 1-A. DB クエリ（取得・送信）

| ファイルパス | 行番号 | 種類 | 内容 |
|------------|-------|------|------|
| `src/lib/supabase/queries.ts` | 58 | SELECT → 型変換 | `industry: (row.industry as string) ?? ""` |
| `src/lib/supabase/queries.ts` | 270 | 型定義 | `industry: string;`（クエリ結果行型） |
| `src/lib/supabase/queries.ts` | 285 | SELECT カラム | `"industry"` in COMPANY_LIST_COLS |
| `src/lib/supabase/queries.ts` | 332 | 型変換 | `industry: (row.industry as string) ?? ""` |
| `src/lib/supabase/queries.ts` | 350 | SELECT カラム | `"industry"` in COMPANY_DETAIL_COLS |
| `src/lib/business/company.ts` | 12 | 型定義 | `industry: string \| null;`（DbCompany 型） |
| `src/lib/business/company.ts` | 45 | SELECT カラム | `"industry"` |
| `src/lib/business/company.ts` | 79 | 型変換 | `industry: row.industry ?? ""` |
| `src/lib/business/company.ts` | 123 | DB 書き込み | `industry: form.industry \|\| null` |
| `src/lib/genres.ts` | 41 | SELECT カラム | `industry`（カルーセル取得時） |
| `src/app/api/admin/companies/[id]/route.ts` | 29 | SELECT 指定 | `'industry'` |
| `src/app/api/biz/companies/route.ts` | 42 | リクエスト型 | `industry?: string;` |
| `src/app/api/biz/companies/route.ts` | 101 | DB 書き込み | `industry: body.industry \|\| null` |
| `src/app/api/biz/companies/route.ts` | 108 | SELECT カラム | `"industry"` |
| `src/app/api/biz/companies/route.ts` | 171 | レスポンス | `industry: company.industry` |
| `src/app/api/companies/search/route.ts` | 32 | SELECT カラム | `"industry"` |
| `src/app/api/companies/search/route.ts` | 67 | レスポンス | `industry: c.industry ?? null` |
| `src/app/api/company/me/route.ts` | 80 | DB 書き込み | `industry: body.industry` |
| `src/app/api/company/register/route.ts` | 45 | DB 書き込み | `industry: body.industry \|\| null` |

### 1-B. 型定義（TypeScript）

| ファイルパス | 行番号 | 種類 | 内容 |
|------------|-------|------|------|
| `src/app/companies/mockCompanies.ts` | 8 | `Company` 型 | `industry: string;` |
| `src/app/companies/mockCompanies.ts` | 232 | フィルタ型 | `industry?: string;` |
| `src/lib/supabase/types.ts` | 1514, 1526, 1538 | 自動生成型 | `ow_companies` Row/Insert/Update の `industry` |
| `src/lib/business/company.ts` | 12 | `DbCompany` 型 | `industry: string \| null;` |
| `src/types/genre.ts` | 23 | カルーセル用型 | `industry: string \| null;` |
| `src/app/admin/companies/[id]/CompanyDetailClient.tsx` | 57 | フォーム型 | `industry: string;` |
| `src/app/biz/auth/page.tsx` | 12 | フォーム型 | `industry: string;` |
| `src/app/biz/companies/add/new/CreateCompanyClient.tsx` | 17 | フォーム型 | `industry: string \| null;` |
| `src/app/jobs/mockJobData.ts` | 1059 | フィルタ型 | `industry?: string;` |

### 1-C. UI 表示（求職者側）

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 138 | Hero: `{company.industry}` |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 2590 | COMPANY INFO: `{ key: "業界", value: company.industry }` |
| `src/app/companies/CompanySections.tsx` | 153 | カード: `{company.industry}` |
| `src/app/companies/list/CompanyListClient.tsx` | 167–168 | リスト表示: `{company.industry}` |
| `src/app/companies/CompanyExplorer.tsx` | 450–451 | 企業カード: `{company.industry}` |
| `src/app/admin/page.tsx` | 155 | 管理テーブル: `{c.industry \|\| "-"}` |
| `src/app/admin/companies/page.tsx` | 121 | 管理テーブル: `{c.industry \|\| "-"}` |

### 1-D. フィルタリング（クライアントサイド）

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `src/app/(jobseeker)/companies/CompaniesClient.tsx` | 253, 305–308 | 企業一覧フィルタ（URL param `?industry=`） |
| `src/app/(jobseeker)/jobs/JobsClient.tsx` | 397, 477–479 | 求人一覧フィルタ（company.industry でフィルタ） |
| `src/app/(jobseeker)/mentors/MentorFilterBar.tsx` | 111, 144–146 | メンター一覧フィルタ（mentor 経由で industry） |
| `src/app/companies/CompanyFilterBar.tsx` | 119, 178–181 | 旧企業一覧フィルタ（旧パス） |
| `src/app/companies/CompanyExplorer.tsx` | 706, 753 | 旧企業一覧フィルタ（タグボタン） |
| `src/app/companies/mockCompanies.ts` | 242 | mock フィルタ処理 |
| `src/app/jobs/mockJobData.ts` | 1083, 1085 | mock フィルタ処理 |

### 1-E. 入力フォーム（企業側）

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `src/app/biz/auth/page.tsx` | 525, 735 | 登録フロー: 業種ドロップダウン |
| `src/app/biz/company/CompanyEditClient.tsx` | 537 | 企業編集: 業種ドロップダウン |
| `src/app/biz/companies/add/new/CreateCompanyClient.tsx` | 77, 440, 505–507 | 新規企業作成ウィザード |
| `src/app/admin/companies/[id]/CompanyDetailClient.tsx` | 455–456 | 管理画面: 業種テキスト入力 |

### 1-F. migration・シードデータ

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `supabase/migrations/001_create_tables.sql` | 34 | `industry TEXT` カラム定義 |
| `src/app/companies/mockCompanies.ts` | 27〜203（12箇所） | mock 12社の industry 値 |
| `src/lib/business/mockCompany.ts` | 150–159 | INDUSTRY_OPTIONS（ドロップダウン選択肢） |

### 1-G. 検索テキスト（フルテキスト検索）

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `src/app/companies/CompanyExplorer.tsx` | 750 | 検索文字列に industry を結合 |
| `src/app/companies/list/CompanyListClient.tsx` | 274 | 検索文字列に industry を結合 |

### 1-H. その他

| ファイルパス | 行番号 | 内容 |
|------------|-------|------|
| `src/components/business/CompanyCard.tsx` | 9, 19, 61 | Props で受け取り・子コンポーネント転送 |
| `src/components/companies/CompanyCardCompact.tsx` | 34 | `company.industry` を依存配列に使用 |
| `src/lib/utils/companyStats.ts` | 112 | 統計表示: `{ value: c.industry, label: "業種" }` |
| `src/app/(jobseeker)/profile/edit/CareerModal.tsx` | 182 | キャリア編集モーダル: `{c.industry}` |

---

## 2. ジャンル選択 UI の追加箇所

| 箇所 | ファイルパス | 現状 | 変更内容 |
|------|------------|------|---------|
| **企業登録フロー（登録直後）** | `src/app/biz/auth/page.tsx` (735行) | `<FormSelect>` で業種ドロップダウン | ジャンルチップ選択 UI に置き換え |
| **企業編集（基本情報タブ）** | `src/app/biz/company/CompanyEditClient.tsx` (537行) | `<FormSelect value={form.industry}>` | ジャンルチップ選択 UI に置き換え |
| **新規企業作成ウィザード** | `src/app/biz/companies/add/new/CreateCompanyClient.tsx` (505行) | `<select value={industry}>` ドロップダウン | ジャンルチップ選択 UI に置き換え |
| **管理画面 企業編集** | `src/app/admin/companies/[id]/CompanyDetailClient.tsx` (455行) | テキスト input | ジャンルチップ選択 UI（管理画面はドロップダウンでも可） |

### ジャンルチップ選択 UI の仕様（参考実装）

```tsx
// 取得: Supabase から全ジャンル一覧
const genres = await supabase.from("ow_genres").select("id, name").eq("is_active", true).order("display_order");

// 状態: 選択ジャンル ID の配列
const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);

// UI: チップ複数選択
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  {genres.map(g => (
    <button
      key={g.id}
      onClick={() => toggle(g.id)}
      style={{
        padding: "6px 14px", borderRadius: 20, fontSize: 13,
        background: selectedGenreIds.includes(g.id) ? "var(--royal)" : "var(--bg-tint)",
        color: selectedGenreIds.includes(g.id) ? "#fff" : "var(--ink-soft)",
        border: `1px solid ${selectedGenreIds.includes(g.id) ? "var(--royal)" : "var(--line)"}`,
      }}
    >
      {g.name}
    </button>
  ))}
</div>

// 保存: ow_company_genres に upsert
```

---

## 3. データ移行の手順案と難易度

### 現在の industry 値分布（DB 実データ）

| industry 値 | 件数 | 内訳 |
|------------|------|------|
| SaaS | 8 | テスト企業 _001〜_008 |
| HRTech | 5 | テスト企業 _009〜_013 |
| FinTech | 5 | テスト企業 _014〜_018 |
| MA | 4 | テスト企業 _019〜_022 |
| IT | 4 | テスト企業 _023〜_026 |
| EdTech | 4 | テスト企業 _027〜_030 |
| IT / SaaS | 4 | テスト商事_001 + 本番 3 社 |

**合計 34 件、NULL・空文字ゼロ。**

⚠️ `"SaaS"` と `"IT / SaaS"` が同義で並存している（正規化されていない）。

### 本番企業（テストデータ除く）の状況

| 企業名 | industry | is_published | ow_company_genres |
|-------|---------|-------------|-----------------|
| 株式会社 Opinio | IT / SaaS | false | 未登録 |
| 株式会社 Third Box | IT / SaaS | false | 未登録 |
| 株式会社 Third Box（2） | IT / SaaS | **true** | 未登録 |

本番公開企業は 1 社のみ。ジャンル移行のデータ作業コストは**極めて小さい**。

### admin 手動マッピングの作業量

本番企業 3 社 × ジャンル選択（1〜3 ジャンル） = **SQL 数行で完了**。  
`is_human_approved = true` で登録すれば即日一覧に反映される。

### migration 手順案（industry カラム廃止）

**フェーズ1: 共存（破壊的変更なし）**
```sql
-- industry カラムは残したまま、ow_company_genres テーブルを活用開始
-- アプリ側で ow_company_genres を読み取る実装を追加
-- industry カラムへの書き込みも継続（フォールバック）
```

**フェーズ2: 書き込み停止（半廃止）**
```sql
-- industry カラムへの新規書き込みをアプリコードで停止
-- 読み取りは ow_company_genres を優先、フォールバックで industry
-- 既存データは変更しない
```

**フェーズ3: カラム廃止**
```sql
ALTER TABLE ow_companies DROP COLUMN industry;
```

- **ダウンタイム**: `DROP COLUMN` はテーブルロックを伴うが、34 行なので数ミリ秒
- **ロールバック**: フェーズ3 の前に既存値を CSV バックアップしておけばロールバック可能
- **副作用**: 自動生成型 `src/lib/supabase/types.ts` の再生成が必要（`supabase gen types`）

---

## 4. PR 切り方の複数案

### 案A: 段階リリース（推奨）

| PR | 内容 | 規模 | リスク |
|----|------|------|-------|
| PR-1 | `getCompanyById` に genres JOIN 追加 + `Company` 型に `genres` フィールド追加 | 小 | ほぼゼロ |
| PR-2 | 企業詳細ページ COMPANY INFO にジャンルチップ表示（UI のみ） | 小 | ほぼゼロ |
| PR-3 | 企業登録・編集フォームの industry ドロップダウン → ジャンルチップ UI 置き換え | 中 | 中（入力フォーム変更） |
| PR-4 | 求職者向けフィルタを industry → genre に切り替え（URL param 変更） | 中 | 中（URL 変更でブックマーク破壊） |
| PR-5 | industry カラム廃止 migration + 型からの削除 | 大 | 高（全箇所の参照削除が必要） |

- **メリット**: 各 PR が独立してレビュー可能。障害が出ても影響範囲が限定的。PR-1〜2 は即日可能。
- **デメリット**: PR-4 まで industry と genres が共存する中間状態が続く（コードが複雑になる）。
- **推定総作業量**: PR-1+2（半日）+ PR-3（半日）+ PR-4（1日）+ PR-5（1日）= **計 3 日**

---

### 案B: UI と API を一括、DB 廃止は後回し

| PR | 内容 | 規模 | リスク |
|----|------|------|-------|
| PR-1 | genres 取得クエリ + 型 + 企業詳細 UI + 編集フォーム UI を一括 | 大 | 中〜高 |
| PR-2 | フィルタ切り替え（industry → genre） | 中 | 中 |
| PR-3 | industry カラム廃止 | 大 | 高 |

- **メリット**: PR 数が少ない。業界とジャンルの共存期間が短い。
- **デメリット**: PR-1 のレビューが重い。部分的に失敗してもロールバックが全部に波及。
- **推定総作業量**: PR-1（1 日）+ PR-2（半日）+ PR-3（1 日）= **計 2.5 日**（レビューコストは高い）

---

### 案C: フィーチャーフラグで一括リリース後に切り替え

環境変数 `NEXT_PUBLIC_USE_GENRES=true` でジャンル表示を ON/OFF できる実装を先に作り、  
本番データが整ってから flag を ON にする。

- **メリット**: デプロイとリリースを分離できる。本番企業のデータ登録が終わってからUI公開可能。
- **デメリット**: フラグ分岐コードが増えてメンテコストが上がる。flag 削除 PR が別途必要。
- **推定総作業量**: PR-1（1.5 日）+ flag 削除 PR（0.5 日）= **計 2 日**（ただしコード複雑度が上がる）

---

### 推奨: 案A（段階リリース）

PR-1 + PR-2 を先行し、「ジャンルが表示されること」を最速でデプロイして確認する。  
フォームの変更（PR-3）と industry 廃止（PR-5）は別タイミングで進めることで、  
リスクを分散しつつ前進できる。

---

## 5. 想定外の影響範囲

### ⚠️ 求人一覧・メンター一覧フィルタへの影響（見落としリスク高）

`/jobs` ページの求人フィルタが `company.industry` を元に構築されている（`JobsClient.tsx` 411〜414行）。  
industry を廃止すると、**求人フィルタの「業界」セレクトボックスも動作しなくなる**。  
→ 求人フィルタを「ジャンル」ベースに変更するか、フィルタ自体を再設計する必要がある。

同様に `/mentors` の `MentorFilterBar.tsx` も `?industry=` パラメータを使っている。  
メンターは `ow_company_genres` を持たないため、「メンター × ジャンル」のフィルタ設計が別途必要。

### ⚠️ URL パラメータ変更によるブックマーク・共有 URL の破壊

現在の企業フィルタは `?industry=IT` 形式。  
ジャンル移行後は `?genre=horizontal-saas` 形式に変わるため、既存の共有 URL が壊れる。  
→ `next.config.mjs` に URL リライト/リダイレクトを追加するか、両パラメータを一時的にサポートする。

### ⚠️ 型自動生成ファイル `src/lib/supabase/types.ts` の扱い

`types.ts` は `supabase gen types` で自動生成される。  
`DROP COLUMN industry` 後は再生成で industry フィールドが消えるが、  
**アプリコードで `types.ts` の industry フィールドを直接参照している箇所がある場合、ビルドエラーが発生する**。  
→ PR-5（廃止）は型ファイル再生成 + 全参照修正を一度に行うため、ファイル変更数が最大になる。

### ⚠️ `src/lib/utils/companyStats.ts` の統計表示

112行目: `c.industry ? { value: c.industry, label: "業種" } : null`  
→ industry 廃止後、「業種」統計が表示されなくなる。ジャンル別統計への置き換えが必要。

### ⚠️ `CareerModal.tsx` でのキャリア経歴表示

`src/app/(jobseeker)/profile/edit/CareerModal.tsx` 182行目で `{c.industry}` を表示している。  
これは「職歴の会社の業界」を表示するもので、`ow_companies.industry` からの値。  
industry 廃止後は「会社のジャンル」に切り替える設計変更が必要。

### 💡 admin 画面は「業界」列を「ジャンル」列に変更するだけでよい

`src/app/admin/page.tsx` および `src/app/admin/companies/page.tsx` の管理テーブルは、  
単に industry を表示しているだけ。ジャンル名の配列表示に切り替えるのは容易。

### 💡 `CompanyCardCompact.tsx` での industry 利用は表示ではなく依存配列

34行目の `company.industry` は `useMemo` や `useCallback` の依存配列に含まれているだけで、  
直接 UI に表示はしていない。industry 削除後は依存配列から除去すればよい。

---

## 6. 推奨進行プラン

| フェーズ | 作業 | タイミング | PR |
|---------|------|----------|-----|
| **即着手** | 本番 3 社への `ow_company_genres` 登録（SQL 数行） | 今すぐ | データのみ（PR不要） |
| **即着手** | `getCompanyById` に genres JOIN 追加 + 企業詳細 UI にジャンルチップ表示 | 今すぐ | PR-1 + PR-2 |
| **次のステップ** | 企業編集・登録フォームの industry → ジャンルチップ置き換え | 確認後 | PR-3 |
| **慎重に検討** | 求職者フィルタの industry → genre 切り替え（URL 変更を伴う） | PR-3 完了後 | PR-4 |
| **最後** | `industry` カラム廃止 migration + 型定義からの削除 | 全面移行完了後 | PR-5 |

### 思想判断が必要な論点（Hisato さん確認事項）

1. **industry の「完全廃止」時期**: PR-5 は本番リスクが最も高い。テストデータ 210 件削除と同タイミングで進めるか

---

## 7. 思想決定文書を参照した上での追記・修正

**参照文書**: `docs/decision-2026-05-16-genre-as-first-class.md`（2026-05-16 確定）

### 7-1. スコープ修正: PR-4（フィルタ切り替え）は今回対象外

調査レポート案A の PR-4「求職者向けフィルタを industry → genre に切り替え」は、
思想決定文書のスコープ外 になっている。

> **今回は外す（別 PR/別プロジェクト）**
> - `/companies?genre=xxx` フィルタリング機能（L2/L3 と一緒に別プロジェクト）

→ **PR-4 は今回の実装対象から除外**。調査セクション 1-D（フィルタリング）に記載した
`CompaniesClient.tsx`・`JobsClient.tsx`・`MentorFilterBar.tsx` の
industry フィルタ参照箇所は、当面そのままにしてよい。  
industry カラムが存在する間はフィルタも動作し続ける。

**修正後の PR 計画:**

| PR | 内容 | 規模 | リスク | スコープ |
|----|------|------|-------|---------|
| PR-1 | `getCompanyById` に genres JOIN + `Company` 型に `genres` フィールド | 小 | ほぼゼロ | ✅ 今回 |
| PR-2 | 企業詳細 COMPANY INFO 最上部にジャンルチップ + Hero の industry 置き換え | 小 | ほぼゼロ | ✅ 今回 |
| PR-3 | 企業登録・編集フォームの industry → ジャンルチップ UI 置き換え | 中 | 中 | ✅ 今回 |
| PR-4 | 求職者フィルタ industry → genre 切り替え | 中 | 中 | ❌ **別プロジェクト（L2/L3）** |
| PR-5 | industry カラム廃止 migration + 型削除 | 大 | 高 | ✅ 今回（PR-3 完了後） |

`/jobs/[id]` のジャンル表示も「別 PR」と明記されているため、
セクション 1-C に記載した `JobsClient.tsx` の industry 参照は今回触らない。

---

### 7-2. 表示設計の確定値を UI 実装箇所に反映

思想決定文書で表示仕様が確定している:

| 項目 | 確定値 |
|------|--------|
| 表示位置 | COMPANY INFO **最上部** |
| COMPANY INFO の並び順 | ジャンル → 事業ステージ → 従業員数 → 所在地 → 最寄り駅 |
| 未登録企業の扱い | **行ごと非表示**（「未設定」表示禁止） |
| 複数所属時 | **横並びチップ** |

**実装への影響:**

- セクション 1-C に記載した `page.tsx` 2590行目の現状:
  ```typescript
  { key: "業界", value: company.industry }
  ```
  → ジャンルに置き換え、COMPANY INFO の**先頭**に移動する。
  ジャンルが空配列の場合は行ごと非表示（`industry` の `|| "—"` フォールバックは使わない）。

- **Hero 部分（138行目）の `{company.industry}` の扱い**:
  思想決定文書のスコープは「COMPANY INFO 改修」のみ言及しており、
  Hero 部分は明示されていない。  
  ただし「一覧カードの業界表示置き換え」はスコープ内とされているため、
  Hero の industry 表示も **PR-2 で合わせてジャンルチップに統一する**ことを推奨する。
  （Hisato さんの確認が必要な論点）

---

### 7-3. 本番企業ジャンル登録はコードスコープ外（業務タスク）

> **今回は外す（別 PR/別プロジェクト）**
> - 本番企業のジャンル登録（業務タスク、admin 手動マッピングで別途）

セクション 6「即着手: 本番 3 社への ow_company_genres 登録（SQL 数行）」は
**コードの PR ではなく、Hisato さんまたは柴さんの業務作業**として切り離す。

実装（PR-1〜PR-3）と並行して、または実装完了後に、管理者が SQL で登録する。

---

### 7-4. チップ UI の詳細仕様確認

思想決定文書で確定している入力仕様:

| 項目 | 確定値 |
|------|--------|
| 必須/任意 | **任意**（未選択でも企業作成・編集可能） |
| 選択方式 | **複数選択可** |
| UI 形式 | **チップ群**（8ジャンル全部表示、タップで選択/解除） |
| 上限 | なし |

セクション 2 の「ジャンルチップ選択 UI の仕様（参考実装）」はこの確定値と整合している。  
ただし `ow_genres` テーブルから動的取得する実装を取るため、8 件のハードコードは不要。

---

### 7-5. 残る未解決論点（思想決定文書で言及なし）

| 論点 | 内容 | 推奨判断 |
|------|------|---------|
| **Hero 部分の industry 置き換え** | 138行目 `{company.industry}` をジャンルチップに変えるかどうか | PR-2 で合わせて変更を推奨 |
| **industry 廃止時期** | テストデータ 210 件削除と同タイミングか、独立して進めるか | 独立して進める（PR-5）を推奨 |
| **`CareerModal.tsx` の industry 表示** | 職歴経歴モーダルで会社の industry を表示している（182行目） | PR-5（カラム廃止）前に対応必須 |
