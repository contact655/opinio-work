# 求人一覧 2ペイン化 調査レポート

> 作成日: 2026-07-09  
> 対象: `/jobs` 求人一覧ページ（LinkedIn 左ペイン型縦リスト + 将来2ペイン化）

---

## 0. 推奨構成（結論先出し）

### Phase 1 推奨ファイル構成

```
src/app/(jobseeker)/jobs/
  page.tsx            ← 変更なし（RSC, getJobs() 呼び出し）
  JobsClient.tsx      ← メインリファクタ対象
    - JobListItem     ← 新設（現 JobListCard を薄い1行コンポーネントに置換）
    - JobsList        ← 新設（selectedJobId state + リスト描画）
    - SidebarFilters  ← 変更なし
    - JobsClient      ← レイアウト器を2カラムの器に変更
  loading.tsx         ← skeleton 更新
```

### Phase 2 追加ファイル

```
  JobDetailPane.tsx   ← 新設（lg: のみ右カラムに表示）
```

**Phase 1 の `.jobs-layout` 変更イメージ:**

```css
/* Phase 1: 左=フィルターサイドバー / 右=求人縦リスト（右ペイン未使用） */
@media (min-width: 1024px) {
  .jobs-layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .jobs-sidebar { display: block; }   /* 現在 display:none を解除 */
}

/* Phase 2: 左=サイドバー+リスト / 右=詳細ペイン */
@media (min-width: 1024px) {
  .jobs-layout {
    grid-template-columns: 220px minmax(0, 420px) minmax(0, 1fr);
  }
}
```

`selectedJobId` を `?job=UUID` URL パラメータで保持することで、PC/モバイル共通URLが成立する。

---

## 1. 現状把握

### 1-1. ファイルパスと役割

| ファイル | 行数 | 役割 |
|---------|------|------|
| `src/app/(jobseeker)/jobs/page.tsx` | 52 | RSC。`getJobs()` + `getParentRoles()` + `getJobAlumniMap()` を並列フェッチして `<JobsClient>` に渡す |
| `src/app/(jobseeker)/jobs/JobsClient.tsx` | 2119 | "use client"。フィルター・リスト・プレビューパネルを全て含む巨大ファイル |
| `src/app/(jobseeker)/jobs/loading.tsx` | — | skeleton UI |
| `src/app/(jobseeker)/jobs/[id]/page.tsx` | — | 求人詳細ページ（独立）。Phase 2で右ペインに埋め込む候補 |

### 1-2. 求人データ取得の仕組み

- **取得場所**: `page.tsx`（RSC）で `getJobs()` を呼ぶ。クライアントフェッチは行わない。
- **対象テーブル**: `ow_jobs` JOIN `ow_companies`（queries.ts 内 `getJobs()`）
- **SELECT カラム**: `id, company_id, title, job_category, role_category_id, employment_type, location, work_style, salary_min, salary_max, catch_copy, one_liner, published_at, updated_at, remote_work_status, urgency`
- **絞り込み**: DBレベルでは `status IN ('published','active')` のみ。残りはクライアント側 `useMemo` でフィルタリング（`q`, `category`, `work_style`, `salary`, `industry`, `prefecture`, `emp_type`, `meetingOnly`）
- **並び順**: `sort` URL パラメータ（`updated` / `salary` / `stage`）もクライアント側 `useMemo` で処理
- **キャッシュ**: `unstable_cache` でラップ済み（`page.tsx` の `revalidate = 60` と合わせて最大5分のISR）

### 1-3. 行に表示している/できるフィールド（DBカラム名対応）

| UI表示 | DBカラム | 型 | 備考 |
|-------|---------|-----|------|
| 求人タイトル | `ow_jobs.title` → `Job.role` | text | 現在表示中 |
| キャッチコピー | `catch_copy \|\| one_liner` → `Job.highlight` | text | 2行クランプ |
| 年収レンジ | `salary_min`, `salary_max` | int | 万円単位、`formatSalary()` で整形 |
| 勤務地 | `location` | text | 区切り "・" の1件目のみ使用 |
| 勤務形態 | `work_style \|\| remote_work_status` | text | `WORK_STYLE_LABELS` で日本語化 |
| 職種タグ | `job_category` → `Job.dept` | text | `getDeptStyle()` で色分け |
| 雇用形態 | `employment_type` | text | 正社員以外のみバッジ表示 |
| 会社名 | `ow_companies.name` / `brand_name` | text | 現在表示中 |
| 企業フェーズ | `ow_companies.phase` / `funding_stage` | text | `getPhaseBadge()` で色分け |
| 面談受付 | `ow_companies.accepting_casual_meetings` | bool | 現在オレンジ枠で強調 |
| 更新日 | `updated_at` → `updated_days_ago` | int | "N日前" / "今日" |
| NEW バッジ | `published_at` | timestamp | 7日以内判定 |
| 先輩strip | `alumniMap[job.id]` | 別クエリ | ロールマッチ結果 |

