# プレビュー機能 現状調査レポート

調査日: 2026-05-14  
対象: `/biz/company` 編集画面のプレビューボタン〜公開ページ表示までの全フロー  
制約: コード変更なし、調査のみ

---

## 1. 編集画面プレビューボタンの現状

**ファイル**: `src/app/biz/company/CompanyEditClient.tsx`

### 現在の実装（L878-880）

```tsx
onClick={() => alert("プレビュー（実装予定）")}
```

`alert` のまま。未実装確定。

### ボタンの配置・UI

行番号 877〜940 付近。右上サブトップバー内の「保存状態表示」の右隣に、「プレビュー」（灰色枠）と「変更を公開する」（緑）が横並びで配置されている。

```
[ 保存状態テキスト ]  [ プレビュー ]  [ 変更を公開する ]
```

### 表示条件

- **プレビューボタン**: 常時表示。`hasDraftChanges` による出し分けなし
- **「変更を公開する」ボタン**: `disabled={isPublishing || !hasDraftChanges}` で制御済み

### CompanyEditClient.tsx の state 一覧

| state / ref | 型 | 初期値 | 用途 |
|-------------|-----|--------|------|
| `form` | `BizCompany` | `initialCompany` | フォーム全体 |
| `hasDraftChanges` | `boolean` | `initialCompany.hasDraftChanges` | 未公開変更の有無 |
| `saveState` | `"idle" \| "saving" \| "saved" \| "error"` | `"idle"` | 自動保存 UI 状態 |
| `lastSavedAt` | `Date \| null` | `null` | 最終保存時刻 |
| `saveAgoText` | `string` | `""` | 相対時刻表示 |
| `isPublishing` | `boolean` | `false` | PATCH 実行中フラグ |
| `isPublishingRef` | `useRef<boolean>` | `false` | autosave race condition ガード |
| `hasInteracted` | `useRef<boolean>` | `false` | 初回 autosave 発火防止 |
| `activeSection` | `CompanySectionId` | `"basic"` | サイドナビ選択中セクション |

---

## 2. 公開ページのデータ取得フロー

### ページ構成

**ファイル**: `src/app/(jobseeker)/companies/[id]/page.tsx`  
**種別**: Server Component（`async`）

### generateMetadata（L28-43）

```typescript
export async function generateMetadata({ params }: Props) {
  const { company } = await getCompanyById(params.id);
  // company.name, company.tagline を使用
}
```

`getCompanyById()` を呼び出し。draft_data は参照していない。

### メインのデータ取得（L2650〜）

```typescript
const { company, detail, employeeCategories } = await getCompanyById(params.id);
if (!company) notFound(); // L2678
```

### 認証判定（L2666〜）

```typescript
const { data: { user } } = await supabase.auth.getUser();
// user が存在すれば、ブックマーク状態を確認（L2682-2693）
```

認証チェックは「ブックマーク状態の取得」のみ目的。非認証でもページは表示される。

### is_published フィルター箇所

**ファイル**: `src/lib/supabase/queries.ts` L390-391

```typescript
let companyQuery = supabase.from("ow_companies").select(COMPANY_DETAIL_COLS).eq("id", id);
if (process.env.NODE_ENV !== "development") {
  companyQuery = companyQuery.eq("is_published", true); // ← hotfix で追加
}
const { data, error } = await companyQuery.single();
```

dev 環境ではフィルターなし（テストデータ対応）。本番のみ is_published=true を強制。

### SELECT カラム一覧（COMPANY_DETAIL_COLS、L355-365付近）

```
id, name, tagline, industry, phase, employee_count, location, url,
logo_gradient, logo_letter, logo_url,
mission, description, why_join, company_features, about_markdown,
avg_salary, avg_age, paid_leave_rate, avg_overtime_hours, gender_ratio, funding_total,
remote_work_status, work_time_system, workstyle_description,
nearest_station, benefits, evaluation_system,
created_at, updated_at
```

`draft_data` は SELECT に含まれていない。

### 並列フェッチ

`Promise.all` で `ow_jobs`、`ow_roles`、`employeeCategories` を並列取得。

### `/companies/[id]/` 配下のサブルート

| ルート | ファイル | 補足 |
|--------|---------|------|
| `/companies/[id]` | `page.tsx` | 企業詳細（メイン） |
| `/companies/[id]/posts` | `posts/page.tsx` | 企業発信リンク一覧。is_published フィルター追加済み |
| `/companies/[id]/casual-meeting` | `casual-meeting/page.tsx` | カジュアル面談申込 |

---

## 3. draft_data スキーマと本番カラム対応表

**ファイル**: `src/lib/business/company.ts` L114-152（`transformFormToDb()`）  
**BizCompany 型定義**: `src/lib/business/mockCompany.ts` L13-61（32フィールド）

### マッピング全体

| BizCompany（フロント） | ow_companies カラム | 変換 |
|----------------------|-------------------|------|
| name | name | そのまま |
| tagline | tagline | `or null` |
| mission | mission | `or null` |
| whyJoin | why_join | `or null` |
| companyFeatures | company_features | 配列 or null |
| industry | industry | `or null` |
| phase | phase | `or null` |
| url | url | `or null` |
| logoGradient | logo_gradient | `or null` |
| logoLetter | logo_letter | `or null` |
| logoUrl | logo_url | `or null` |
| descriptionMarkdown | about_markdown | `or null` |
| employeeCount | employee_count | `or null` |
| foundedAt | established_at | `or null` |
| avgAge | avg_age | 数値化（null 許容） |
| avgSalary | avg_salary | `or null` |
| fundingTotal | funding_total | `or null` |
| genderRatio | gender_ratio | `or null` |
| evaluationSystem | evaluation_system | `or null` |
| benefitsTags | benefits | 配列 or null |
| location | location | `or null` |
| nearestStation | nearest_station | `or null` |
| remoteWorkStatus | remote_work_status | `or null` |
| workScheduleType | work_time_system | `or null` |
| avgOvertimeHours | avg_overtime_hours | `or null` |
| paidLeaveRate | paid_leave_rate | 数値化（null 許容） |
| workstyleNote | workstyle_description | `or null` |
| isPublished | is_published | そのまま |
| acceptingCasualMeetings | accepting_casual_meetings | そのまま |
| notificationEmails | notification_emails | カンマ/改行 → 配列 |
| — | updated_at | `new Date().toISOString()` |

