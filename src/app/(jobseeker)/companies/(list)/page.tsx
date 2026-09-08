import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAvailableTargetIndustries, searchCompanies } from "@/lib/search/companies";
import { fetchCompanySuggestions } from "@/lib/search/companies";
import { CompanySearchBar } from "@/components/companies/CompanySearchBar";
import { CompanySearchResults } from "@/components/companies/CompanySearchResults";
import { RecentlyViewedSection } from "@/components/companies/RecentlyViewedSection";
import { GridSortBar } from "@/components/companies/GridSortBar";
import { CompanyCardList } from "@/components/companies/CompanyCardList";
import { CompanyAdminDndOverlay } from "@/components/companies/CompanyAdminDndOverlay";
import { featuredCompanyPrefix } from "@/lib/seo/featuredCompanies";
import { getBusinessDomainFacets } from "@/lib/companies/businessDomainsCached";
import { resolveIndustryKey } from "@/lib/search/industryGroups";
import { CompanySplitLayout } from "@/components/companies/CompanySplitLayout";
import { CompanyPane } from "@/components/companies/CompanyPane";
import { getCompanyBySlugOrId, getCompanyTargetIndustriesCached } from "@/lib/supabase/queries";


/**
 * ★`?industry=<slug>` を**単独で**指定したときだけ、その事業領域の「入口ページ」として扱う
 * （2026-09-09）。それ以外は従来どおり `/companies` の複製として扱う。
 *
 * ── ⚠️★なぜ必要だったか ──────────────────────────────────────────────────
 * 実測（2026-09-08 / 本番）: フッターから14件の `?industry=` が全ページに張られており、
 * 各19〜2社の実体があるのに、**14件すべてが `<title>` 同一・`canonical` は `/companies`**
 * だった。つまり検索エンジンには `/companies` の複製としか見えず、
 * 「CRM 企業」「セキュリティ SaaS 企業」のような検索で出る余地が無かった。
 * 一方リポジトリはこれらを**恒久的な入口として扱っている**
 * （`?industry=` のキーは「被リンクを切らないため」に維持され、旧キーは
 * `resolveIndustryKey()` が救済している）。**扱いと実装が食い違っていた。**
 *
 * ⚠️★**「単独のとき」だけに限る。** 他の絞り込み（`q` / `phase` / `workStyle` /
 *    `hiring` / `location` / `target` / `foreign`）と組み合わさった URL は
 *    組み合わせの数だけ増えるので、**`/companies` に寄せたまま**にする。
 *    ⚠️ `page` / `view` / `selected` は**絞り込みではない**ので無視してよい
 *       （`?industry=ai&selected=ubie` は `?industry=ai` に寄る）。
 *
 * ⚠️ 0社の事業領域は `getBusinessDomainFacets()` が返さないので、ここにも来ない。
 *    **中身の無いページを自分から知らせない**（sitemap の既存方針と同じ）。
 */
async function facetForMetadata(searchParams: SearchParams) {
  if (!searchParams.industry) return null;
  const hasOtherFilter = Boolean(
    searchParams.q || searchParams.phase || searchParams.workStyle ||
    searchParams.hiring || searchParams.location || searchParams.target || searchParams.foreign
  );
  if (hasOtherFilter) return null;
  const key = resolveIndustryKey(searchParams.industry);
  const facets = await getBusinessDomainFacets();
  return facets.find((f) => f.slug === key) ?? null;
}

