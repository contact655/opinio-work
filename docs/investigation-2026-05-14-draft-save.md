# 「下書き保存」機能 現状調査レポート

調査日: 2026-05-14  
調査対象: `/biz/company` 企業情報編集画面の保存挙動全般

---

## 結論（3行）

- **UI と実装は根本的に乖離している**: 「下書きに保存中...」「下書きを自動保存しました」と表示されるが、実際は `ow_companies` の本番カラムを700ms debounce で直接 UPDATE しており、「下書き」という中間状態は存在しない。
- **autosave は即時公開ページに反映される**: `/companies/[id]` は `force-dynamic` 相当（Server Component + `createClient()`）で動作し、キャッシュ無効化処理も存在しないため、autosave完了後にブラウザをリロードすれば変更が見える。「変更を公開する」ボタンは `is_published` フラグを操作するだけで、コンテンツの公開タイミングとは無関係。
- **`draft_data` カラムは migration で追加されたが、アプリからは一切書き込まれていない**: `hasDraftChanges` フラグを算出するコードは存在するが、`draft_data` は常に `null` のため常に `false` となるデッドコードになっている。

---

## 1. データフロー実態

```
[編集フォーム onChange]
    │
    │ state 更新 (hasInteracted.current = true)
    ▼
[useEffect (form 変化検知)]
    │
    │ 700ms debounce
    ▼
[PUT /api/biz/company]
    │
    │ transformFormToDb() → 全フィールドを DB 形式に変換
    ▼
[ow_companies UPDATE]
    ├── name, tagline, mission, why_join, company_features
    ├── industry, phase, url, logo_*, about_markdown
    ├── employee_count, avg_age, avg_salary, ... (数値データ全項目)
    ├── location, remote_work_status, workstyle_description ... (働き方全項目)
    ├── is_published, accepting_casual_meetings, notification_emails
    └── updated_at = NOW()
    ※ draft_data は書き込まない

[「変更を公開する」ボタン]
    │
    ▼
[PATCH /api/biz/company]
    │
    ▼
[ow_companies UPDATE]
    ├── is_published = true
    ├── published_at = NOW()
    └── updated_at = NOW()
    ※ コンテンツ自体は既に autosave で書き込み済み
```

### 保存トリガーの種類

| トリガー | API | HTTP | DB 書き込み |
|---------|-----|------|-----------|
| フォーム変更（700ms debounce） | `/api/biz/company` | PUT | `ow_companies` 全フィールド（`draft_data` 以外） |
| 「変更を公開する」ボタン | `/api/biz/company` | PATCH | `is_published`, `published_at`, `updated_at` のみ |
| 「下書き保存」ボタン | **存在しない** | — | — |
| ロゴアップロード | Supabase Storage 直接 → PUT（logoUrl 経由） | — | Storage + autosave |

---

## 2. UI と実装の乖離マップ

| UI 表記 | 出現箇所 | 実装の実際 | 乖離度 |
|---------|---------|-----------|--------|
| 「下書きに保存中...」 | `CompanyEditClient.tsx` L388, saveState=saving 時 | `PUT /api/biz/company` 発火中（本番 UPDATE 中） | **高**: 「下書き」ではなく本番データを更新している |
| 「下書きを自動保存しました」 | `CompanyEditClient.tsx` L389, saveState=saved 時 | `ow_companies` を直接 UPDATE 完了済み | **高**: 「下書き」という中間状態は存在しない |
| 「編集すると下書きに保存されます。『公開する』で求職者側に反映されます。」 | `CompanyEditSubNav.tsx` L54 | autosave = 本番 UPDATE。公開ページにも即時反映される（is_published=true 企業の場合） | **高**: 「公開する」前にも反映されている |
| 「下書きあり」バッジ | `CompanyEditSubNav.tsx` L106, `s.hasDraft` が true の時 | `s.hasDraft = form.hasDraftChanges && s.showStatus`、`hasDraftChanges = draft_data != null && ...`、`draft_data` は常に null → **常に false → 表示されない** | **致命的**: バッジは一度も表示されたことがない |
| 「未公開の変更があります」バナー | `CompanyPublishStatusBar.tsx` L9, `hasDraftChanges=true` 時 | `hasDraftChanges` は常に false → **常に「最新の情報が公開されています」バナーが表示される** | **高**: is_published=false でも「最新の情報が公開」と誤表示 |
| 「変更を公開する」ボタン | `CompanyEditClient.tsx` L866 | `is_published = true` にするだけ。コンテンツは既に autosave で DB に書いてある | **中**: ボタンの意味は正しい（公開フラグON）が、内容変更との分離という文脈では誤解を招く |

