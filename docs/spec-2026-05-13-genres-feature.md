# 企業ジャンル別カルーセル機能 — 実装仕様書

作成日: 2026-05-13
対象: Opinio Work (`/Users/hisato/opinio-work/`)
担当: Claude Code

---

## 1. 概要

`/companies` ページを「30社フラット一覧」から「ジャンル別カルーセル」形式に再構築する。
NetflixやSpotifyのような編集メディア型UIで、IT/SaaS業界の企業を8ジャンルに分類して横スクロールで見せる。

### 8ジャンル
1. 外資系 (foreign-capital)
2. ホリゾンタルSaaS (horizontal-saas)
3. バーティカルSaaS (vertical-saas)
4. メガベンチャー (mega-venture)
5. シード〜シリーズA (early-stage)
6. AI・LLM特化 (ai-llm)
7. DX/コンサル (dx-consulting)
8. IPO準備中 (ipo-ready)

### データモデル原則
- 1企業に複数ジャンル可（多対多）
- AI推定と人間承認の両方を記録（将来のAI自動分類に備える）
- 開発段階はダミー30社にランダムでタグ付与（seed 046）

---

## 2. 実装範囲

| Phase | 内容 |
|---|---|
| A | DBスキーマ + マスター + ダミーseed（migration 044, 045, 046） |
| B | 型定義 + データ取得関数 |
| C | UIコンポーネント3つ新規 + `/companies` ページ修正 |

---

## 3. 事前確認（実装前に必ず実行）

```bash
# ハンドオフ確認
cat docs/handover-2026-05-12-nu8-stage7-f-phase-*.md

# 既存資産確認
ls src/components/ui/
ls src/app/
ls src/types/

# 既存スキーマ・命名規則確認
cat supabase/migrations/043_*.sql
# → updated_at トリガー関数名を確認（update_updated_at_column かどうか）
# → RLSポリシーの命名規則を確認

# Company型のフィールド確認
grep -r "type Company" src/types/ || grep -r "interface Company" src/types/
```

### 重要な確認ポイント
- `ow_companies` テーブルの実際のカラム名（下記の仕様は推測ベース）
  - 業界（industry?）
  - シリーズ（series? funding_stage?）
  - 従業員数（employee_count? employees?）
  - 面談受付（accepting_interview? interview_open?）
  - 働き方（work_style? work_arrangement?）
- 違う場合は実スキーマに合わせて型と SELECT を修正すること

---

## 4. Phase A：DBスキーマ + seed

### 4-1. `supabase/migrations/044_create_genres_tables.sql`

```sql
-- 044_create_genres_tables.sql
-- 企業ジャンル機能：マスターテーブルと中間テーブルを作成

CREATE TABLE IF NOT EXISTS ow_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ow_genres_active_order
  ON ow_genres(is_active, display_order)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS ow_company_genres (
  company_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES ow_genres(id) ON DELETE CASCADE,
  ai_confidence numeric(3,2),
  is_ai_suggested boolean NOT NULL DEFAULT false,
  is_human_approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES ow_users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, genre_id)
);

CREATE INDEX idx_ow_company_genres_genre_approved
  ON ow_company_genres(genre_id, is_human_approved)
  WHERE is_human_approved = true;

CREATE INDEX idx_ow_company_genres_company
  ON ow_company_genres(company_id);

ALTER TABLE ow_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_company_genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active genres"
  ON ow_genres FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can read approved company genres"
  ON ow_company_genres FOR SELECT
  USING (is_human_approved = true);

CREATE TRIGGER set_updated_at_ow_genres
  BEFORE UPDATE ON ow_genres
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 4-2. `supabase/migrations/045_seed_genres.sql`

```sql
-- 045_seed_genres.sql
-- ジャンルマスター初期データ

INSERT INTO ow_genres (slug, name, description, display_order) VALUES
  ('foreign-capital',    '外資系',             'グローバル基盤で働く',         1),
  ('horizontal-saas',    'ホリゾンタルSaaS',   '業界横断のプロダクト',         2),
  ('vertical-saas',      'バーティカルSaaS',   '業界特化のプロダクト',         3),
  ('mega-venture',       'メガベンチャー',     '規模感とスピードの両立',       4),
  ('early-stage',        'シード〜シリーズA',  '創業期の手触り感',             5),
  ('ai-llm',             'AI・LLM特化',        '最先端領域',                   6),
  ('dx-consulting',      'DX/コンサル',        '大企業変革に関わる',           7),
  ('ipo-ready',          'IPO準備中',          '上場前の成長フェーズ',         8)
