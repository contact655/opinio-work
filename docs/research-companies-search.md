# /companies 検索・フィルタ機能 実装仕様書

**作成日**: 2026-05-17
**作成**: Hisato + Claude (Opus 4.7, design session)
**Claude Code への依頼**: 本仕様書に基づく事前調査、実装、ビルド、push、デプロイ確認まで
**前提**: 同日リリースされた /companies カルーセル再設計（commit `e7746b4`）の上に積み増し

---

## 0. 背景と方針

### 0.1 議論の経緯
- 当初「自然言語検索」の要望があったが、コスト懸念から技術レベルを段階的に整理
- 技術レベル1（純粋なキーワード検索）〜レベル4（LLM ベース）を比較
- **「コストをかけずに今やる + 将来拡張可能にする」** という方針で確定

### 0.2 確定した方向性

| 項目 | 確定内容 |
|---|---|
| 検索の位置付け | 用途A: ジャンル主導、検索は補助手段 |
| 技術レベル | レベル1+2（PostgreSQL 標準機能、コストほぼゼロ） |
| 将来拡張 | レベル3（pgvector ベクトル検索）、レベル4（LLM）への拡張余地を確保 |
| 検索ボックス配置 | `/companies` ヒーロー下に配置 |
| 検索結果表示 | 検索/フィルタ適用時はカルーセル → 5列グリッドに切替 |
| フィルタ軸 | 業種、従業員規模、勤務形態、募集中フラグ |
| 結合論理 | AND（厳格、すべての条件を満たす企業） |
| URL 設計 | クエリパラメータ方式 `/companies?q=...&industry=...` |
| キーワード検索手法 | ILIKE ベース（ローンチ時の34社規模で十分）、将来 pg_trgm or tsvector に拡張 |

### 0.3 既存実装の前提（引き継ぎ書 2026-05-16 より）
- プロジェクトパス: `/Users/hisato/opinio-work/`
- データベース: Supabase（project: xtutnecqeamftygufxco）
- 主要テーブル: `ow_companies`, `ow_jobs`, `ow_company_genres`, `ow_genres`
- 公開済み企業: 31社、未公開: 3社、合計34社
- 同日先行コミット `e7746b4`: カルーセル5列、peek効果、CompanyCardCompact

---

## 1. 影響範囲

### 1.1 推定される変更対象ファイル

事前に Claude Code が `ls src/app/companies/`, `ls src/components/companies/` で既存資産を確認:

- `/companies` ページのページコンポーネント
  - 想定パス: `src/app/companies/page.tsx`
  - 検索パラメータの読み取り、Server Component 内での条件分岐（カルーセル or グリッド）
- 新規: 検索ボックス + フィルタバーのクライアントコンポーネント
  - 想定パス: `src/components/companies/CompanySearchBar.tsx`
  - クライアントコンポーネント（useRouter, useSearchParams）
- 新規: 検索結果グリッドのコンポーネント
  - 想定パス: `src/components/companies/CompanySearchResults.tsx`
  - サーバーで検索 → 結果を5列グリッドで表示
- 新規: 検索ロジックの抽象化レイヤー
  - 想定パス: `src/lib/search/companies.ts`
  - 関数 `searchCompanies({ q, industry, size, workStyle, hiring })`
- 既存: `CompanyCardCompact` はそのまま流用（カルーセルでもグリッドでも同じカード）

### 1.2 データモデル変更

**マイグレーション**: 不要（ローンチ時点では ILIKE で十分高速）。

**ただし将来拡張のため、以下のマイグレーションを将来用に文書化（今は実行しない）**:

```sql
-- 将来の拡張1: pg_trgm 拡張による日本語部分一致の高速化（必要になったら実行）
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_ow_companies_name_trgm ON ow_companies USING gin (name gin_trgm_ops);
-- CREATE INDEX idx_ow_companies_description_trgm ON ow_companies USING gin (description gin_trgm_ops);

-- 将来の拡張2: pgvector によるセマンティック検索（必要になったら実行）
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE ow_companies ADD COLUMN embedding vector(1536);
-- CREATE INDEX idx_ow_companies_embedding ON ow_companies USING ivfflat (embedding vector_cosine_ops);
```

---

## 2. UI仕様

### 2.1 全体構造

```
/companies ページ
├── 既存ヘッダー: 「Opinio / 企業を知る」
├── 既存タイトル: 「企業を、知る。」
├── 既存サブテキスト: 「IT/SaaS業界をジャンル別に...」
├── 新規: 検索ボックス
├── 新規: フィルタバー（業種・規模・勤務形態・募集中・クリア）
└── 条件分岐:
    ├── 検索/フィルタ未適用時: 既存のジャンル別カルーセル × 8（現状維持）
    └── 検索/フィルタ適用時: 「N件ヒット」+ 5列グリッド
```