### grep 結果（全文言出現箇所）

```
"下書きに保存中"
  → CompanyEditClient.tsx:388

"下書きを自動保存"
  → CompanyEditClient.tsx:389

"変更を公開"
  → CompanyPublishStatusBar.tsx:47 (「変更を公開する」ボタンで)
  → CompanyEditClient.tsx:866 (ボタンテキスト)

"下書き"
  → CompanyEditClient.tsx:349 (hasDraftChanges: false)
  → CompanyEditClient.tsx:372 (hasDraft: form.hasDraftChanges)
  → CompanyEditClient.tsx:388-389 (saveState UI テキスト)
  → CompanyEditClient.tsx:408-409 (CompanyPublishStatusBar props)
  → CompanyEditSubNav.tsx:54 (説明テキスト)
  → CompanyEditSubNav.tsx:106 (「下書きあり」バッジ)
  → CompanyPublishStatusBar.tsx:5 (prop 型)
  → CompanyPublishStatusBar.tsx:43-45 (バナー文言)
  ※ biz/meetings/MeetingsClient.tsx の memoDrafts は面談メモ用の別機能

"draft"
  → lib/supabase/types.ts:2421,2523,2625 (生成された型定義)
  → lib/business/company.ts:39 (DbCompany.draft_data)
  → lib/business/company.ts:50 (SELECT_COLUMNS)
  → lib/business/company.ts:110 (hasDraftChanges 算出)
  ※ profile/edit/ProfileEditClient.tsx の EducationDraft は教育歴フォーム用の別型
```

---

## 3. is_published の実態

### スキーマ定義
**migration: `031_opinio_phase1_core_schema.sql` L776-790**
```sql
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
-- コメント: 公開設定
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS draft_data JSONB;
-- コメント: 下書き機能

-- RLS ポリシー
CREATE POLICY "ow_companies_published_read"
  ON ow_companies FOR SELECT
  USING (is_published = true OR status = 'active');
```

### 公開ページでの is_published の扱い

| 関数 | ファイル | is_published フィルター |
|------|---------|----------------------|
| `getCompaniesForList()` | `queries.ts` L293-306 | 本番環境のみ `= true`、dev は全件 |
| `getCompanyById()` | `queries.ts` L382-410 | **フィルターなし** — UUID でアクセスすれば is_published=false でも公開ページで表示される |
| `getCompanyEmployees()` 等 | `queries.ts` | RLS 依存（is_published=true OR status='active'） |

**重要**: `getCompanyById()` に is_published フィルターが存在しないため、URL（UUID）を知っていれば非公開企業の詳細ページが閲覧できる。一覧（`/companies`）には本番環境では出ないが、直接アクセスは可能。

### 全企業の is_published 値（2026-05-14 DB 実測）

| 企業名 | is_published | draft_data |
|-------|-------------|-----------|
| テスト株式会社\_001〜020（シード20社） | **true** | null（全社） |
| 株式会社Third Box（2）※登録企業 | **true** | null |
| 株式会社Opinio（重複作成分） | false | null |
| 株式会社Third Box（初期登録分） | false | null |
| テスト商事\_20260513\_1 | false | null |

全企業で `draft_data = null`。一度も書き込まれた実績なし。

---

## 4. キャッシュ・リバリデート挙動

### `/companies/[id]` ページの設定

**ファイル**: `src/app/(jobseeker)/companies/[id]/page.tsx`

```typescript
// ページ先頭の export 設定: なし
// → Next.js App Router のデフォルト動作
// → createClient() (SSR Supabase client) 使用
// → force-dynamic と同等（リクエストごとに再取得）
```

- `export const dynamic` → **未定義**
- `export const revalidate` → **未定義**
- `revalidatePath` / `revalidateTag` 呼び出し → **なし**（`PUT /api/biz/company` も PATCH も呼ばない）
- Supabase クライアント: `createClient()` (Server-side cookies 使用) → SSR で動的レンダリング

