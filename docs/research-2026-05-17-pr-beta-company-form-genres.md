# 事前調査レポート: PR-β 企業作成/編集フォームのジャンル化

**調査日**: 2026-05-17  
**対応依頼**: `docs/research-request-pr-beta.md`  
**PR-α コミット**: `141a2bd`（企業詳細にジャンル表示、本番反映済み）

---

## 1. 既存 autosave 実装の実態

### 現状

| 項目 | 実態 |
|------|------|
| 定義箇所 | `src/app/biz/company/CompanyEditClient.tsx` — `useEffect` フック（L285–312） |
| デバウンス | **700ms** |
| トリガー条件 | `hasInteracted.current === true` のときのみ発火 |
| API ルート | `PUT /api/biz/company` |
| ペイロード | `JSON.stringify(form)` — `BizCompany` 型オブジェクト丸ごと |
| draft_data 書き込み箇所 | `src/app/api/biz/company/route.ts` L30–38 |

```typescript
// CompanyEditClient.tsx L284-295 — autosave の核心部
useEffect(() => {
  if (!hasInteracted.current) return;
  setSaveState("saving");
  const timer = setTimeout(async () => {
    const res = await fetch("/api/biz/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),  // BizCompany 丸ごと送信
    });
    // ...
  }, 700);
  return () => clearTimeout(timer);
}, [form]);
```

```typescript
// api/biz/company/route.ts L30-38 — PUT handler
const record = transformFormToDb(body);   // BizCompany → DB カラム形式
await supabase
  .from("ow_companies")
  .update({ draft_data: record })
  .eq("id", companyId);
```

**`hasInteracted` パターンの詳細:**
- `const hasInteracted = useRef(false)` — React 18 Strict Mode 二重 mount 対策
- `update("field", value)` ヘルパー関数内で `hasInteracted.current = true` にセット（L343, L352）
- 公開処理（PATCH）後に `hasInteracted.current = false` にリセット（L375）— 公開後の即再 draft を防止

**autosave 対象フィールド:**  
`BizCompany` 型に含まれる全フィールド（= form state 全体）が対象。現在の主要フィールド:
`name, tagline, description, industry, phase, employeeCount, location, url, remoteStatus, flexTime, sideJobOk, acceptingCasualMeetings, fitPositives, fitNegatives, whyJoin, mission, logoUrl, logoGradient, logoLetter, photoIds, hasDraftChanges`

### PR-β での変更点

- `BizCompany` 型に `genres: string[]`（slug 配列）を追加する
- autosave の仕組み自体は変更不要 — form state が変われば自動的に PUT される
- `transformFormToDb()` が `genres` を `draft_data` に含めるよう拡張が必要

### 実装の難所

1. **`transformFormToDb()` は draft_data に何を書くか** — `genres` フィールドをどのキー名で `draft_data` に保存するか統一する必要がある（`genres: string[]` を slug 配列のまま入れる想定）
2. **PATCH（公開）時の ow_company_genres 反映** — 現在の PATCH ハンドラーは `draft_data` を本番カラムに spread するだけ。`genres` は JSONB カラムではなく関係テーブル（`ow_company_genres`）なので、spread では対応できない。PATCH handler への追記が必須。

---

## 2. draft_data のスキーマと運用

### 現状

**`ow_companies.draft_data` カラム:**
- 型: `JSONB`（nullable）
- 通常時: `null`（公開済み企業で未編集の場合）
- 編集中: `transformFormToDb(form)` の出力が丸ごと格納される

**`transformFormToDb()` が現在書き込む主要キー:**（`src/lib/business/company.ts` L114–160）
```
name, tagline, mission, description,
industry, phase, business_stage, url,
employee_count, location,
remote_work_status, flex_time, side_job_ok, accepting_casual_meetings,
fit_positives, fit_negatives, why_join,
logo_url, logo_gradient, logo_letter
```
**`genres` キーは存在しない**（現時点でのスキーマ外フィールド）。

**「変更を公開する」処理の実装場所:**

`src/app/api/biz/company/route.ts` — `PATCH` handler（L59–101）

```typescript
// PATCH handler の核心 — draft_data → 本番カラムへ展開
const updated = {
  ...(currentRow?.draft_data ?? {}),   // draft_data の全キーを spread
  is_published: true,
  published_at: now,
  updated_at: now,
  draft_data: null,                     // 公開後に draft_data をクリア
};
await supabase.from("ow_companies").update(updated).eq("id", companyId);
```