### 2.2 検索ボックス

- 位置: タイトル「企業を、知る。」のサブテキスト直下
- 幅: 親コンテナの最大幅、最大 720px 程度
- プレースホルダー: 「キーワードで企業を探す（例: SaaS, セールス, AI）」
- 検索アイコン: 左端に🔍（lucide-react の Search アイコン推奨）
- 動作: 入力 → 300ms デバウンス → URL のクエリパラメータ `q` を更新 → Server Component が再フェッチ

### 2.3 フィルタバー

検索ボックス下に横並びで配置（モバイルは折り返し）:

| フィルタ | UI | 選択肢 | クエリパラメータ |
|---|---|---|---|
| 業種 | ドロップダウン | 動的（`ow_companies.industry` の distinct） | `industry=SaaS` |
| 従業員規模 | ドロップダウン | `〜50名` / `50〜200名` / `200〜1000名` / `1000名〜` | `size=under-50` `50-200` `200-1000` `1000-plus` |
| 勤務形態 | ドロップダウン | `on_site` / `hybrid` / `full_remote` | `workStyle=hybrid` |
| 募集中フラグ | チェックボックス | ON/OFF | `hiring=1` |
| クリア | テキストボタン | 全フィルタリセット | （全パラメータ削除） |

### 2.4 検索結果グリッド

- レイアウト: 5列グリッド（カルーセルと同じカード幅・gap・peek なし）
- カードコンポーネント: `CompanyCardCompact` をそのまま流用
- ヘッダー: 「N件ヒット」+ 適用中のフィルタチップ（クリックで削除可能）
- ゼロヒット時: 「該当する企業が見つかりませんでした」+ 「フィルタをクリア」ボタン
- レスポンシブ: カルーセルと同じブレークポイント
  - モバイル: 1列
  - タブレット: 2列
  - 1024〜1280px: 3列
  - 1281px〜: 5列

### 2.5 デザイントークン

カルーセル再設計（commit `e7746b4`）と同じトークンを踏襲。

検索ボックス・フィルタの追加トークン:

| トークン | 値 | 用途 |
|---|---|---|
| `--input-bg` | `#ffffff` | 検索ボックス背景 |
| `--input-border` | `#e6e9ef` | 検索ボックス境界 |
| `--input-border-focus` | `#1e63d8` | フォーカス時境界（accent） |
| `--filter-active-bg` | `#eaf1fc` | フィルタアクティブ時背景（accent-soft） |
| `--filter-active-text` | `#1e63d8` | フィルタアクティブ時文字色 |

---

## 3. 技術仕様

### 3.1 検索ロジックの抽象化レイヤー

**ファイル**: `src/lib/search/companies.ts`

```typescript
export type CompanySearchParams = {
  q?: string;              // フリーワード
  industry?: string;       // 業種
  size?: 'under-50' | '50-200' | '200-1000' | '1000-plus';
  workStyle?: 'on_site' | 'hybrid' | 'full_remote';
  hiring?: boolean;        // 募集中のみ
};

export type CompanySearchResult = {
  companies: Company[];    // 検索結果
  totalCount: number;      // 総件数
  appliedFilters: CompanySearchParams;
};

export async function searchCompanies(
  params: CompanySearchParams
): Promise<CompanySearchResult> {
  // 内部実装は隠蔽 - 今は Supabase + ILIKE、将来は embedding 検索などに差し替え可能
}
```

**重要な設計原則**:
- UI 側からは `searchCompanies` 関数1つを呼ぶだけ
- 内部の SQL クエリは将来差し替え可能（pg_trgm, tsvector, pgvector への移行を阻害しない）
- 戻り値の型 `CompanySearchResult` は安定的（将来 `relevanceScore` 等を追加可能）

### 3.2 Supabase クエリ実装（ローンチ時）

