# メンターURL構造 調査レポート

作成日: 2026-05-15
調査者: Claude Code

---

## 1. エグゼクティブサマリー

現在 `/mentor`（単数形）と `/mentors`（複数形）の2つのメンター関連URLが並存している。前者はメンター制度を説明するLP、後者はメンター一覧（検索）ページである。`/mentors` への内部リンクは **13箇所**あり、ヘッダー・フッター・各詳細ページに散在している。`/mentor` は footer の1箇所のみ。**sitemap.ts に `/mentors` と `/mentor` の記載がない**ため、現時点での SEO インデックスリスクは低い。`/mentors` を `/mentors/search` に移動する場合、URL変更の影響箇所は13箇所で中程度のリスクがあり、301リダイレクト追加と内部リンクの一括修正が必要になる。

---

## 2. 現状把握

### 2-1. ディレクトリ構造

```
src/app/
├── mentor/                          # /mentor — メンター制度 LP（単数形）
│   └── page.tsx                     # 479行
└── (jobseeker)/
    └── mentors/                     # /mentors — メンター一覧（複数形）
        ├── page.tsx                 # 280行（Server Component, searchParams: dept/theme）
        ├── MentorFilterBar.tsx      # フィルターバー UI コンポーネント
        ├── mockMentorData.ts        # モックデータ（旧。現在は Supabase 接続済み）
        └── [id]/                    # /mentors/[id] — メンター詳細
            ├── page.tsx             # 254行
            └── reserve/
                ├── page.tsx         # 23行（認証ガード）
                └── ReserveForm.tsx  # 予約フォーム
```

**その他 mentor 関連:**
```
src/app/admin/mentors/page.tsx               # 212行（admin メンター管理）
src/app/api/mentor-reservations/route.ts     # 予約 API Route
src/app/career-consultation/               # /career-consultation（別ページ群、/mentors とは別系統）
```

### ページの役割整理

| URL | ファイル | 役割 | 行数 |
|-----|----------|------|------|
| `/mentor` | `src/app/mentor/page.tsx` | メンター制度説明LP（静的・認証不要） | 479行 |
| `/mentors` | `src/app/(jobseeker)/mentors/page.tsx` | メンター一覧・検索（Supabase, `?dept=&theme=`） | 280行 |
| `/mentors/[id]` | `src/app/(jobseeker)/mentors/[id]/page.tsx` | メンター詳細 | 254行 |
| `/mentors/[id]/reserve` | `src/app/(jobseeker)/mentors/[id]/reserve/page.tsx` | 予約フォーム（認証必須） | 23行 |
| `/admin/mentors` | `src/app/admin/mentors/page.tsx` | 管理者向けメンター管理 | 212行 |

---

### 2-2. 内部リンク一覧

#### `/mentors` への参照（13箇所）

| ファイル | 行番号 | 該当コード |
|----------|--------|------------|
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 759 | `href="/mentors"` |
| `src/app/(jobseeker)/mentors/[id]/page.tsx` | 67 | `<Link href="/mentors" ...>先輩に相談</Link>` |
| `src/app/(jobseeker)/mentors/[id]/page.tsx` | 236 | `<Link href="/mentors" ...>` |
| `src/app/(jobseeker)/mentors/[id]/reserve/ReserveForm.tsx` | 252 | `<Link href="/mentors" ...>先輩に相談</Link>` |
| `src/app/(jobseeker)/mentors/[id]/reserve/ReserveForm.tsx` | 323 | `<Link href="/mentors" ...>` |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | 545 | `<a href="/mentors" ...>メンターを探す →</a>` |
| `src/app/(jobseeker)/mypage/conversations/page.tsx` | 175 | `href="/mentors"` |
| `src/app/mypage/mockMypageData.ts` | 300 | `href: "/mentors"` |
| `src/app/mypage/mockMypageData.ts` | 308 | `href: "/mentors"` |
| `src/app/mypage/mockMypageData.ts` | 316 | `href: "/mentors"` |
| `src/components/jobseeker/JobseekerFooter.tsx` | 46 | `{ href: "/mentors", label: "先輩に相談" }` |
| `src/components/jobseeker/JobseekerHeader.tsx` | 13 | `{ href: "/mentors", label: "メンター" }` |
| `src/app/(jobseeker)/mentors/page.tsx` | 106 | `href={\`/mentors/${mentor.id}\`}` *(動的リンク)* |

#### `/mentor` への参照（1箇所）

| ファイル | 行番号 | 該当コード |
|----------|--------|------------|
| `src/components/jobseeker/JobseekerFooter.tsx` | 47 | `{ href: "/mentor", label: "メンター制度" }` |

---

### 2-3. 動的ルート