ON CONFLICT (slug) DO NOTHING;
```

### 4-3. `supabase/migrations/046_seed_dummy_company_genres.sql`

```sql
-- 046_seed_dummy_company_genres.sql
-- 開発用：ダミー30社にランダムでジャンルタグを付与
-- 本番企業が登録された後は不要

DO $$
DECLARE
  company_rec record;
  genre_ids uuid[];
  num_genres int;
  selected_idx int;
  used_indices int[];
  i int;
BEGIN
  SELECT array_agg(id ORDER BY display_order) INTO genre_ids FROM ow_genres;

  IF genre_ids IS NULL OR array_length(genre_ids, 1) = 0 THEN
    RAISE NOTICE 'No genres found. Run migration 045 first.';
    RETURN;
  END IF;

  FOR company_rec IN
    SELECT id FROM ow_companies WHERE name LIKE 'テスト株式会社%'
  LOOP
    num_genres := 1 + floor(random() * 3)::int;
    used_indices := ARRAY[]::int[];

    FOR i IN 1..num_genres LOOP
      selected_idx := 1 + floor(random() * array_length(genre_ids, 1))::int;

      IF NOT (selected_idx = ANY(used_indices)) THEN
        used_indices := array_append(used_indices, selected_idx);

        INSERT INTO ow_company_genres (
          company_id, genre_id, is_human_approved, approved_at
        ) VALUES (
          company_rec.id, genre_ids[selected_idx], true, now()
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
```

---

## 5. Phase B：型 + API

### 5-1. `src/types/genre.ts`

```typescript
export type Genre = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type CompanyForCarousel = {
  id: string;
  name: string;
  industry: string | null;
  series: string | null;
  employee_count: number | null;
  description: string | null;
  accepting_interview: boolean;
  work_style: string | null;
  job_count: number;
  updated_at: string;
};

export type GenreWithCompanies = Genre & {
  companies: CompanyForCarousel[];
  total_count: number;
};
```

※ `CompanyForCarousel` のフィールドは既存 `ow_companies` スキーマに合わせて調整すること

### 5-2. `src/lib/genres.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type { GenreWithCompanies, CompanyForCarousel } from '@/types/genre';

const CAROUSEL_LIMIT = 9;

export async function fetchGenresWithCompanies(): Promise<GenreWithCompanies[]> {
  const supabase = createClient();

  const { data: genres, error: genresError } = await supabase
    .from('ow_genres')
    .select('id, slug, name, description, display_order, is_active')
    .eq('is_active', true)
    .order('display_order');

  if (genresError || !genres) {
    console.error('Failed to fetch genres:', genresError);
    return [];
  }

  const results = await Promise.all(
    genres.map(async (genre) => {
      const { data: links, count } = await supabase
        .from('ow_company_genres')
        .select(`
          company_id,
          ow_companies!inner (
            id, name, industry, series, employee_count,
            description, accepting_interview, work_style, updated_at
          )
        `, { count: 'exact' })
        .eq('genre_id', genre.id)
        .eq('is_human_approved', true)
        .order('created_at', { ascending: false })
        .limit(CAROUSEL_LIMIT);

      const companies: CompanyForCarousel[] = (links ?? [])
        .map((link: any) => ({
          ...link.ow_companies,
          job_count: 0,
        }));

      return {
        ...genre,
        companies,
        total_count: count ?? 0,
      };
    })
  );

  return results;
}
```

---

## 6. Phase C：UI

### 6-1. `src/components/companies/CompanyCardCompact.tsx`

```tsx
import Link from 'next/link';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  company: CompanyForCarousel;
};

const LOGO_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-pink-100 text-pink-800',
];

function getLogoColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