```typescript
async function searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult> {
  let query = supabase
    .from('ow_companies')
    .select('*, ow_jobs(count)', { count: 'exact' })
    .eq('is_published', true);

  // フリーワード検索: name OR description OR industry を ILIKE
  if (params.q) {
    const pattern = `%${params.q}%`;
    query = query.or(
      `name.ilike.${pattern},description.ilike.${pattern},industry.ilike.${pattern}`
    );
  }

  // 業種フィルタ
  if (params.industry) {
    query = query.eq('industry', params.industry);
  }

  // 従業員規模フィルタ（employee_count は "1-10名" のような文字列）
  if (params.size) {
    const sizeRanges = {
      'under-50': ['1-10名', '11-50名'],
      '50-200': ['51-200名'],
      '200-1000': ['201-500名', '501-1000名'],
      '1000-plus': ['1001-5000名', '5001名以上']
    };
    query = query.in('employee_count', sizeRanges[params.size]);
  }

  // 勤務形態フィルタ（カラム名・実データ構造は事前調査で確認）
  if (params.workStyle) {
    query = query.eq('work_style', params.workStyle);
    // または ow_jobs の work_style と JOIN する可能性あり、調査必要
  }

  // 募集中フラグ（ow_jobs の存在チェック）
  // 実装は事前調査で確認、おそらく以下のいずれか:
  // - ow_companies に hiring_count カラム
  // - ow_jobs を JOIN して count > 0
  // - サブクエリ
  if (params.hiring) {
    // 仮: ow_jobs を別途取得して JOIN
  }

  const { data, count, error } = await query.order('name');

  if (error) throw error;

  return {
    companies: data ?? [],
    totalCount: count ?? 0,
    appliedFilters: params,
  };
}
```

**注意**: 上記は雛形。`employee_count` の実フォーマット、`work_style` のカラム位置（companies テーブルか jobs テーブルか）、`is_published` の判定方法は **事前調査で確認** すること。

### 3.3 URL クエリパラメータ

- `q`: フリーワード（URLエンコード必須）
- `industry`: 業種
- `size`: `under-50` / `50-200` / `200-1000` / `1000-plus`
- `workStyle`: `on_site` / `hybrid` / `full_remote`
- `hiring`: `1`（ON時のみ）

**例**:
```
/companies?q=SaaS&size=200-1000&hiring=1
```

### 3.4 ページコンポーネントの構造

```typescript
// src/app/companies/page.tsx (Server Component)

type SearchParams = {
  q?: string;
  industry?: string;
  size?: string;
  workStyle?: string;
  hiring?: string;
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const hasAnyFilter = Boolean(
    params.q || params.industry || params.size || params.workStyle || params.hiring
  );

  return (
    <main>
      <Hero />
      <CompanySearchBar initialParams={params} />  {/* Client Component */}

      {hasAnyFilter ? (
        <CompanySearchResults params={params} />     {/* Server Component */}
      ) : (
        <GenreSections />                            {/* 既存実装、現状維持 */}
      )}
    </main>
  );
}
```

### 3.5 検索ボックス + フィルタの Client Component

- `useSearchParams()` で現在のクエリを読む
- `useRouter()` で push して URL 更新
- フリーワード入力は 300ms デバウンス（lodash.debounce or 自作）
- フィルタは即時反映

---

## 4. 実装の進め方

### 4.1 推奨手順

1. **事前調査** (Claude Code)
   - `ls src/app/companies/`, `ls src/components/companies/` でファイル特定
   - `ow_companies` テーブルのカラム構成確認（`employee_count` の実フォーマット、`work_style` の位置、`is_published` 等）
   - `ow_jobs` テーブルとの関連確認（募集中判定のため）
   - 業種フィルタの選択肢を動的に生成するためのデータ取得方法を検討

2. **実装** (Claude Code)
   - `src/lib/search/companies.ts` の新規作成（抽象化レイヤー）
   - `src/components/companies/CompanySearchBar.tsx` の新規作成
   - `src/components/companies/CompanySearchResults.tsx` の新規作成
   - `src/app/companies/page.tsx` の改修（検索バー追加、条件分岐）

3. **検証** (Claude Code)
   - `npm run build` 必須
   - 型エラー・lint エラーの解消
   - ローカルで `/companies` を開いて以下を目視確認:
     - 検索ボックス表示
     - キーワード入力で結果が絞り込まれる
     - 各フィルタが機能する
     - フィルタクリアボタンで全部リセットされる
     - ゼロヒット時の UX
     - URL がブラウザ履歴に正しく反映される

4. **デプロイ** (Claude Code)
   - `git add` → `git commit`（コミットメッセージは下記参照）
   - **`git push origin main` を必ず実行**
   - Vercel deployments で新しいデプロイを commit hash で目視確認

5. **動作確認** (Hisato)
   - 本番環境で `/companies` を開いて確認
   - 検索/フィルタ各種パターン
   - レスポンシブ動作

### 4.2 コミットメッセージ案

```
feat(companies): add keyword search and filters to /companies

- Add search bar in hero section with 300ms debounce
- Add filters: industry, employee size, work style, hiring flag (AND logic)
- Switch UI from genre carousels to 5-col grid when any filter is applied
- Implement abstraction layer src/lib/search/companies.ts for future extensibility
- Use ILIKE-based search (PostgreSQL standard) - extensible to pg_trgm/tsvector/pgvector
- Preserve existing carousel layout when no filter is applied

Refs: design session 2026-05-17, mock /companies?q=...&industry=...
```

---

## 5. 注意事項・既知の論点