| 動的ルートパターン | ファイル | 行番号 | 用途 |
|-------------------|----------|--------|------|
| `/mentors/${mentor.id}` | `src/app/(jobseeker)/mentors/page.tsx` | 106 | メンター一覧 → 詳細リンク |
| `/mentors/${mentor.id}/reserve` | `src/app/(jobseeker)/mentors/[id]/page.tsx` | 177 | 詳細 → 予約ページ |
| `/mentors/${mentor.id}` | `src/app/(jobseeker)/mentors/[id]/reserve/ReserveForm.tsx` | 254 | パンくず「{mentor.name}さん」 |
| `/mentors/${params.id}/reserve` | `src/app/(jobseeker)/mentors/[id]/reserve/page.tsx` | 14 | 未認証時 redirect の `next=` パラメータ |
| `/mentors/${subject.mentor_id}` | `src/app/(jobseeker)/articles/[slug]/page.tsx` | 71 | 記事内メンターリンク |
| `/mentors/${subject.mentor_id}/reserve` | `src/app/(jobseeker)/articles/[slug]/page.tsx` | 227 | 記事内「予約する」ボタン |

**`/mentor` の動的ルートは存在しない**（LPのため固定コンテンツ）。

---

### 2-4. ナビゲーション

#### ヘッダー（`src/components/jobseeker/JobseekerHeader.tsx`）

| 行番号 | 内容 |
|--------|------|
| 13 | `{ href: "/mentors", label: "メンター" }` — NAV_LINKS 配列に含まれる |

`/mentor`（LP）へのリンクはヘッダーに**ない**。

#### フッター（`src/components/jobseeker/JobseekerFooter.tsx`）

| 行番号 | 内容 |
|--------|------|
| 46 | `{ href: "/mentors", label: "先輩に相談" }` — 求職者の方セクション |
| 47 | `{ href: "/mentor", label: "メンター制度" }` — 求職者の方セクション（直下の行） |

フッターでは `/mentors` と `/mentor` が**隣接して**配置されている。

---

### 2-5. SEO・OGP

#### metadata 設定

| ページ | title | description | openGraph |
|--------|-------|-------------|-----------|
| `/mentors` | `先輩に相談する — Opinio` | `LayerX・SmartHR・Ubie・Notionなど、IT/SaaS業界の先輩社員・元社員に直接キャリア相談。` | なし |
| `/mentor` | `メンター制度 | Opinio Work` | `Opinio Workのメンターは、キャリアの経験を次の世代の意思決定に渡す存在です。` | なし |

#### canonical タグ
両ページとも canonical タグの明示的な設定は**なし**。Next.js 14 のデフォルト動作（URL自体がcanonical）に依存。

#### sitemap.ts（`src/app/sitemap.ts`）
**`/mentors` も `/mentor` も sitemap に含まれていない。** sitemap に含まれる URL は以下:
- `/`（トップ）
- `/jobs`
- `/companies`
- `/career-consultation`
- `/articles`
- `/jobs/{id}` 系
- `/companies/{id}` 系
- `/articles/{slug}` 系

#### robots.ts（`src/app/robots.ts`）
- `allow: "/"` — 全体許可
- `disallow: ["/admin/", "/api/", "/profile/setup"]`
- `/mentors` および `/mentor` に対する特別な disallow はなし

**→ sitemap 未記載だが robots でクロール許可されているため、Googlebot がリンクを辿ればインデックスされる可能性がある。**

---

### 2-6. リダイレクト設定

#### next.config.mjs — 既存リダイレクト

| source | destination | permanent |
|--------|-------------|-----------|
| `/for-companies` | `/business` | true（301） |
| `/biz/company/employees/categories` | `/biz/organization` | true（301） |
| `/biz/company/employees/categories/:path*` | `/biz/organization/:path*` | true（301） |

**`/mentors` または `/mentor` に関するリダイレクトは現在ない。**

#### middleware.ts
`/mentors` および `/mentor` 系の URL 書き換え・リダイレクト設定は**なし**。
middleware は `/biz/` と `/admin/` の認証チェックのみ担当。
（`/mentors/[id]/reserve` の認証ガードは `page.tsx` 内の `redirect()` で処理）

---

### 2-7. データベース・API

#### データ取得方法

| ページ | 取得方法 | テーブル | カラム/フィルター |
|--------|----------|----------|------------------|
| `/mentors` 一覧 | `getMentors(filter?)` via `src/lib/supabase/queries.ts:852` | `ow_mentors` | `display_order ASC`, optional `dept` / `theme` フィルター |
| `/mentors/[id]` 詳細 | `getMentorById(id)` via `src/lib/supabase/queries.ts:879` | `ow_mentors` | `.eq("id", id).single()` |
| `/mentor` LP | Supabase 接続なし（静的コンテンツ） | — | — |

