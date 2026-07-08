# フィード 回遊性向上 調査レポート（2026-07）

調査日: 2026-07-08  
対象ファイル:
- `src/app/(jobseeker)/feed/FeedClient.tsx`（1210行）
- `src/app/(jobseeker)/jobs/JobsClient.tsx`（2370行+）
- `src/app/(jobseeker)/people/PeopleListClient.tsx`（600行+）
- `src/lib/supabase/queries.ts`
- `src/app/api/jobs/preview/route.ts`
- `supabase/migrations/131_posts.sql`, `161_add_posts.sql`

---

## 1. 現状のフィードレイアウト

### コンテナ構造（FeedClient.tsx line 1074–1078）

```tsx
<div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 64px" }}>
  <h1>投稿</h1>
  <PostComposer />      // 投稿フォーム
  {posts.map((post) => <PostCard ... />)}   // 投稿リスト（単純map）
  <button>もっと見る</button>
</div>
```

| 項目 | 値 |
|------|-----|
| カラム数 | **1カラム**（完全単列） |
| maxWidth | 680px（中央揃え） |
| サイドバー | **なし** |
| 投稿の並び | `.map()` で単純連続レンダリング |
| 差し込み余地 | `.map()` を `flatMap()` や index条件に変えれば任意の位置に挿入可能 |

### デスクトップでの余白

- ビューポート幅 1280px のとき: 両サイドに (1280-680)/2 = **300px ずつ** の余白がある
- `maxWidth: 980` + 右カラム `260px` のような 2カラムにしても問題ない空間がある
- ただし `padding: "24px 16px"` は変えずに外側のラッパーを 2カラム化する方法が最小変更

---

## 2. 再利用できる「素材」の現状

### 2-A. 求人カード

| コンポーネント | 場所 | エクスポート | 状況 |
|------------|------|-----------|------|
| `JobCard` | `JobsClient.tsx:131` | ❌ ローカル関数 | グリッド用縦型カード |
| `JobListCard` | `JobsClient.tsx:912` | ❌ ローカル関数 | 横型リストカード |

**両方とも `JobsClient.tsx` 内専用**。`companyMap: Map<string, Company>` を引数に取るため、
フィードから直接使うには企業データの別途取得 + Map 生成が必要。

→ **再利用するには、軽量な `JobMiniCard` を新規作成するほうが早い**。
  既存の `/api/jobs/preview` レスポンス（`title, companyName, dept, salaryMin, salaryMax, workStyle, logoUrl`）に合わせて30行程度で書ける。

### 2-B. 話せる人カード（/people）

| コンポーネント | 場所 | エクスポート | 状況 |
|------------|------|-----------|------|
| `AmbassadorGridCard` | `PeopleListClient.tsx:176` | ❌ ローカル関数 | is_ambassador=true の人用 |
| `AmbassadorListRow` | `PeopleListClient.tsx:284` | ❌ ローカル関数 | リスト行 |
| `PeerGridCard` | `PeopleListClient.tsx:456` | ❌ ローカル関数 | 一般ユーザー用 |

**すべてローカル**。`AmbassadorCard` / `PeerCard` 型に依存している。

→ 再利用するには `AmbassadorCard` / `PeerCard` 型は `export type` されている
  (`PeopleListClient.tsx:7, 26`) ので、import は可能。
  ただし `AmbassadorGridCard` 自体はエクスポートされていないため、
  やはり軽量な `PersonMiniCard` を新規作成するほうが現実的。

### 2-C. 取得 API・クエリ

| API | 場所 | 内容 | 備考 |
|-----|------|------|------|
| `GET /api/jobs/preview` | `api/jobs/preview/route.ts` | 最新求人を最大9件（1社1件制限付き） | **そのまま使える** |
| `getJobs()` | `queries.ts:642` | 全求人+全企業取得 | `unstable_cache` 300s、SSRから呼べる |
| `getParentRoles()` | `queries.ts:613` | 職種カテゴリ一覧 | `unstable_cache` 3600s |
| 話せる人API | なし | `/people` 用のAPIルートは存在しない | SSRでDB直接クエリしている |

**`/api/jobs/preview`** はフィードのクライアントサイドから直接呼べる。

---

## 3. トピック/タグの現状

### ow_posts テーブル構造（migration 161）