**spread 方式の問題点:** `draft_data` の中に `genres: string[]` を入れても、spread によって `ow_companies.genres` という存在しないカラムへの書き込みになる。**`ow_company_genres` テーブルへの INSERT/DELETE は別途手動で処理する必要がある。**

### PR-β での変更点

1. `transformFormToDb()` に `genres: form.genres` を追加（`draft_data` への記録用）
2. PATCH handler に `ow_company_genres` の INSERT/DELETE ロジックを追加
3. `transformDbToForm()` に `genres` フィールドの逆変換を追加（編集再開時にチップ選択状態を復元）

```
公開時の処理フロー（拡張後）:
1. draft_data から { genres: string[] } を取り出す
2. 現在の ow_company_genres（is_human_approved=true）を SELECT
3. toAdd = genres.filter(slug not in current) → INSERT
4. toRemove = current.filter(slug not in genres) → DELETE
5. ow_companies を update（spread + draft_data = null）
```

### 実装の難所

1. **`transformDbToForm()` での genres 復元** — 公開済み企業の編集再開時、`draft_data` に `genres` があればそこから、なければ `ow_company_genres` テーブルから取得して初期値にする必要がある（2経路）
2. **PATCH の原子性** — `ow_companies` update と `ow_company_genres` の INSERT/DELETE は別クエリになる。部分成功のリスクがあるため、エラー時の rollback 戦略が必要（best-effort 容認 or try/catch で順序を工夫）
3. **slug vs id** — `draft_data.genres` に slug を入れるか `genre_id`（UUID）を入れるか。`ow_company_genres` は `genre_id` を使うため、PATCH 時に `ow_genres` テーブルから slug→UUID 変換が必要

---

## 3. 4 ファイルの影響範囲

### A. `src/app/biz/auth/page.tsx`

**現状:**

多段フォームで企業情報入力は **ステップ 1（企業登録ステップ）** で発生:
1. サインアップフォームに `companyName / industry / employeeCount` を入力
2. 「次へ（ログインへ）」クリック時に `PendingCompany` として sessionStorage へ退避
3. ログイン完了後、`handleAfterAuth()` 内で `/api/biz/companies` or `/api/company/register` に POST

```typescript
type PendingCompany = {
  name: string;
  industry: string;
  employeeCount: string;
};
const PENDING_COMPANY_KEY = "opinio_biz_pending_company";
```

**POST `/api/company/register` のペイロード（L628–635）:**
```typescript
{
  name: stored.name,
  industry: stored.industry || null,
  employeeCount: stored.employeeCount,
  // ... auth 情報
}
```

企業作成後に `ow_company_genres` を INSERT するロジックは**存在しない**。

**PR-β での変更点:**

| 対象 | 変更内容 |
|------|---------|
| `PendingCompany` 型 | `genres: string[]` を追加（slug 配列） |
| sessionStorage 格納 | `{ name, industry, employeeCount, genres }` |
| サインアップフォーム UI | industry 入力フィールドの下にジャンルチップ群を追加 |
| `handleAfterAuth()` | 企業作成成功後に `genres` を `/api/biz/companies/[id]/genres` へ POST |

**実装の難所:**

1. **多段フォームの状態管理** — `PendingCompany` は sessionStorage に JSON シリアライズされる。配列型（`genres: string[]`）は JSON で問題なく扱えるが、既存の sessionStorage データとの互換性（旧フォーマットに `genres` がない場合のフォールバック）が必要
2. **企業作成 API との連携** — `/api/company/register` と `/api/biz/companies` の 2 本の企業作成ルートがある。両方に genres 後処理を追加するか、共通ヘルパーを作るか
3. **ジャンル一覧取得** — このページは `"use client"` コンポーネントのため、マウント時に `fetch("/api/genres")` か supabase client で取得する必要がある（Server Component 親からの props 渡しが使えない構造）

**ジャンル選択を入れるステップ**: **ステップ 1（サインアップフォームの企業情報入力欄）**。industry の下に配置するのが自然。

---

### B. `src/app/biz/company/CompanyEditClient.tsx`

**現状:**

- 完全な `"use client"` コンポーネント（~600行）
- `form` state は `useState<BizCompany>(initialCompany)` で管理（React Hook Form ではなく useState）
- `industry` フィールド: `FormSelect` コンポーネントで L537 付近

```tsx
<FormSelect
  value={form.industry}
  onChange={(v) => update("industry", v)}
  options={INDUSTRY_OPTIONS}
/>
```

- `form` 変化 → autosave（700ms）の構造なので、**チップのトグルも `update("genres", newSlugArray)` と同じパターンで autosave に乗せられる**