export function CompanyCardCompact({ company }: Props) {
  const initial = company.name.slice(0, 1);
  const logoClass = getLogoColor(company.name);
  const meta = [
    company.industry,
    company.series,
    company.employee_count ? `${company.employee_count}名` : null,
  ].filter(Boolean).join('・');

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
    >
      <div className="flex gap-2 items-center mb-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0 ${logoClass}`}>
          {initial}
        </div>
        <p className="text-xs font-medium truncate">{company.name}</p>
      </div>
      <p className="text-[10px] text-gray-500 mb-1.5 truncate">{meta || '—'}</p>
      <div className="flex gap-1 flex-wrap">
        {company.accepting_interview && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
            面談OK
          </span>
        )}
        {company.work_style && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {company.work_style}
          </span>
        )}
      </div>
    </Link>
  );
}
```

### 6-2. `src/components/companies/GenreCarousel.tsx`

```tsx
'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CompanyCardCompact } from './CompanyCardCompact';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  companies: CompanyForCarousel[];
};

export function GenreCarousel({ companies }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 660;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (companies.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-500">このジャンルの企業は準備中です</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide"
      >
        {companies.map((company) => (
          <div key={company.id} className="flex-shrink-0 w-[200px] snap-start">
            <CompanyCardCompact company={company} />
          </div>
        ))}
      </div>

      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="前へ"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="次へ"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
```

スクロールバー非表示用CSS（globals.cssに追加、既にあればスキップ）:

```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

### 6-3. `src/components/companies/GenreSection.tsx`

```tsx
import Link from 'next/link';
import { GenreCarousel } from './GenreCarousel';
import type { GenreWithCompanies } from '@/types/genre';

type Props = {
  genre: GenreWithCompanies;
};

export function GenreSection({ genre }: Props) {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-baseline mb-2">
        <div>
          <h2 className="text-base font-medium inline">{genre.name}</h2>
          {genre.description && (
            <span className="text-xs text-gray-500 ml-2">
              {genre.description}
              {genre.total_count > 0 && ` ・ ${genre.total_count}社`}
            </span>
          )}
        </div>
        {genre.total_count > 0 && (
          <Link
            href={`/companies?genre=${genre.slug}`}
            className="text-xs text-blue-600 hover:underline"
          >
            すべて見る →
          </Link>
        )}
      </div>
      <GenreCarousel companies={genre.companies} />
    </section>
  );
}
```

### 6-4. `src/app/(seeker)/companies/page.tsx`（修正）

```tsx
import { fetchGenresWithCompanies } from '@/lib/genres';
import { GenreSection } from '@/components/companies/GenreSection';

export default async function CompaniesPage() {
  const genresWithCompanies = await fetchGenresWithCompanies();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">Opinio / 企業を知る</p>
        <h1 className="text-2xl font-medium mb-1" style={{ fontFamily: 'serif' }}>
          企業を、知る。
        </h1>
        <p className="text-sm text-gray-500">
          IT/SaaS業界をジャンル別に。気になる1社が必ず見つかる。
        </p>
      </div>

      <div className="mt-6">
        {genresWithCompanies.map((genre) => (
          <GenreSection key={genre.id} genre={genre} />
        ))}
      </div>
    </div>
  );
}
```

※ 既存の `/companies/page.tsx` のパス（`src/app/(seeker)/companies/page.tsx` 想定）を確認の上で正しい場所を修正すること

---

## 7. 完了条件

- [ ] migration 044, 045, 046 が Supabase に適用済み
- [ ] ローカルで `/companies` を開くと8ジャンルがカルーセル表示される
- [ ] ダミー30社が複数のジャンルに分散して表示される
- [ ] 「面談OK」バッジが正しく出る企業/出ない企業がある
- [ ] 左右ボタンで横スクロールが動作する
- [ ] カードクリックで `/companies/[id]` に遷移する
- [ ] `npm run build` がエラーゼロで通る
- [ ] Vercel deployments の最新が ● Ready

---

## 8. 残課題（このフェーズでは対応しない）

1. ジャンル別詳細ページ（`/companies?genre=xxx` のフィルタ表示）
2. 管理画面でのジャンルタグ手動付与UI
3. AI推定機能（Claude APIで企業説明からジャンル推定）
4. `job_count` の `ow_jobs` JOIN による実数取得
5. モバイル対応のタッチスワイプ最適化

---

## 9. ハンドオフ

完了後、`docs/handover-2026-05-13-genres-feature.md` を作成し以下を記録：

- 実装した内容のサマリ
- 既存スキーマとの差分（特に `ow_companies` のカラム名で調整した箇所）
- 動作確認結果
- 残課題の現状
- 次フェーズ（管理画面・AI推定）の検討メモ