### 1-4. 流用できる既存 src/components/ の棚卸し

**`src/components/ui/` ディレクトリ:**
```
ConfirmDialog.tsx       ← 削除確認等に使用
GenreChipSelector.tsx   ← ジャンルチップ選択
GlobalToast.tsx         ← トースト通知（気になる追加時に使用中）
ImageUpload.tsx
InitialAvatar.tsx
Toast.tsx
FavoriteButton.tsx      ← ♡ ブックマークボタン（流用候補）
Footer.tsx
Header.tsx
SocialIcon.tsx
```

**`src/components/common/` ディレクトリ:**
```
StatusPill.tsx          ← 全ステータスバッジ一元管理（published/draft/hired 等21種）
CompanyLogo.tsx         ← 企業ロゴ（logo_url → logo_letter + gradient フォールバック）
Avatar.tsx              ← ユーザーアバター
index.ts                ← export hub
```

**Phase 1 で流用すべきもの:**
- `CompanyLogo` — 行左端の企業ロゴとして、現在と同じ使い方
- `StatusPill` — 面談受付中など行レベルのステータス表示に代替可能
- `FavoriteButton` — `JobListCard` 内のブックマーク処理を切り出す際の候補（現状はインラインで実装）
- `GlobalToast` + `showToast()` — 気になるトースト通知（変更なし）

---

## 2. 状態管理・ルーティング設計の現状と選択肢

### 2-1. 現在のURL パラメータ管理

`JobsClient.tsx` の `useSearchParams()` で読み、`router.replace()` で書く。

| パラメータ | 例 | 用途 |
|-----------|-----|------|
| `category` | `?category=UUID` | 職種（親ロールID） |
| `work_style` | `?work_style=remote` | 勤務形態 |
| `salary` | `?salary=800` | 年収下限（万円） |
| `industry` | `?industry=saas` | 業界 |
| `prefecture` | `?prefecture=東京都` | 都道府県 |
| `emp_type` | `?emp_type=contract` | 雇用形態 |
| `sort` | `?sort=salary` | 並び順 |
| `show` | `?show=30` | 表示件数（もっと見る） |

`q`（キーワード）と `meetingOnly`（面談受付中）はローカルstate のみで管理（URL非保持）。

### 2-2. `?job=UUID` の追加可否

**結論: 問題なし。既存パラメータとの共存は容易。**

```typescript
// setParam() は既存パラメータを保持してから追加する実装
function setParam(key: string, value: string) {
  const params = new URLSearchParams(searchParams.toString());
  if (value) params.set(key, value); else params.delete(key);
  router.replace(`/jobs?${params.toString()}`);
}
// → setParam("job", jobId) で ?category=X&job=UUID の形になる
```

`selectedJobId` を `searchParams.get("job")` で読み出せばURLでの選択状態保持が成立する。

### 2-3. モバイル（遷移）とPC（2ペイン選択）の同一URL設計

**`?job=UUID` で統一し、描画側で分岐する設計が妥当:**

```typescript
const selectedJobId = searchParams.get("job");

// モバイル: ≤ lg → Link href="/jobs/{id}" でページ遷移
// PC(lg+): 右ペインに JobDetailPane を表示

// JobListItem 内での onSelect
function handleSelect(e: React.MouseEvent) {
  if (window.innerWidth >= 1024) {
    // 2ペインモード: URLパラメータ更新のみ（ページ遷移しない）
    e.preventDefault();
    setParam("job", job.id);
  }
  // else: Link のデフォルト動作（ページ遷移）
}
```

ただし `window.innerWidth` チェックは hydration ミスマッチの原因になりうるため、CSS `pointer-events` または `useMediaQuery` フックで制御する方が安全。

---

## 3. Phase 2 を見据えたレイアウトの器

### 3-1. 2カラム器と既存レイアウトの干渉確認

現在の `.jobs-layout` は `@media (min-width: 1024px)` で `display: block`（サイドバーを `display: none !important` で非表示）になっている。これを grid に変えるだけで2カラム化できる。

**現在のスタックと変更後:**

```
現在(1024px+):
  .jobs-layout { display: block }    ← 1カラム
  .jobs-sidebar { display: none }
  .jobs-list-desktop { grid 2col }

Phase 1(1024px+):
  .jobs-layout { display: grid; grid-template-columns: 220px 1fr }
  .jobs-sidebar { display: block }   ← 解禁
  .jobs-list-desktop { grid 1col }   ← 1カラムに戻す

Phase 2(1024px+):
  .jobs-layout { display: grid; grid-template-columns: 220px minmax(0,420px) 1fr }
  右ペインは selectedJobId がある時のみ JobDetailPane を描画
```