**PR-β での変更点:**

| 対象 | 変更内容 |
|------|---------|
| `Props` | `availableGenres: { id: string; slug: string; name: string }[]` を追加 |
| `form` state の初期値 | `genres: initialCompany.genres ?? []` |
| UI（basic セクション） | industry フォームの直下にジャンルチップ群を追加 |
| update 呼び出し | チップトグル時に `update("genres", newSlugs)` |

**ジャンルチップ群の挿入位置候補:**

```
[基本情報セクション]
  企業名
  キャッチコピー
  業界 (industry) ← 現在の FormSelect
  ↓ここに挿入
  ジャンル [外資系] [ホリゾンタルSaaS] ...（チップ群）
  事業フェーズ
  従業員数
  ...
```

**"use client" 制約 — ジャンル一覧取得の経路:**

親 Server Component である `src/app/biz/company/page.tsx` でジャンル一覧を取得し、props で渡す方式が最もクリーン。

```typescript
// src/app/biz/company/page.tsx（Server Component）に追加
const { data: genres } = await supabase
  .from("ow_genres")
  .select("id, slug, name, display_order")
  .order("display_order");

return <CompanyEditClient ... availableGenres={genres ?? []} />;
```

コスト: 1クエリ追加（8行固定データなのでパフォーマンス影響ゼロ）。

**実装の難所:**

1. **初期値の 2 経路問題** — 編集再開時の genres 初期値は:
   - `draft_data.genres` があればそこから（編集途中）
   - なければ `ow_company_genres`（is_human_approved=true）から取得した slug 配列
   
   この判定は `transformDbToForm()` の拡張で吸収するか、`page.tsx` で並列クエリして渡すか
2. **autosave で genres を扱う場合の debounce UX** — チップをトグルするたびに 700ms 後に PUT が走る。チップ連打時（複数ジャンルを素早くトグル）も問題なく動作するが、ユーザーには autosave 完了の feedback が必要

---

### C. `src/app/biz/companies/add/new/CreateCompanyClient.tsx`

**現状:**

「企業を追加」動線（認証済みユーザーが既存企業ポータルから追加企業を作る）:
- `industry` select: L505–507
- POST `/api/biz/companies` に `{ name, industry, website, force_create }` を送信
- `ow_company_genres` の INSERT は**現在なし**
- **autosave なし**（一発 POST のみ）

`biz/auth/page.tsx` との違い:
| 項目 | `biz/auth/page.tsx` | `CreateCompanyClient.tsx` |
|------|---------------------|--------------------------|
| 認証状態 | 未認証→認証フロー中 | 認証済み |
| API ルート | `/api/company/register` or `/api/biz/companies` | `/api/biz/companies` のみ |
| sessionStorage | 使用（`PendingCompany`） | 不使用 |
| autosave | なし（一発 POST） | なし（一発 POST） |
| 重複チェック | あり（force_create オプション） | あり（force_create オプション） |

**PR-β での変更点:**

| 対象 | 変更内容 |
|------|---------|
| 内部 state | `genres: string[]` を追加 |
| UI | industry select の下にジャンルチップ群を追加 |
| POST ペイロード | `body: { name, industry, website, force_create, genres }` は不要 |
| POST 後処理 | 企業作成成功後に取得した `companyId` で `ow_company_genres` INSERT |

**ジャンル一覧取得の経路:**  
`CreateCompanyClient.tsx` 自体は `"use client"` コンポーネント。親の `src/app/biz/companies/add/new/page.tsx` で genres を取得して props で渡す方式が適切。

**実装の難所:**

1. **POST 後の genres INSERT タイミング** — `/api/biz/companies` の POST が成功して companyId を受け取った後、別途 genres を INSERT するが、失敗時の UX（「企業は作成されたがジャンルは登録されなかった」）をどう扱うか
2. **`force_create` フローとの兼ね合い** — 同名企業が既存の場合に `force_create: true` で再 POST する二段階確認がある。genres state はその間も保持されているので問題はないが、フローの複雑さに注意

---

### D. `src/app/admin/companies/[id]/CompanyDetailClient.tsx`

**現状:**

運営管理画面では**ジャンル編集 UI がすでに実装されている**（PR-β の参照実装として使える）。

