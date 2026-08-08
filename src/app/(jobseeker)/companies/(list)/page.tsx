import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAvailablePhases, fetchDistinctLocations, searchCompanies } from "@/lib/search/companies";
import { createPublicClient } from "@/lib/supabase/public";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";
import { RecentlyViewedSection } from "@/components/companies/RecentlyViewedSection";
import { GridSortBar } from "@/components/companies/GridSortBar";
import { CompanyCardList } from "@/components/companies/CompanyCardList";
import { CompanyAdminDndOverlay } from "@/components/companies/CompanyAdminDndOverlay";
import { featuredCompanyPrefix } from "@/lib/seo/featuredCompanies";

type MemberPreview = { id: string; name: string; photoUrl?: string | null };


// 企業名はベタ書きしない（理由は lib/seo/featuredCompanies.ts のコメント参照）。
// 一覧ページなので基準は "content"＝求人と記事の合計が多い順。
export async function generateMetadata(): Promise<Metadata> {
  const lead = await featuredCompanyPrefix("content");
  const description = `${lead}IT/SaaS業界の企業情報・求人・組織文化をまとめて確認できます。`;

  return {
    title: { absolute: "IT/SaaS企業を知る | OPINIO" },
    description,
    keywords: ["IT企業", "SaaS企業", "スタートアップ", "転職", "企業文化", "求人", "OPINIO"],
    alternates: { canonical: "/companies" },
    openGraph: {
      title: "IT/SaaS企業を探す | OPINIO",
      description,
      type: "website",
      url: "/companies",
      // OG画像の sub も「企業・求人」に合わせる（旧: 企業・カジュアル面談）
      images: [{ url: "/api/og?type=list&title=%E4%BC%81%E6%A5%AD%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E4%BC%81%E6%A5%AD%E3%83%BB%E6%B1%82%E4%BA%BA", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", description },
  };
}

const PAGE_SIZE = 40;

type SearchParams = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  industry?: string;
  foreign?: string;
  salaryMin?: string;
  view?: string;
  sort?: string;
  page?: string;
};

type Props = {
  searchParams: SearchParams;
};

// ── ページネーション (Link ベース) ──────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  baseHref,
}: {
  currentPage: number;
  totalPages: number;
  baseHref: string; // "?view=grid&sort=jobs" など（page= を除いたクエリ文字列）
}) {
  if (totalPages <= 1) return null;

  const items: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    items.push(1);
    if (currentPage > 3) items.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("ellipsis");
    items.push(totalPages);
  }

  const sep = baseHref.includes("?") ? "&" : "?";
  const href = (p: number) => `${baseHref}${sep}page=${p}`;

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 36, height: 36, padding: "0 10px", borderRadius: 8,
    border: "1px solid var(--line)", background: "#fff",
    color: "var(--ink-soft)", fontSize: 13, fontWeight: 500,
    textDecoration: "none", fontFamily: "Inter, sans-serif",
  };
  const active: React.CSSProperties = { ...base, background: "var(--royal)", borderColor: "var(--royal)", color: "#fff" };
  const disabled: React.CSSProperties = { ...base, opacity: 0.4, cursor: "not-allowed" };

  return (
    <nav aria-label="ページネーション" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32, flexWrap: "wrap" }}>
      {currentPage > 1
        ? <a href={href(currentPage - 1)} style={{ ...base, minWidth: 72 }}>← 前へ</a>
        : <span style={{ ...disabled, minWidth: 72 }}>← 前へ</span>}
      {items.map((item, idx) =>
        item === "ellipsis"
          ? <span key={`e-${idx}`} style={{ color: "var(--ink-mute)", padding: "0 4px", fontSize: 13 }}>…</span>
          : <a key={item} href={href(item)} style={item === currentPage ? active : base} aria-current={item === currentPage ? "page" : undefined}>{item}</a>
      )}
      {currentPage < totalPages
        ? <a href={href(currentPage + 1)} style={{ ...base, minWidth: 72 }}>次へ →</a>
        : <span style={{ ...disabled, minWidth: 72 }}>次へ →</span>}
    </nav>
  );
}