```sql
CREATE TABLE ow_posts (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  NOT NULL,
  content     TEXT  NOT NULL,  -- 1〜1000文字
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- **`tags`・`category`・`topics` カラム: なし**
- タグシステムを追加するにはマイグレーションが必要

### categoryMeta の残骸

`categoryMeta`・`PostCategory`・`category_meta` のいずれもコードベース内に**存在しない**。
旧 `/posts` 系（`src/app/(jobseeker)/posts/`）は 2026-07 のセッション26冒頭で**完全削除済み**。
参考にできる残骸はゼロ。

---

## 4. 「関連」の判定材料

### 現時点で使える情報

| 情報源 | 取得コスト | 精度 |
|--------|-----------|------|
| **新着求人**（published_at 降順） | ゼロ（`/api/jobs/preview` が既存） | 関連度なし・でも常に新鮮 |
| **投稿者の希望職種**（`ow_profiles.job_type`） | 追加クエリ1本 | 中（職種が一致する求人を出せる） |
| **投稿者の現職**（`ow_experiences.is_current=true`） | 追加クエリ1本（feed/page.tsx で既に取得済み） | 中（同業界・同職種の求人） |
| **is_ambassador=true のユーザー** | 追加クエリ1本 | 関連度なし・でも「話せる人」として常に有効 |
| **投稿本文のキーワードマッチ** | サーバーサイド文字列処理 | 低（日本語形態素解析なしでは雑） |

---

## 5. 回遊性を高める具体案（難易度別）

### ★ 低難易度A: デスクトップサイドバー（推奨 #1）

**概要:** デスクトップ（≥1024px）でフィードを 2カラムにする。
右カラム（260px）に「新着求人3件」「話せる人3人」を固定表示。

```tsx
// FeedClient.tsx の return を変更
<div style={{ maxWidth: 980, margin: "0 auto", display: "flex", gap: 24, padding: "24px 16px" }}>
  <div style={{ flex: 1, minWidth: 0 }}>
    {/* 既存の PostComposer + 投稿リスト */}
  </div>
  <aside style={{ width: 260, flexShrink: 0 }}>  {/* ≥1024px のみ */}
    <FeedSidebarJobs />      {/* /api/jobs/preview から3件 */}
    <FeedSidebarPeople />    {/* adminSupabase から is_ambassador=true 3件 */}
  </aside>
</div>
```

**実装範囲:**
- `FeedClient.tsx`: 外側レイアウトを 2カラム化 + `<FeedSidebar>` コンポーネント追加
- `FeedSidebar.tsx` (新規): クライアント側で `useEffect` → `/api/jobs/preview?limit=3` 呼び出し、人は同様
- または `feed/page.tsx` (SSR) でサイドバー用データを先読みして props 渡し（より高速）

**リスク:**
- モバイルでは非表示（`@media (max-width: 1023px)` で `display: none`）にするだけ
- 680px の投稿カラムが 980-260-24=696px になるが見た目の変化はほぼなし

**工数:** 2〜3時間。`/api/jobs/preview` は既存なので求人取得はゼロコスト。

---

### ★ 低難易度B: 投稿間差し込み（推奨 #2）

**概要:** N件ごとに「おすすめ求人1件」を投稿リストの間に差し込む。
（例: 5件ごと、または最初の5件の後に1枚）

```tsx
posts.map((post, i) => (
  <>
    <PostCard key={post.id} ... />
    {i === 4 && sidebarJobs[0] && (
      <JobDiscoveryCard job={sidebarJobs[0]} label="新着求人" />
    )}
    {i === 9 && sidebarPeople[0] && (
      <PersonDiscoveryCard person={sidebarPeople[0]} label="話せる人" />
    )}
  </>
))
```

**実装範囲:**
- `FeedClient.tsx`: `.map()` を `flatMap()` + index 条件に変更
- `JobDiscoveryCard` / `PersonDiscoveryCard` コンポーネント新規（各20〜30行）
- データ取得は SSR（`feed/page.tsx`）または Client `useEffect` どちらでも可

**リスク:**
- 差し込み頻度の調整（多すぎると邪魔）
- 「もっと見る」で追加ロードしたときに差し込みがズレる
  → ズレてもユーザー体験は問題ない（差し込みは装飾的）

**工数:** 1〜2時間。

---

### 中難易度: 投稿者プロフィールに基づく関連求人

**概要:** 投稿者の `ow_profiles.job_type`（希望職種）と一致する求人を表示。

```typescript
// feed/page.tsx SSR で追加
const { data: profiles } = await adminSupabase
  .from("ow_profiles")
  .select("user_id, job_type")
  .in("user_id", uniqueUserIds);