### draft_data の保存フロー

**ファイル**: `src/app/api/biz/company/route.ts`

```typescript
// PUT（自動保存）L27-38
const record = transformFormToDb(body as BizCompany);
await supabase.from("ow_companies").update({
  draft_data: record,     // ← 上記マッピング全体を JSONB に保存
  updated_at: new Date().toISOString(),
}).eq("id", companyId);
// 本番カラム（name, mission 等）は一切変更しない

// PATCH（公開）L91-97
const updatePayload: Record<string, unknown> = {
  ...(currentRow?.draft_data ?? {}),  // ← draft_data を展開
  is_published: body.isPublished,
  published_at: now,
  updated_at: now,
  draft_data: null,                   // ← draft_data をクリア
};
```

### 逆変換（transformDbToForm）

`src/lib/business/company.ts` には `transformDbToForm()` は存在する（`fetchCompanyForTenant()` 内部で使用）。ただし **draft_data を読み込んで BizCompany に変換する用途では未使用**。

---

## 4. preview クエリパラメータの既存運用

**grep 結果**: `?preview`・`preview=true`・`searchParams.preview` 等のクエリパラメータとしての使用実績は**プロジェクト全体でゼロ**。

既存の "preview" 出現箇所はすべてプレビュー UI state（画像アップロードのプレビュー等）であり、URL パラメータとしては未使用。

---

## 5. 実装にあたっての論点・懸念

### 論点 A: プレビューの情報源をどう設計するか

現在の `getCompanyById()` は本番カラムのみを読む（draft_data は SELECT 対象外）。

```
案1: /companies/[id]?preview=1 — 同じページで draft_data をマージ表示
案2: /biz/company/preview — BIZ 側に専用プレビューページを作る
案3: /api/biz/company/preview — draft_data を返す API + クライアントレンダリング
```

「本番と同じ見た目でプレビューしたい」であれば案1が最も一致するが、URLが求職者に漏れるリスクがある。

### 論点 B: 権限ガードをどのレイヤーに置くか

`/companies/[id]?preview=1` は `is_published=false` でもアクセス可能にする必要がある。現状のフィルターロジック（`process.env.NODE_ENV !== "development"`）をどう拡張するか。

選択肢:
- `?token=xxx`（秘密トークン方式）: シンプルだが URL に流出リスク
- セッションクッキーで「BIZ ユーザーか」を確認: より安全だが Server Component の認証フローが必要
- `/biz/` 配下にプレビューを置いて BIZ の認証ミドルウェアに乗る: 最もシンプルで安全

### 論点 C: draft_data をどう読み込むか

`getCompanyById()` に `draft_data` カラムを追加して SELECT し、`preview=1` のときにマッピング結果で上書きする方法が最もローコスト。

ただし:
- draft_data の JSON は `transformFormToDb()` の出力（スネークケース DB 形式）
- 公開ページの表示コンポーネントは DB 形式を受け取るため、**追加の変換処理は不要**（draft_data をそのままスプレッドできる可能性あり）
- `draft_data` が null の場合（下書きなし）はボタンを disabled にする

### 論点 D: hasDraftChanges との連動

現状、プレビューボタンは `hasDraftChanges` 関係なく常時表示・有効。

考えられる UX 方針:
- `hasDraftChanges=false`（下書きなし）→ ボタン disabled or 非表示（「プレビューできる下書きがありません」）
- `hasDraftChanges=true`（下書きあり）→ プレビューボタン活性
- `saveState === "saving"`（保存中）→ 保存完了後にプレビュー遷移（または disabling）

### 論点 E: SEO 対策

プレビュー URL が Google にインデックスされないよう `<meta name="robots" content="noindex">` の付与が必要。また、`?preview=1` を含む URL でも OGP 画像が意図しない内容になる可能性。

### 論点 F: サブルートの扱い

`/companies/[id]/posts` にもプレビューを展開するか、企業詳細（`[id]`）のみ対応するかを決める必要あり。posts ページにも `draft_data` に含まれる投稿リンク群があるかどうかを確認要。

### 論点 G: 自動保存との競合

プレビューボタンクリック時に `saveState === "saving"` だった場合、まだ最新の draft_data がサーバーに届いていない。遷移前に保存完了を待つ UX が必要かどうかを検討。

---

## 関連ファイル一覧

| ファイル | 関連内容 |
|---------|---------|
| `src/app/biz/company/CompanyEditClient.tsx` L878-880 | プレビューボタン（alert のまま） |
| `src/lib/supabase/queries.ts` L355-416 | getCompanyById + is_published フィルター |
| `src/app/(jobseeker)/companies/[id]/page.tsx` L2650- | 公開ページのデータ取得フロー |
| `src/app/(jobseeker)/companies/[id]/posts/page.tsx` | サブルート（posts） |
| `src/lib/business/company.ts` L114-152 | transformFormToDb（draft_data のスキーマ） |
| `src/app/api/biz/company/route.ts` | PUT（draft_data保存） / PATCH（公開） |
| `src/lib/business/mockCompany.ts` L13-61 | BizCompany 型定義（32フィールド） |