export default async function CompaniesPage({ searchParams }: Props) {
  const { q, phase, workStyle, hiring, location, industry, foreign, salaryMin, view, sort } = searchParams;
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  // foreign は並び替えモディファイア扱いのため hasFilter に含めない（ソートバーを維持するため）
  const hasFilter = Boolean(q || phase || workStyle || hiring || location || industry || salaryMin);
  // 一覧（4列）= デフォルト（パラメータなし or view=card）
  const isGridView  = !hasFilter && (!view || view === "card");
  // 詳細リスト = view=list
  const isListView  = !hasFilter && view === "list";
  const needsGrid = isGridView || isListView;

  // ── 全クエリを並列実行（experiences は企業IDが確定してから絞り込み） ──────────
  const supabase = createPublicClient();

  const [locations, phaseOptions, companyNamesResult, allCompaniesResult] = await Promise.all([
    // フィルターバー用ロケーション（unstable_cache 300s）
    fetchDistinctLocations(),
    fetchAvailablePhases(),
    // 検索サジェスト用企業名リスト
    supabase.from("ow_companies").select("id, name").eq("is_published", true).order("name"),
    // グリッド/リスト: DB側ページネーション + count を1クエリで取得
    needsGrid
      ? searchCompanies({
          limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE,
          sort: sort ?? "newest", foreign: foreign === "1",
          salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
        })
      : Promise.resolve({ companies: [], totalCount: 0, appliedFilters: {} }),
    // 口コミ平均スコア
  ]);

  /*
    在籍メンバー: 表示中の企業IDに絞って取得（全件スキャン防止）

    ⚠️ 2026-08-05 まで ow_users(id, name, photo_url, is_test) を select していたが、
       ow_users.photo_url は**存在しないカラム**（正しくは avatar_url）。
       クエリがエラーになり experienceResult.data が null → membersByCompany が
       常に空 → /companies のカードに在籍メンバーが1人も出ていなかった。
       error を受け取っていなかったため、ログにも何も出ていない。
    ⚠️ error は必ず見ること。ここは埋め込みも使っているので、
       カラム名だけでなく関係の曖昧さでも落ちうる。
  */
  const displayedCompanyIds = allCompaniesResult.companies.map((c) => c.id);
  const experienceResult = needsGrid && displayedCompanyIds.length > 0
    ? await supabase
        .from("ow_experiences")
        .select("company_id, user_id, ow_users(id, name, avatar_url, is_test)")
        .eq("is_current", true)
        .in("company_id", displayedCompanyIds)
    : { data: null, error: null };

  if (experienceResult.error) {
    console.error("[companies] 在籍メンバーの取得に失敗:", experienceResult.error.message);
  }

  const companySuggestions: { id: string; name: string }[] =
    (companyNamesResult.data ?? []) as { id: string; name: string }[];

  // ── 在籍メンバーをメモリ内でページ企業に絞り込み ─────────────────────────
  const membersByCompany: Record<string, MemberPreview[]> = {};
  if (needsGrid && experienceResult.data) {
    const pageCompanyIds = new Set(allCompaniesResult.companies.map((c) => c.id));
    for (const exp of experienceResult.data) {
      const companyId = exp.company_id as string;
      if (!pageCompanyIds.has(companyId)) continue;
      if (!membersByCompany[companyId]) membersByCompany[companyId] = [];
      if (membersByCompany[companyId].length < 8) {
        type ExpUser = { id: string; name: string; avatar_url?: string | null; is_test?: boolean | null };
        const user = exp.ow_users as ExpUser | ExpUser[] | null;
        if (user) {
          const u = Array.isArray(user) ? user[0] : user;
          if (u && !u.is_test) membersByCompany[companyId].push({ id: u.id, name: u.name ?? "?", photoUrl: u.avatar_url ?? null });
        }
      }
    }
  }


  return (
    <>
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>


      {/* ── Search bar panel (sticky) ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "sticky", top: 60, zIndex: 30 }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar locations={locations} phaseOptions={phaseOptions} companySuggestions={companySuggestions} />
          </Suspense>
        </div>
      </div>
    </div>

    {/* ── 並び替えバー（白ゾーン、フィルター非適用時のみ） ── */}
    {!hasFilter && needsGrid && (
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-[1440px] mx-auto px-4 py-3">
          <Suspense fallback={null}>
            <GridSortBar totalCount={allCompaniesResult.totalCount} />
          </Suspense>
        </div>
      </div>
    )}

    <div style={{ background: "#f0f4f8" }}>
      <div className="max-w-[1440px] mx-auto px-4 pt-4 pb-8">
        <div>

        {/* フィルタ適用中: 検索結果グリッド / 非適用: ジャンルカルーセル or コンパクトグリッド */}
        {hasFilter ? (
          <CompanySearchResults
            q={q}
            phase={phase}
            workStyle={workStyle}
            hiring={hiring}
            location={location}
            industry={industry}
            foreign={foreign}
            salaryMin={salaryMin}
          />
        ) : (
          <div style={{ marginTop: 0 }}>

            {/* ── メインコンテンツ ── */}
            <div>
              {isListView || isGridView ? (
                <>
                  {/* #10: sort=jobs の場合はアプリ側で補完ソート（求人数はDB側で計算できないため） */}
                  {(() => {
                    // #10: DB側でソート済み（updated_at DESC for "newest", employee_count DESC for "employees"）
                    // "jobs" のみアプリ側で補完（job_count は集計値のため DB ソート不可）
                    const paged = allCompaniesResult.companies.map(c => ({
                      ...c,
                    }));
                    if (sort === "jobs") paged.sort((a, b) => b.job_count - a.job_count);
                    if (sort === "disclosure") {
                      // reality_disclosure が null でないものを上位に
                      paged.sort((a, b) => {
                        const aHas = !!((a as Record<string, unknown>).reality_disclosure);
                        const bHas = !!((b as Record<string, unknown>).reality_disclosure);
                        return (bHas ? 1 : 0) - (aHas ? 1 : 0);
                      });
                    }
                    if (sort === "startup") {
                      const STARTUP_ORDER: Record<string, number> = {
                        "シード": 1, "seed": 1,
                        "シリーズA": 2, "series-a": 2, "series_a": 2,
                        "シリーズB": 3, "series-b": 3, "series_b": 3,
                        "プレシード": 4, "pre-seed": 4,
                        "ブートストラップ": 5, "bootstrap": 5,
                        "シリーズC": 6, "series-c": 6, "series_c": 6,
                        "シリーズD以降": 7, "series-d": 7, "series_d": 7,
                        "IPO準備中": 8, "ipo": 8,
                        "上場": 9, "listed": 9,
                        "ユニコーン": 10, "unicorn": 10,
                      };
                      paged.sort((a, b) =>
                        (STARTUP_ORDER[a.funding_stage ?? ""] ?? 99) -
                        (STARTUP_ORDER[b.funding_stage ?? ""] ?? 99)
                      );
                    }

                    // totalCount は DB の COUNT クエリから取得済み
                    const totalPages = Math.max(1, Math.ceil(allCompaniesResult.totalCount / PAGE_SIZE));
                    const safePage   = Math.min(currentPage, totalPages);

                    // ページネーション用ベースURL（page= を除いたクエリ）
                    const baseParams = new URLSearchParams();
                    if (view) baseParams.set("view", view);
                    if (sort) baseParams.set("sort", sort);
                    const baseHref = `/companies${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

                    return (
                      <>
                        {isGridView ? (
                          <>
                            <style>{`
                              .companies-grid4 {
                                display: grid;
                                grid-template-columns: repeat(3, 1fr);
                                gap: 16px;
                                margin-top: 0px;
                              }
                              @media (max-width: 1199px) {
                                .companies-grid4 { grid-template-columns: repeat(2, 1fr); gap: 14px; }
                              }
                              @media (max-width: 600px) {
                                .companies-grid4 { grid-template-columns: repeat(1, 1fr); gap: 8px; }
                              }
                            `}</style>
                            <div className="companies-grid4">
                              {paged.map(c => (
                                <CompanyCardList
                                  key={c.id}
                                  company={c}
                                  members={membersByCompany[c.id] ?? []}
                                  compact
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 0 }}>
                            {paged.map(c => (
                              <CompanyCardList
                                key={c.id}
                                company={c}
                                members={membersByCompany[c.id] ?? []}
                              />
                            ))}
                          </div>
                        )}
                        {/* 下部ページネーション */}
                        <Pagination currentPage={safePage} totalPages={totalPages} baseHref={baseHref} />
                      </>
                    );
                  })()}
                </>
              ) : null}
            </div>

            {/* 最近見た企業（一覧下部） */}
            <Suspense fallback={null}>
              <RecentlyViewedSection />
            </Suspense>

          </div>
        )}

        <div style={{ marginBottom: 16 }} />

        </div>
      </div>{/* max-w container end */}

    </div>

    {/* 管理者専用: 企業並び替えオーバーレイ（非管理者には何も表示されない） */}
    <CompanyAdminDndOverlay />

    </>
  );
}