// job_type → 求人 job_category のマッチング
const matchingJobs = allJobs.filter(j => 
  profiles.some(p => p.job_type && j.dept?.includes(p.job_type))
);
```

**実装範囲:**
- `feed/page.tsx`: `ow_profiles` の追加クエリ（uniqueUserIds は既に取得済み）
- `JobsClient.tsx` の `JOB_TO_ROLE_NAMES` マッピングを参考に職種マッチング関数追加
- 差し込み or サイドバーのどちらにも適用可

**制約:** 現在ユーザー数が少ないため `job_type` の設定率が低い可能性あり。
マッチなければ新着求人にフォールバックすればよい。

**工数:** 3〜4時間。

---

### 高難易度: 投稿タグシステム

**概要:** `ow_posts` に `tags TEXT[]` を追加し、投稿時にタグを付与。
タグから関連投稿・関連求人へのナビゲーション。

**必要なもの:**
1. Migration: `ALTER TABLE ow_posts ADD COLUMN tags TEXT[] DEFAULT '{}';`
2. PostComposer: タグ入力UI（マルチセレクト or 自由入力）
3. PostCard: タグ表示 + クリックでタグ検索
4. フィードAPI: `?tag=営業` クエリパラメータ対応
5. 求人タグとの対応マッピング定義

**工数:** 1〜2日（設計・実装・テスト）
**リスク:** 投稿者がタグを付けないとシステムが機能しない。ユーザー数が少ない現段階では効果が出にくい。

---

## 6. 推奨: まず何から始めるか

### 推奨実装順序

```
Phase 1（即効・低リスク）: デスクトップサイドバー
  → 680px 投稿カラムはそのまま。右に260px で求人・話せる人を常時表示
  → モバイル非表示で安全
  → /api/jobs/preview は既存。話せる人も adminSupabase 1クエリ

Phase 2（投稿間差し込み）: 5件ごとに求人1枚
  → Phase 1 のデータをそのまま使い回せる
  → モバイルでも機能する（唯一の回遊導線）

Phase 3（オプション）: 投稿者職種マッチング
  → ユーザーが増えてから、プロフィール充実後に
```

### 理由

- **サイドバーが費用対効果 #1** の理由:
  - `/api/jobs/preview` が既に完成しているためデータ取得コストゼロ
  - デスクトップの300px余白を有効活用（現状は死んでいる）
  - 「邪魔」にならない（投稿の流れを切断しない）
  - 実装がシンプル（FeedClient.tsx への外側ラッパー追加のみ）

- **投稿間差し込みが #2** の理由:
  - モバイルでも機能する唯一の回遊手段
  - サイドバーと組み合わせると、全デバイスで回遊導線が成立

---

## 7. 実装分割案

### Commit 1: サイドバーデータ取得（SSR追加）
- `feed/page.tsx`: `adminSupabase` で is_ambassador=true を3件追加フェッチ
- `FeedClient.tsx`: `Props` に `sidebarJobs` / `sidebarPeople` を追加
- 表示なし（データのみ渡す）

### Commit 2: デスクトップサイドバー表示
- `FeedClient.tsx`: 外側を 2カラム化 + `FeedDiscoverySidebar` コンポーネント
- `FeedDiscoverySidebar.tsx`（新規）: 求人ミニカード + 人ミニカード（CSS media query で ≥1024px のみ表示）

### Commit 3: 投稿間差し込み（モバイル対応）
- `FeedClient.tsx`: `.map()` を index 条件 + 差し込みカード対応に変更
- `FeedDiscoveryCard.tsx`（新規）: 差し込み用「発見カード」（求人 or 人を統一スタイルで表示）

---

## リスク一覧

| リスク | 影響 | 対策 |
|--------|------|------|
| モバイルでサイドバーが邪魔 | 中 | `@media (max-width: 1023px) { display: none }` で完全非表示 |
| 求人データが古い（5分キャッシュ） | 低 | `/api/jobs/preview` の `revalidate = 300` はそのままでOK |
| 差し込みカードが「広告っぽい」 | 中 | デザインを投稿カードと統一（白背景・同一border）し、ラベルを「おすすめ」でなく「新着求人」「話せる人」に |
| 投稿0件時に差し込みが機能しない | 低 | 差し込みはサイドバーでカバーできているので問題なし |
| 話せる人データAPIルートがない | 低 | `feed/page.tsx` SSR から `adminSupabase` で直接クエリすればよい |