#### 検索クエリパラメータ仕様（`/mentors`）

| パラメータ名 | 型 | 用途 |
|-------------|---|------|
| `dept` | `string` | 職種カテゴリフィルター（例: `product_manager`） |
| `theme` | `string` | 相談テーマフィルター（例: `転職活動の進め方`） |

#### API Route

| パス | ファイル | 用途 |
|------|----------|------|
| `/api/mentor-reservations` | `src/app/api/mentor-reservations/route.ts` | 予約 POST/GET（`ow_mentors`, `ow_mentor_reservations` テーブル） |
| `/api/consultation/book` | `src/app/api/consultation/book/route.ts` | 相談予約（`ow_mentors` 参照） |

#### Supabase テーブル参照まとめ

| ファイル | 行番号 | テーブル名 | 操作 |
|----------|--------|-----------|------|
| `src/lib/supabase/queries.ts` | 855, 882 | `ow_mentors` | SELECT |
| `src/app/(jobseeker)/mypage/page.tsx` | 238 | `ow_mentor_reservations` | SELECT |
| `src/app/(jobseeker)/mypage/page.tsx` | 248 | `ow_mentors` | SELECT |
| `src/app/admin/mentors/page.tsx` | 32, 56, 81 | `ow_mentors` | SELECT/UPDATE |
| `src/app/api/mentor-reservations/route.ts` | 62, 75, 104 | `ow_mentors`, `ow_mentor_reservations` | SELECT/INSERT |
| `src/app/api/consultation/book/route.ts` | 27 | `ow_mentors` | SELECT |
| `src/app/career-consultation/page.tsx` | 18 | `ow_mentors` | SELECT |
| `src/app/career-consultation/[id]/page.tsx` | 49 | `ow_mentors` | SELECT |

---

## 3. 影響範囲評価（リスクマトリクス）

| リスク項目 | 現状 | 評価 | 根拠 |
|-----------|------|------|------|
| **内部リンク切れ** | `/mentors` へのリンク13箇所 | 中（修正必須） | ヘッダー・フッター・各詳細ページ・マイページに散在。漏れがあると404が発生する |
| **SEO（/mentors インデックス）** | sitemap 未記載、robots 許可 | 低〜中 | sitemap がないため主動線ではないが、リンクが多くクロールされている可能性は十分ある |
| **SEO（/mentor インデックス）** | sitemap 未記載、footer 1リンクのみ | 低 | 外部リンクが多くない限りインデックスされにくい |
| **ブックマークリスク（/mentors）** | ヘッダー常設 → ユーザーが直接URLを知っている | 低〜中 | URLが変わったことに気づかないユーザーが404に遭遇する可能性 |
| **ブックマークリスク（/mentor）** | footer の1箇所のみ | 低 | LP として新設されたページで外部認知が少ない |
| **301リダイレクトなし時の混乱** | 既存リダイレクト設定なし | 高（移行時に必須） | 301がなければ SEO評価が引き継がれず、旧URLが404になる |
| **動的ルート（/mentors/[id]）への影響** | 6箇所でハードコード | 中 | `/mentors/search/[id]` に変更する場合はすべての動的リンクも更新必要 |
| **API Route への影響** | `/api/mentor-reservations` | なし | API パスは `/api/` プレフィックス。URL変更の影響を受けない |
| **articles ページからの参照** | 2箇所（動的生成） | 中 | `subject.mentor_id` を使った動的リンクが `/mentors/${id}` を参照 |

---

## 4. 推奨される移行ステップ（フェーズ分け）

### 案A vs 案B の比較

| 観点 | 案A（新規 `/mentors/search` を先に作る → 旧 `/mentors` に301） | 案B（既存 `/mentors` をリネーム → 301追加） |
|------|------|------|
| **本番環境での404リスク** | ゼロ（旧URLが生きたまま新URL整備） | 一時的に高（デプロイ順序による） |
| **コードの複雑さ** | 一時的に2ファイル共存（混乱しやすい） | 1ファイル → すっきりした構成 |
| **内部リンク修正タイミング** | 新URL確認後に一括修正できる | リネームと同時に必須 |
| **Vercel PR 分割** | 2PR（①新URL作成 ②旧URL削除 + リダイレクト） | 1PR（ただし慎重なテストが必要） |
| **ロールバックしやすさ** | しやすい（新URLを削除するだけ） | やや難（ファイル移動を戻す必要） |
| **推奨** | ✅ **推奨** | — |

### 推奨移行手順（案A ベース）