ヘッダー（`JobseekerHeader`）とフィルターバーは `jobs-layout` の外なので干渉なし。`maxWidth: var(--max-w-page)` の wrapper 内に収まる。

### 3-2. 左ペイン幅420px に縮んだ時のデータ行折り返し問題

`年収 · 勤務地 · リモート` を `flexWrap: wrap` で実装しているため、420px未満でも自然に折り返す。ただし以下のケースで3行になる懸念がある:

- 年収レンジが長い（例: `1000〜1500万円`）+ 勤務地あり + 勤務形態あり

**対策案:**
1. **省略スタイル**: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` を各要素に適用。420px 以下では勤務形態を非表示（`job-list-mobile-hide` クラスと同様の仕組み）。
2. **コンパクト年収表示**: `〜1500万` のように上限のみ表示する短縮フォーマット（420px時のみ）。
3. **separator 省略**: 中点（·）を消し、各要素を別行に分けて `<dl>` スタイルにする（情報量は同じ、折り返しを意図的に許容）。

**推奨: 案1 + 追加クラス `job-item-narrow` で幅依存制御。** コード量が最小で、2ペイン幅が変わっても CSS 修正だけで対応できる。

---

## 4. 影響範囲とリスク

### 4-1. 変更が波及するファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `JobsClient.tsx` | `JobListCard` → `JobListItem` 置換、レイアウト器更新、`selectedJobId` state 追加 |
| `jobs/loading.tsx` | skeleton を2カラム器に合わせる |
| `jobs/[id]/page.tsx` | Phase 2: RSC を `JobDetailPane` に流用するため型調整が必要な可能性 |

**変更不要（Phase 1）:**
- `page.tsx` — データフェッチ変更なし
- `queries.ts` — SELECT カラム変更なし
- `src/components/` 配下 — 流用のみ
- `SidebarFilters` コンポーネント — 変更なし（表示するだけ）

### 4-2. 「気になる」機能・面談受付ステータス表示の副作用

- **気になるボタン**: 現在 `JobListCard` にインラインで実装。`JobListItem` に移す際、`handleBookmark` のロジックは変更不要。`FavoriteButton` コンポーネントへの切り出しも検討できるが、Phase 1 では inline のままでよい。
- **面談受付中**: `accepting_casual_meetings` フラグは company データに含まれており、変更なし。行のオレンジ左ボーダーはそのまま流用可能。
- **ホバープレビュー**: `JobPreviewPanel`（現在 1440px+ で表示）は Phase 1 で削除またはそのまま共存。Phase 2 では右ペインが代替するので削除予定。

### 4-3. モバイル/PCのブレークポイント方針

現在の Tailwind 設定はデフォルト（`md: 768px`, `lg: 1024px`）。既存コードのブレークポイント実績:

| 分岐点 | 用途 |
|-------|------|
| `768px` (md) | 現在の2カラムグリッドの切り替え |
| `1024px` (lg) | デスクトップサイドバー表示（現在は非表示になっている）|
| `1440px` | ホバープレビューパネルの表示 |

**Phase 1 / 2 では `1024px` (lg) を2ペイン切り替えの境界にする。** Tailwind のデフォルト `lg` と整合しており、既存コードとも一致する。

---

## 5. 実装提案

### Phase 1: 縦リスト化 + 2カラム器の設置

**新設コンポーネント:**

```
JobListItem  ── 現 JobListCard を薄い行型に置き換える
  - 高さ: 約80〜100px（縦スクロールで一覧性重視）
  - 左端: CompanyLogo (32px)
  - 1行目: [求人タイトル] [面談受付中バッジ]
  - 2行目: [会社名] [フェーズバッジ]
  - 3行目: [年収] · [勤務地] · [勤務形態]
  - 右端: [♡ 気になる] [NEW]
  - 選択時: 左ボーダー4px royal blue + 背景 var(--royal-50)
  - 区切り: border-bottom のみ（box-shadow, border-radius 不要）
  - Link は href="/jobs/{id}" でモバイル遷移を担保
  - onClick で isDesktop 時は e.preventDefault() + setParam("job", id)

JobsList  ── リストの状態管理とループ描画を担当
  - selectedJobId: searchParams.get("job") から初期化
  - onSelect(id): setParam("job", id)
  - paged 配列を JobListItem にマップ