### 編集 → 公開ページ反映の実際の挙動

```
1. 編集フォームでタグライン変更
2. 700ms 後 PUT /api/biz/company 発火 → ow_companies の tagline カラム更新
3. UI: 「下書きを自動保存しました」表示
4. /companies/{uuid} をブラウザでリロード
   → Server Component が新しいリクエストで createClient() 経由で DB 読み取り
   → 変更が即時反映されて見える
```

**結論**: autosave 完了後、公開ページを**リロードするだけで変更が反映される**。
「変更を公開する」ボタンを一度も押さなくても、is_published=true の企業であれば変更内容は即座に公開ページに露出している。

---

## 5. draft_data コミット履歴

### draft_data に言及するコミット（全件）

| コミット | 日付 | 内容 |
|---------|------|------|
| `977b1a3` | 2026-04-26 | `feat(biz/company): S4a foundation - 6-section refactor + useAutoSave hook`。`company.ts` で `draft_data` を SELECT_COLUMNS に追加、`hasDraftChanges` を算出するロジックを追加。**PUT では draft_data を書かない**設計のまま |
| `e45d7c6` | (以降) | Phase 4 S5 - production READ/WRITE 実装。PUT ハンドラに `draft_data` への書き込みなし |
| `031_opinio_phase1_core_schema.sql` | migration | `draft_data JSONB` カラムを追加。コメント「下書き機能」。RLS ポリシーは `is_published` ベースで `draft_data` とは無関係 |

### 過去に「下書き機能」を実装しようとした痕跡

- migration 031 のコメント「下書き機能」は、`draft_data` カラムを将来の下書き機能用に確保した意図と推察される
- `hasDraftChanges` フラグの算出ロジック（company.ts L110）は、将来 draft_data に書き込む設計を想定して組まれた**骨格コード**
- `CompanyPublishStatusBar.tsx` の「未公開の変更があります」バナー、`CompanyEditSubNav.tsx` の「下書きあり」バッジも、その設計に対応する UI として実装された
- しかし**PUT ハンドラに draft_data 書き込みが実装されることなく**、autosave = 本番 UPDATE という現状の実装に落ち着いた

---

## 6. 戦略判断に必要な追加情報

### 選択肢に影響する重要事実

**A. autosave の影響範囲**
- 現在 autosave は `is_published` の値に関係なく全フィールドを書き込む
- `is_published = false` の企業でも、autosave で変更は DB に保存される
- RLS で `is_published = true OR status = 'active'` となっているため、is_published=false かつ status≠active の企業は Supabase の anon key でアクセスできない。ただし `getCompanyById()` は Service Role を使っていない（`createClient()` = anon/user）ので is_published=false の企業は RLS でブロックされる可能性がある要確認点

**B. 「変更を公開する」ボタンの実際の役割**
- ボタンを押すと `is_published = true` になる（一度 true になると false に戻す UI は公開設定タブの FormSelect のみ）
- `handlePublish()` 後に `hasDraftChanges: false` を state に set しているが（L349）、これは autosave で false が来るのを待たずに即座に UI を更新するための楽観的更新で、DB の `draft_data` は変化しない

**C. is_published=true 企業での autosave のリスク**
- 現在の設計では、編集中の内容が autosave されると公開ページに即時露出する
- 例: ミッションを書きかけの状態でフォーカスを外すと700ms後に不完全なミッションが公開ページに表示される

**D. `/companies/{uuid}` の直接アクセス問題**
- `getCompanyById()` に is_published フィルターがない
- RLS の SELECT ポリシー `is_published = true OR status = 'active'` が機能するかどうかは、createClient()（anon/user key）経由かどうかによる
- 本番環境で is_published=false の企業 UUID を知るユーザーが直接アクセスした場合の挙動は要確認

**E. 将来の真の下書き実装に必要なもの**
- `draft_data` カラムにコンテンツを書く（PUT で `draft_data = form の JSON スナップショット` にする）
- 「変更を公開する」時に `draft_data` → 各カラムへ展開して `is_published=true` + `draft_data=null`
- autosave は `draft_data` のみ更新し、本番カラムは触れない
- 実装規模: API Route (PUT/PATCH) + transformFormToDb 相当の逆変換 + 全 SELECT 関数への対応