#### Phase 1（PR #1）: 新 URL の準備
1. `src/app/(jobseeker)/mentors/search/page.tsx` を新規作成
   - 既存 `mentors/page.tsx` の内容をほぼコピー
   - `MentorFilterBar` は既存コンポーネントをそのまま再利用
2. 動作確認: `/mentors/search` で一覧が表示されること
3. **旧 `/mentors` はそのまま残す**（リンク切れなし）

#### Phase 2（PR #2）: 内部リンクの一括更新
以下13箇所のリンクを `/mentors` → `/mentors/search` に更新する:

| ファイル | 行番号 | 変更内容 |
|----------|--------|---------|
| `src/components/jobseeker/JobseekerHeader.tsx` | 13 | `href: "/mentors"` → `href: "/mentors/search"` |
| `src/components/jobseeker/JobseekerFooter.tsx` | 46 | `href: "/mentors"` → `href: "/mentors/search"` |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 759 | `href="/mentors"` → `href="/mentors/search"` |
| `src/app/(jobseeker)/mentors/[id]/page.tsx` | 67, 236 | breadcrumb・戻るリンク |
| `src/app/(jobseeker)/mentors/[id]/reserve/ReserveForm.tsx` | 252, 323 | breadcrumb・戻るリンク |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | 545 | `href="/mentors"` → `href="/mentors/search"` |
| `src/app/(jobseeker)/mypage/conversations/page.tsx` | 175 | `href="/mentors"` → `href="/mentors/search"` |
| `src/app/mypage/mockMypageData.ts` | 300, 308, 316 | `href: "/mentors"` → `href: "/mentors/search"` |

**動的ルート `/mentors/[id]` は変更不要**（一覧ページのURL変更のみであるため）。

#### Phase 3（PR #3）: 旧 URL の301リダイレクト設定 + 旧ファイル削除
1. `next.config.mjs` に追加:
   ```js
   {
     source: "/mentors",
     destination: "/mentors/search",
     permanent: true, // 301
   },
   ```
2. 旧 `src/app/(jobseeker)/mentors/page.tsx` を削除
3. sitemap.ts に `/mentors/search` を追加することを検討

#### 301リダイレクトのタイミング
- **Phase 2（内部リンク更新）と Phase 3（リダイレクト設定）は同じ PR またはすぐ連続した PR で実施**すること
- 「内部リンクを直したが旧 `/mentors` がまだある状態（リダイレクトなし）」期間を長く置くと、外部ブックマークユーザーが旧URLへのアクセスを続けてしまう

---

## 5. 未確定論点（Hisatoの判断が必要な事項）

1. **`/mentors/search` という URL で確定か？**
   - 代替案: `/mentors/list`、`/mentors/explore`、そのまま `/mentors` を維持して `/mentor` を `/mentor-program` に変更するなど
   - ヘッダーに表示している「メンター」リンクが `/mentors/search` になるのは長い印象もある

2. **`/mentors/[id]` の詳細ページはどうするか？**
   - 一覧が `/mentors/search` になっても詳細を `/mentors/[id]` のままにするのか、`/mentors/search/[id]` にするのか
   - URLの意味論: `/mentors/[id]` の方が綺麗（search の子ではない）

3. **sitemap への追加タイミング**
   - 現在 `/mentors` も `/mentor` も sitemap に含まれていない
   - 移行後に sitemap へ追加する場合、どちらを追加するか（`/mentors/search` か `/mentors` の301先か）

4. **ヘッダーのラベル「メンター」をどう扱うか？**
   - 現在ヘッダーリンクは `{ href: "/mentors", label: "メンター" }` 1つのみ
   - 移行後: 「メンター一覧」と「メンター制度」の2リンクをヘッダーに追加するか？それとも `/mentor`（LP）はフッターのみで十分か？

5. **`/career-consultation` との関係整理**
   - `src/app/career-consultation/` にも `ow_mentors` テーブルを使った別のメンター関連ページが存在する
   - `/mentors`（検索・予約）と `/career-consultation` の UI 的・機能的な棲み分けが不明確な可能性がある
   - URL整理の機会に両者の関係を整理するか？

---

## 6. 想定工数

| フェーズ | 内容 | 想定工数 |
|---------|------|---------|
| Phase 1 | `/mentors/search` 新規ページ作成（コンポーネント再利用） | 0.5〜1h |
| Phase 2 | 内部リンク13箇所の一括更新 | 0.5h |
| Phase 3 | next.config.mjs リダイレクト設定 + 旧ファイル削除 | 0.5h |
| QA | ローカルとプレビュー環境での動作確認 | 1h |
| **合計** | | **2.5〜3h** |

**前提条件**: `/mentors/[id]` の詳細ページURLは変更しない（`/mentors/search` の子ページにしない）場合の工数。詳細ページURLも変更する場合は +1〜1.5h 追加。