### 5.1 既存の運用ルール（必須・厳守）

引き継ぎ書（2026-05-16）の運用ルール:
1. 新規実装後 `npm run build` 必須
2. **`git push origin main` を必ず実行**
3. Vercel deployments で commit hash 目視確認
4. 新規ルート前に `ls src/app/`、新規UIコンポーネント前に `ls src/components/ui/` で既存資産確認

### 5.2 既知のリスク・確認事項

- **employee_count の実フォーマット**: 「1-10名」のような文字列のはず（PR-βスレッドより）。実データを SELECT で確認すること
- **work_style のカラム位置**: `ow_companies` か `ow_jobs` のどちらに紐付くか要確認。両方の可能性あり
- **業種選択肢の重複**: `industry` カラムに表記揺れがある可能性（"SaaS" vs "saas" vs "ＳａａＳ"）。distinct で確認、必要なら正規化
- **募集中判定の効率**: 全企業に対して JOIN すると遅い可能性。集計カラム or サブクエリ for 効率化
- **デバウンスの実装**: lodash.debounce を入れるならパッケージ追加、自作なら useRef + setTimeout
- **検索結果の SEO**: 検索結果ページは noindex 推奨（クエリパラメータ毎に重複コンテンツ判定回避）

### 5.3 スコープ外（本タスクには含めない）

- ジャンルフィルタ（ジャンル別カルーセルが既にあるため、検索ページとの役割分担は将来検討）
- 面談OKフィルタ（実装容易だが今回のスコープ外）
- 平均年収・資金調達フェーズ等の追加フィルタ
- セマンティック検索（pgvector）
- LLM ベースの自然言語クエリ理解
- 検索結果のソート（マッチ度・新着順・規模順など）→ ローンチ時は name 順固定
- ページネーション → 34社規模なら全件表示で十分、ヒット数が増えたら別タスク
- 検索履歴・サジェスト機能

---

## 6. 完了基準

以下がすべて満たされたら完了:

- [ ] `/companies` ページに検索ボックスが表示される
- [ ] フィルタバー（業種・規模・勤務形態・募集中）が表示される
- [ ] キーワード検索が `name`/`description`/`industry` に対して機能する
- [ ] 各フィルタが個別に機能する
- [ ] 複数フィルタの AND 結合が正しく動作する
- [ ] フィルタクリアボタンで全リセットされる
- [ ] 検索/フィルタ未適用時はジャンル別カルーセル（現状維持）
- [ ] 検索/フィルタ適用時は5列グリッドに切り替わる
- [ ] ゼロヒット時のメッセージが表示される
- [ ] URL クエリパラメータが正しく反映される（ブラウザ戻る/進む対応）
- [ ] 抽象化レイヤー `src/lib/search/companies.ts` が独立した関数として実装されている
- [ ] レスポンシブ動作確認（モバイル・タブレット・PC）
- [ ] `npm run build` 成功
- [ ] `git push origin main` 実行
- [ ] Vercel で新しいデプロイが反映、本番で動作確認

---

## 7. 将来の拡張パス

本実装の上に積み上げる将来拡張のガイドライン:

### Phase 2: 日本語検索の精度向上
- pg_trgm 拡張を導入
- `name`, `description` に trigram インデックスを追加
- 表記揺れ（カタカナ・ひらがな・漢字）への耐性向上

### Phase 3: セマンティック検索（ベクトル検索）
- pgvector 拡張を導入
- `ow_companies.embedding` カラム追加
- OpenAI or Voyage API で企業説明文を embedding 化（初回 +追加時バッチ）
- `searchCompanies` 内部にスコアリング統合（ILIKE + embedding similarity）
- コスト: 月数百円〜数千円

### Phase 4: 自然言語クエリ理解
- ユーザーのフリーワードを Claude/GPT で解釈
- フィルタ条件への自動変換（「フルリモートで人事系のSaaS」→ filters）
- コスト: 1検索数円

### Phase 5: 追加フィルタ
- ジャンルフィルタ
- 面談OKフィルタ
- 平均年収レンジ
- 資金調達フェーズ

---

## 8. 参考: 設計議論サマリー（2026-05-17）

- 当初要望: フリーワード検索 + 自然言語検索（コスト懸念）
- コストレベルを4段階で整理 → レベル1+2（コストゼロ）に着地
- 用途を3パターンで整理 → 用途A（ジャンル主導、検索は補助）
- 配置・表示を4パターンで検討 → 配置A + 表示β（ヒーロー下ボックス + 検索時グリッド）
- フィルタ軸を3パターンで検討 → 必須セット（業種・規模・勤務形態・募集中）
- 抽象化の重要性を確認 → `searchCompanies` 関数1つに集約、将来の差し替え可能性を確保