// 企業名はベタ書きしない（理由は lib/seo/featuredCompanies.ts のコメント参照）。
// 一覧ページなので基準は "content"＝求人と記事の合計が多い順。
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const facet = await facetForMetadata(searchParams);
  if (facet) {
    /* ⚠️ 件数は**そのとき数えた値**（`getBusinessDomainFacets` の count）。
          固定値を書かない。⚠️ 「掲載中の企業数」であって求人数ではない。 */
    const facetDescription =
      `${facet.name}の領域で事業を行うIT企業${facet.count}社。企業情報・求人・組織文化をまとめて確認できます。`;
    const ogUrl =
      `/api/og?type=list&name=${encodeURIComponent(facet.name)}` +
      `&sub=${encodeURIComponent("IT/SaaS業界の企業・求人")}&v=2`;
    return {
      title: { absolute: `${facet.name}のIT企業一覧 | OPINIO` },
      description: facetDescription,
      keywords: [facet.name, "IT企業", "SaaS企業", "転職", "求人", "OPINIO"],
      /* ⚠️★**自己 canonical。** ここを `/companies` のままにすると、
            固有の title を付けても検索エンジンは `/companies` に寄せてしまう。 */
      alternates: { canonical: `/companies?industry=${facet.slug}` },
      openGraph: {
        title: `${facet.name}のIT企業を探す | OPINIO`,
        description: facetDescription,
        type: "website",
        url: `/companies?industry=${facet.slug}`,
        images: [{ url: ogUrl, width: 1200, height: 630 }],
      },
      twitter: { card: "summary_large_image", description: facetDescription },
    };
  }

  const lead = await featuredCompanyPrefix("content");
  const description = `${lead}IT業界の企業情報・求人・組織文化をまとめて確認できます。`;

  return {
    title: { absolute: "IT企業を知る | OPINIO" },
    description,
    keywords: ["IT企業", "SaaS企業", "スタートアップ", "転職", "企業文化", "求人", "OPINIO"],
    alternates: { canonical: "/companies" },
    openGraph: {
      title: "IT企業を探す | OPINIO",
      description,
      type: "website",
      url: "/companies",
      // OG画像の sub も「企業・求人」に合わせる（旧: 企業・カジュアル面談）
      images: [{ url: "/api/og?type=list&name=%E4%BC%81%E6%A5%AD%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E4%BC%81%E6%A5%AD%E3%83%BB%E6%B1%82%E4%BA%BA&v=2", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", description },
  };
}

const PAGE_SIZE = 40;

/**
 * ★分割ビューの左レール幅（2026-09-09）。**表示形式で必要な幅が違う。**
 *
 * ⚠️ 詳細表示（list）の1行は**固定部分だけで 499px**（実測 1440px / dev）:
 *      padding 40 ＋ gap 18×3 ＝ 94 ／ ロゴ 68 ／ 実数3列 241 ／ ボタン列 96
 *    一覧と同じ 420px に畳むと**本文の幅が 0 になる**ので、700px 取っている
 *    （本文に約 201px 残る）。
 * ⚠️ 1280px（分割が始まる最小幅）では pane 側が 528px になる。`CompanyPane` は
 *    380px から崩れないことを `/dev/preview/company-pane` で確認済み。
 */
const GRID_RAIL_WIDTH = 420;
const LIST_RAIL_WIDTH = 700;

type SearchParams = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  /** 事業領域の slug（ai / infra / crm …）。⚠️ キーが `industry` なのは
   *  2026-08-26 の移行で被リンクを切らないため。中身は事業領域。 */
  industry?: string;
  /** 対象業界（軸2）の slug。⚠️ `industry` とは**別の軸**（誰に売っているか） */
  target?: string;
  foreign?: string;
  view?: string;
  sort?: string;
  page?: string;
  /** ★分割ビューで右ペインに出す企業の slug（2026-09-08）。
   *  ⚠️ **1280px 以上でだけ意味を持つ。** 付ける主体は `CompanySplitLinks`
   *     （クリックの瞬間に幅を見て振り替える）。狭い画面では付かないし、
   *     直リンクで来ても CSS でペイン列ごと隠れる。 */
  selected?: string;
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
    textDecoration: "none", fontFamily: "var(--font-inter), var(--font-noto)",
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
  const { q, phase, workStyle, hiring, location, industry, target, foreign, view, sort } = searchParams;
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  // foreign は並び替えモディファイア扱いのため hasFilter に含めない（ソートバーを維持するため）
  const hasFilter = Boolean(q || phase || workStyle || hiring || location || industry || target);
  /* 詳細リスト = view=list。★**これだけを名指しで判定する。** */
  const isListView  = !hasFilter && view === "list";
  /* 一覧（グリッド）= 既定。★**未知の値もここに落とす**（2026-08-28）。
     ⚠️ それまでは `!view || view === "card"` だったため、`?view=grid` のような
        **綴り違いで isGridView も isListView も false になり、needsGrid が false**。
        検索も一覧も描かれない**空ページ（実測 81KB）が 200 で返っていた**。
     ⚠️ 並び替えの `sort` が未知の値を既定に落としているのと同じ流儀
        （GridSortBar のコメント。`?sort=jobs` / `?sort=salary` の前例）。 */
  const isGridView  = !hasFilter && !isListView;
  const needsGrid = isGridView || isListView;

  /* ── 全クエリを並列実行 ──────────────────────────────────────────────────
     ★2026-08-23 に**直列の2段目を無くした**。それまでは「表示中の企業IDが
       確定してから在籍メンバーを引く」形で、1往復ぶん余計に待っていた。 */
  /* ⚠️ 都道府県は**47件の固定リスト**になったので DB から引かない（2026-09-06）。
        該当0件の県も出す方針にしたため、実データを見る必要がなくなった。
        選択肢は lib/utils/location.ts の `PREFECTURE_FILTER_GROUPS`。 */
  const [industryFacets, targetIndustryOptions, companySuggestions, allCompaniesResult] = await Promise.all([
    /* 事業領域の選択肢（unstable_cache 300s）。⚠️ **掲載中が1社以上あるものだけ。** */
    /* 事業領域の選択肢（unstable_cache 300s）。⚠️ **掲載中が1社以上あるものだけ。**
          フェーズと同じ扱いで、0件の選択肢を出さない。 */
    getBusinessDomainFacets(),
    /* 対象業界（軸2）の選択肢（unstable_cache 300s）。
       ⚠️ **事業領域とは別の軸。** あちらは「何を作っているか」、こちらは「誰に売っているか」。 */
    fetchAvailableTargetIndustries(),
    // 検索サジェスト用企業名リスト（unstable_cache 300s）
    fetchCompanySuggestions(),
    // グリッド/リスト: DB側ページネーション + count を1クエリで取得
    needsGrid
      ? searchCompanies({
          limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE,
          sort: sort ?? "newest", foreign: foreign === "1",
        })
      : Promise.resolve({ companies: [], totalCount: 0, appliedFilters: {} }),
    // 口コミ平均スコア
  ]);

  /* ── ★分割ビュー（2026-09-08）─────────────────────────────────────────────
     `?selected=<slug>` があるときだけ、右ペイン用の企業を引く。
     ⚠️★**絞り込み中も対象**（2026-09-08 に追加）。それまで一覧グリッドだけに
        効いていたため、**絞り込んだ瞬間に分割ビューが消えていた**
        （実測: 本番 HTML の `companies-split` が `/companies` は4件、
        `?industry=ai` は 0件）。同じカード部品が画面によって挙動を変えていた。
        ⚠️ 絞り込み後こそ見比べたい場面なので、ここを外さないこと。
     ⚠️★**`?view=list`（詳細表示）も対象**（2026-09-09 に追加。柴さんの要望）。
        それまで外していた理由は「1行が広く、レールに畳むと `.clc-stats`+`.clc-cta` が
        入らない」だったが、**レール幅を表示形式で変えれば入る**（下の `LIST_RAIL_WIDTH`）。
     ⚠️ ペインは要約なので `CompanyPane` を使う。**企業詳細ページは使い回さない**
        （700px のコンテナに入れると壊れる。理由は CompanyPane の注記）。
     ⚠️ 見つからない slug は**黙って無視する**（ペインを出さないだけ）。
        一覧そのものは正しいので 404 にはしない。 */
  /* ★詳細表示は**先頭の企業を最初から開く**（2026-09-09。柴さんの要望）。
     ⚠️★LinkedIn と同じ。詳細表示に切り替えた直後、右側が空のままだと
        「分割ビューがある」ことに気づけない（実際、切り替えても全幅の一覧が出るだけだった）。
     ⚠️ **`?selected=` は URL に足さない。** 足すには redirect が要り、共有された URL と
        自動選択の区別も付かなくなる。**描画するだけ**にして、URL は利用者が選んだときだけ動く。
     ⚠️ **一覧表示（グリッド）には掛けていない。** あちらは3列の全幅グリッドが既定の姿で、
        いきなり1列のレールに畳むと「一覧」の意味が変わる。詳細表示だけの挙動。
     ⚠️ 絞り込み中は `isListView` が false（結果は常にグリッド）なので対象外。
     ⚠️ 1280px 未満では**ペインが CSS で消える**ので、この1社ぶんの取得は無駄になる。
        サーバーはビューポートを知らないので避けられない。詳細表示のときだけなので許容した。 */
  const autoSelected = isListView ? allCompaniesResult.companies[0] : undefined;
  const selectedSlug =
    searchParams.selected ?? (autoSelected ? (autoSelected.slug ?? autoSelected.id) : null);
  const selectedResult = selectedSlug ? await getCompanyBySlugOrId(selectedSlug) : null;
  const selectedTargets = selectedResult
    ? await getCompanyTargetIndustriesCached(selectedResult.resolvedId)
    : [];
  /* ⚠️★ペインの実体は**ここで1つだけ**組み立てて、一覧グリッドと絞り込み結果の
        **両方に同じものを渡す**。それぞれの描画側で組み立てると、片方だけ
        `targetIndustries` を渡し忘れる形の食い違いが生まれる
        （CLAUDE.md「`mapCompany` の第4引数を省くと『事業領域 —』になる」と同じ罠）。 */
  const pane = selectedResult ? (
    <CompanyPane
      company={selectedResult.company}
      detail={selectedResult.detail}
      targetIndustries={selectedTargets}
    />
  ) : null;
  /** ⚠️ カードの印は id で突き合わせる（`?selected=` は slug でも uuid でもありうる） */
  const selectedCompanyId = selectedResult?.resolvedId ?? null;
  /** ⚠️ 読み上げ用。**正式名称をそのまま渡す**（`companyDisplayName` の省略形だと
   *     「Salesforce」のように英名だけになり、聞いただけでは同定しにくい） */
  const paneLabel = selectedResult?.company.name ?? null;

  return (
    <>
    <div style={{ background: "#f0f4f8" }}>
      <h1 className="sr-only">企業を知る</h1>


      {/* ── Search bar panel (sticky) ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", position: "sticky", top: 60, zIndex: 30 }}>
        <div className="max-w-[1440px] mx-auto px-4">
          <Suspense>
            <CompanySearchBar industryOptions={industryFacets} targetIndustryOptions={targetIndustryOptions} companySuggestions={companySuggestions} />
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
            target={target}
            foreign={foreign}
            /* ★分割ビュー（2026-09-08）。一覧グリッドと**同じペイン**を渡す。
               ⚠️ 渡さないと、絞り込んだ瞬間に分割ビューが消える（それが直前の状態）。 */
            pane={pane}
            paneLabel={paneLabel}
            selectedCompanyId={selectedCompanyId}
          />
        ) : (
          <div style={{ marginTop: 0 }}>

            {/* ── メインコンテンツ ── */}
            <div>
              {isListView || isGridView ? (
                <>
                  {(() => {
                    // DB側でソート済み（updated_at DESC for "newest", employee_count DESC for "employees"）
                    /* ⚠️ "jobs"（募集中あり優先）は 2026-08-18 に廃止した。
                          「募集あり」フィルタと同じ用途で、入口が2つあった（ルール⑧）。 */
                    /* ★並び替えは**すべて `searchCompanies`（DB と lib/search/companies.ts）で完結する。**
                          ここで再ソートしない。

                       ── ⚠️★ここにあった2つの再ソートは 2026-08-28 に削除した ──────────
                       ① `sort === "disclosure"` … `reality_disclosure` の有無で並べ替えていた。
                          実測: **掲載79社すべてが `{}`（空の jsonb）** で入力UIも無い。
                          ⚠️ 「null だから false」ではない。**`{}` は JS では truthy** なので、
                             この列に値が入り始めた日に**本物の開示スコアを上書きする**
                             （`lib/search/companies.ts` の `disclosureScore` が正）。
                       ② `sort === "startup"` … **UI に選択肢が無い**（`GridSortBar` の
                          `SORT_OPTIONS` は newest / employees / disclosure の3つだけ）。
                          `funding_stage` が入っているのは 6社だけで、値も `listed` / `seed` の2種類。

                       ⚠️★**どちらも `paged`（＝現在ページの12件）しか並べ替えていなかった。**
                          2ページ目以降の企業は絶対に上がってこない**部分ソート**で、
                          「全体を並べ替えた」ように見えるのが一番まずい形だった。

                       ⚠️ 再ソートを足したくなったら、**`searchCompanies` 側に足すこと。**
                          ページングの後ろで並べ替えると必ずこの問題が出る。
                       ⚠️ 旧 URL の `?sort=startup` は既定（新着順）に落ちる。壊れない
                          （`?sort=jobs` / `?sort=salary` を外したときと同じ）。 */
                    const paged = allCompaniesResult.companies;

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
                            {/* ⚠️★分割ビューの骨組みと CSS は CompanySplitLayout が持つ。
                                   ここに書き戻さないこと —— 絞り込み結果
                                   （CompanySearchResults）が同じものを使っているので、
                                   割れると片方の画面でだけペインが出なくなる。 */}
                            <CompanySplitLayout pane={pane} paneLabel={paneLabel} railWidth={GRID_RAIL_WIDTH}>
                              <div className="companies-grid4">
                                {paged.map(c => (
                                  <CompanyCardList
                                    key={c.id}
                                    company={c}
                                    compact
                                    /* ⚠️ **同タブ**（2026-09-07）。別タブに戻さないこと。
                                          `target="_blank"` だと `<Link>` の prefetch が
                                          使われず捨てられる（CompanyCardList の注記）。 */
                                    openInNewTab={false}
                                    /* ★いま右ペインに出している企業に印を付ける（2026-09-08）。
                                       ⚠️ **`selectedSlug` と比べないこと。** URL の値は slug でも
                                          uuid でもありうるので、`getCompanyBySlugOrId` が解決した
                                          `resolvedId` と id で突き合わせる。文字列比較にすると
                                          uuid で直リンクされたときだけ印が付かない。 */
                                    selected={c.id === selectedCompanyId}
                                  />
                                ))}
                              </div>
                            </CompanySplitLayout>
                          </>
                        ) : (
                          /* ⚠️★詳細表示も分割ビューに載せる（2026-09-09）。**同じ部品**を使う
                                 ——一覧グリッドと骨組みが割れると、片方だけペインが出なくなる。
                             ⚠️ レール幅だけが違う（1行が広いため）。理由は LIST_RAIL_WIDTH。 */
                          <CompanySplitLayout pane={pane} paneLabel={paneLabel} railWidth={LIST_RAIL_WIDTH}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 0 }}>
                              {paged.map(c => (
                                <CompanyCardList
                                  key={c.id}
                                  company={c}
                                  /* ⚠️ グリッド側と同じ。**同タブ**（2026-09-07） */
                                  openInNewTab={false}
                                  selected={c.id === selectedCompanyId}
                                />
                              ))}
                            </div>
                          </CompanySplitLayout>
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