```typescript
// CompanyDetailClient.tsx L263–316 — 既存のジャンルトグル実装
function toggleGenre(genreId: string) {
  setSelectedGenreIds((prev) => {
    const next = new Set(prev);
    next.has(genreId) ? next.delete(genreId) : next.add(genreId);
    return next;
  });
}

// 「保存する」ボタン押下時（明示的保存、autosave ではない）
async function handleSaveGenres() {
  const currentIds = companyGenres.filter(cg => cg.is_human_approved).map(cg => cg.genre_id);
  const newIds = Array.from(selectedGenreIds);
  const toAdd = newIds.filter(id => !currentIds.includes(id));
  const toRemove = currentIds.filter(id => !newIds.includes(id));

  // POST /api/admin/companies/[id]/genres { genre_ids: toAdd }
  // DELETE /api/admin/companies/[id]/genres { genre_ids: toRemove }
}
```

**データ取得経路（`src/app/admin/companies/[id]/page.tsx`）:**

```typescript
// Server Component で並列取得
const { data: genres } = await supabase
  .from('ow_genres')
  .select('id, name, slug, display_order');

const { data: companyGenres } = await supabase
  .from('ow_company_genres')
  .select('genre_id, is_human_approved, is_ai_suggested')
  .eq('company_id', params.id);
```

**PR-β での変更点:**

Admin 画面は**現状のままで良い**。autosave への統合は不要（admin は明示的保存で問題ない）。

ただし、admin 画面では `is_human_approved` のトグルや `is_ai_suggested` の確認など、biz 側より細粒度の操作が必要なため、UI の共通化は慎重に検討すること。

**実装の難所:**

特になし（既に動作している）。PR-β では admin 画面の既存 API エンドポイント（`/api/admin/companies/[id]/genres`）を biz 側でも再利用するか、biz 専用エンドポイントを新設するかの判断が必要。

> **推奨**: biz 側専用で `/api/biz/company/genres` を作る（admin API との権限分離、RLS の観点で安全）

---

## 4. 共通コンポーネント候補

### 現状

`src/components/ui/` の現在の内容:
```
ConfirmDialog.tsx
ImageUpload.tsx
InitialAvatar.tsx
Toast.tsx
```

**Chip / Badge / Toggle 系コンポーネントは存在しない。**

### PR-β での変更点

`GenreChipSelector` コンポーネントを新規作成する価値は**高い**（3〜4 箇所で使い回せるため）。

**使い回しの対象:**

| ファイル | 用途 |
|---------|------|
| `CompanyEditClient.tsx` | 企業編集フォーム（autosave 連動） |
| `CreateCompanyClient.tsx` | 企業新規作成フォーム |
| `biz/auth/page.tsx` | 登録フロー内の企業情報入力 |
| ~~`admin/CompanyDetailClient.tsx`~~ | 既存 UI あり、共通化は任意 |

**推奨実装:**

```typescript
// src/components/ui/GenreChipSelector.tsx
type Genre = { id: string; slug: string; name: string };

type Props = {
  genres: Genre[];           // 全ジャンル一覧（display_order 順）
  selected: string[];        // 選択中の slug 配列
  onChange: (slugs: string[]) => void;
};

export function GenreChipSelector({ genres, selected, onChange }: Props) {
  function toggle(slug: string) {
    const next = selected.includes(slug)
      ? selected.filter(s => s !== slug)
      : [...selected, slug];
    onChange(next);
  }
  
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {genres.map(g => {
        const active = selected.includes(g.slug);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.slug)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              background: active ? "var(--royal-50)" : "var(--bg-tint)",
              color: active ? "var(--royal)" : "var(--ink-soft)",
              border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
```

**スタイル設計方針:**
- 非選択: `var(--bg-tint)` 背景 / `var(--line)` ボーダー（PR-α の表示チップと同系統）
- 選択済み: `var(--royal-50)` 背景 / `var(--royal)` ボーダー・テキスト（既存 royal blue 統一）
- `type="button"` 必須（form submit の誤発火防止）

### 実装の難所

- **slug vs id の揺れ** — admin 側は `genre_id`（UUID）で管理、biz 側方針は slug 配列。コンポーネントは `slug` ベースで統一し、API 送信時に slug→UUID 変換するか、最初から UUID で揃えるか決定が必要

---

## 5. 動作確認用テスト企業

### 確認済みのテスト企業

| 企業名 | UUID（前8桁） | is_published | draft_data |
|-------|-------------|-------------|-----------|
| テスト株式会社_001 | `fde82347` | ✅ true | null |
| テスト株式会社_002 | `19d43f7b` | ✅ true | null |
| テスト株式会社_003 | `e48685f4` | ✅ true | null |
| テスト株式会社_004 | `7f1f538d` | ✅ true | null |
| テスト株式会社_005 | `910f62ac` | ✅ true | null |