```

**CSS 変更（`jobs-layout`）:**

```css
/* Phase 1: フィルターサイドバー + 縦リスト */
@media (min-width: 1024px) {
  .jobs-layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .jobs-sidebar { display: block !important; }  /* none → block */
}
/* 縦リストは1カラムに戻す */
.jobs-list-desktop {
  display: flex;
  flex-direction: column;
  gap: 0;                    /* 区切り線ベースなので gap 不要 */
}
@media (min-width: 768px) {
  .jobs-list-desktop {
    grid-template-columns: unset;  /* 2col grid を解除 */
  }
}
```

**想定 diff 規模:**
- `JobListCard` → `JobListItem` の置き換え: 約 -280行 +150行
- CSS 変更: 約 -10行 +15行
- `selectedJobId` state 追加: +10行
- 合計: 約 **-120行** の純減（シンプル化）

**ビルド確認観点:**
- `JobListCard` を削除するため、他ファイルでの import がないか確認（`grep -r "JobListCard" src/`）
- ESLint: 削除した `shortDept` などの unused 変数と同様のケアが必要
- `onHover` prop が `JobListCard` 専用の `hoveredJob` 管理に依存している → `JobPreviewPanel` の削除または保留で対応

### Phase 2: 右ペインに JobDetailPane を差す

**`JobDetailPane.tsx` 新設（右カラム）:**

```typescript
// lg+ のみレンダリング（CSS で制御）
export function JobDetailPane({ jobId }: { jobId: string | null }) {
  // 基本: jobs/[id]/page.tsx と同じデータを fetch
  // ただし RSC は呼べないため: SWR / fetch + useEffect でクライアント取得
  // または jobs/[id]/page.tsx の Server Component を Server Action 経由で呼ぶ案

  if (!jobId) return <EmptyPlaceholder />;
  return <JobDetailContent jobId={jobId} />;
}
```

**Phase 2 の器追加（CSS のみ）:**

```css
@media (min-width: 1024px) {
  .jobs-layout {
    grid-template-columns: 220px minmax(0, 420px) minmax(0, 1fr);
  }
  .jobs-detail-pane { display: block; }  /* Phase 1 では display: none */
}
```

Phase 1 で `jobs-detail-pane` のプレースホルダー div を置いておくことで、Phase 2 は CSS 1行 + `JobDetailPane` の新設だけで完成する。

**Phase 2 の想定 diff 規模:**
- `JobDetailPane.tsx` 新設: 約 +200行
- `JobsClient.tsx` への差し込み: +5行
- CSS: +3行
- 合計: 約 **+210行**（`jobs/[id]/page.tsx` の内容次第でデータ取得の実装量が変わる）

**Phase 2 確認ポイント:**
- `jobs/[id]/page.tsx` は現状 RSC。`JobDetailPane` はクライアント境界内にあるため、同じクエリを `fetch()` で再実装するか Server Action 経由にする必要がある。
- データキャッシュ: 既に `unstable_cache` で取得済みの `allJobs` から `job.id` で引けるフィールドは再フェッチ不要（詳細本文 `description` / `requirements` 等は別途取得が必要）

---

## 6. 代替案

### 代替案A: `JobListCard` をそのまま縦1カラムに（最小変更）

`.jobs-list-desktop` の grid を解除して1カラムに戻すだけ。カードの厚みはそのまま。
- メリット: diff 最小
- デメリット: LinkedIn的な「薄い行スキャン」の一覧性は得られない。Phase 2 で左ペインが420pxになった時にカード内容が窮屈

### 代替案B: `/jobs` を Next.js の Parallel Routes で実装

`@list` / `@detail` の2スロット構成にすると、Next.js がルーティングレベルで2ペインを管理できる。
- メリット: RSC のまま詳細を表示できる（SEO フレンドリー、データフェッチが楽）
- デメリット: 現在の `JobsClient.tsx` を大幅に分解する必要があり、Phase 1 だけで大きな工数になる。既存のフィルター・ブックマーク状態管理の再設計が必要。

**Phase 2 まで待ってから検討する方が低リスク。**

---

## まとめ

| 観点 | 評価 |
|-----|-----|
| Phase 1 工数 | 小（JobListItem 新設 + CSS 変更のみ、page.tsx/queries.ts 無変更） |
| Phase 2 拡張性 | 高（Phase 1 で器を置いておくだけで CSS + 1ファイル追加で完成） |
| URL設計の整合性 | `?job=UUID` 追加で既存パラメータと共存可能。モバイル/PC同一URL成立 |
| 狭幅(420px)での折り返し | CSS クラスで制御可能。`flexWrap` 許容 or `narrow` クラスで省略 |
| 既存コンポーネント流用 | `CompanyLogo`, `StatusPill`, `GlobalToast` をそのまま使用可能 |
| ビルドリスク | `JobListCard` 削除に伴う import チェックが必要。ESLint の unused 変数に注意 |