すべて `draft_data = null`（編集前のクリーン状態）。

### PR-β 動作確認シナリオ

| シナリオ | 確認内容 | 推奨テスト企業 |
|---------|---------|------------|
| ジャンル選択 → autosave 確認 | Supabase で draft_data.genres が書き込まれているか | テスト_001 |
| 「変更を公開する」 | ow_company_genres に INSERT されているか | テスト_002 |
| 編集再開（draft あり） | チップ選択状態が draft_data から復元されるか | テスト_003 |
| 全ジャンル解除 → 公開 | ow_company_genres のレコードが DELETE されるか | テスト_004 |
| draft_data なし企業（新規公開済み） | ow_company_genres から初期値を取得できるか | テスト_005 |

**企業作成フロー（`CreateCompanyClient`）確認:**
- `/biz/companies/add/new` からジャンル選択 → 企業作成後に `ow_company_genres` INSERT されるか
- `force_create` フロー（同名企業確認ダイアログ後）でもジャンルが引き継がれるか

**auth フロー（`biz/auth/page.tsx`）確認:**
- サインアップフォームでジャンル選択 → sessionStorage に `genres` が入るか
- ログイン後の企業作成完了時に `ow_company_genres` INSERT されるか

---

## Hisato さん + Claude への質問

### Q1. slug vs UUID の統一方針

`draft_data.genres` に何を格納するか:

- **案 A: slug 配列** `["foreign-capital", "ai-llm"]`
  - メリット: 可読性が高い、`ow_genres` テーブルの slug 列を参照しやすい
  - デメリット: PATCH 時に slug→UUID 変換クエリが必要（`ow_genres` を SELECT して変換）
- **案 B: UUID 配列** `["abc-123", "def-456"]`
  - メリット: `ow_company_genres.genre_id` と直接マッチ（変換不要）
  - デメリット: draft_data の中身が不透明

**推奨**: 案 A（slug 配列）を `draft_data` に入れ、PATCH 時に一括変換。`ow_genres` は 8 行固定なのでパフォーマンス影響なし。

→ **Hisato さんの確認**: どちらが好みですか？

### Q2. biz/auth/page.tsx のジャンル選択は必須か任意か

登録フローでジャンル選択を省略可能にするか（「後で設定できます」として空で進む）、それともジャンル選択ステップを必須にするか。

**確定済みの方針**: 選択は任意・上限なし（`research-request-pr-beta.md` より）  
→ UI での表示として「任意」ラベルをつけるか、デフォルト説明文を入れるか確認。

### Q3. autosave vs 明示的保存

`CompanyEditClient.tsx` のジャンル変更を autosave に乗せるか:

- **autosave 乗せる案（方針A）**: チップトグル → 700ms 後に PUT → draft_data に genres 記録
  - メリット: 既存 autosave と一貫、追加実装が少ない
  - デメリット: チップを連打すると 700ms ごとに PUT が走る
- **明示的保存案**: 「変更を公開する」時のみ genres を ow_company_genres に同期
  - メリット: API コール数が減る
  - デメリット: draft_data に genres が入らないため「下書き保存」の概念と整合しない

**PR-β 方針文書では「autosave に乗せる（方式A）」を確定済み** — このまま進めてよいか最終確認。

### Q4. ow_genres の `slug` カラムの存在確認

現在の調査では `ow_genres` テーブルのカラムは `id, name, display_order` を確認済みだが、**`slug` カラムの存在が未確認**。

`research-request-pr-beta.md` に記載の slug 一覧（`foreign-capital`, `ai-llm` 等）は、テーブル上に `slug` カラムとして存在するか、それとも `name` から導出されるものか。

→ **事前に Supabase で確認が必要**: `SELECT column_name FROM information_schema.columns WHERE table_name = 'ow_genres'`

もし `slug` カラムがない場合、`draft_data.genres` には `id`（UUID）か `name`（日本語文字列）を使うことになる。

---

## 実装順序（推奨）

1. **`GenreChipSelector` コンポーネント作成**（共通 UI、依存なし）
2. **`BizCompany` 型に `genres: string[]` 追加 + `transformFormToDb` 拡張**
3. **`CompanyEditClient.tsx` にジャンルチップ追加**（autosave 乗せ、最も影響範囲が明確）
4. **PATCH handler 拡張**（公開時に `ow_company_genres` 同期）
5. **`CreateCompanyClient.tsx` にジャンルチップ追加**（企業作成後 INSERT）
6. **`biz/auth/page.tsx` にジャンルチップ追加**（PendingCompany 拡張、最も複雑）
