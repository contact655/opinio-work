import type { Metadata } from "next";
import { Suspense } from "react";
import { getJobs, getParentRoles, getRoleAliases } from "@/lib/supabase/queries";
import JobsClient from "./JobsClient";
import { featuredCompanyPrefix } from "@/lib/seo/featuredCompanies";
import { filterCompaniesAcceptingApplications } from "@/lib/jobs/application";

/*
  ⚠️ **ISR（`export const revalidate`）にしないこと。2026-08-13 に試して戻した。**

  動機は正しかった。動的レンダリングのせいで未ログインの訪問者まで
  毎回サーバー関数の起動（本番実測でコールドスタート 2〜4秒）を負担している。
  「あなたへのおすすめ」だけが動的の理由だったので、それを
  `GET /api/jobseeker/recommendations` に出して `revalidate = 300` にした。

  ⚠️ **だが静的プリレンダリングでは求人が1件もHTMLに入らない。**
     `JobsClient` が `useSearchParams()` を使っており、Next 14 は静的生成時に
     **最も近い Suspense 境界の fallback（＝スケルトン）を出力して打ち切る。**
     求人データは RSC ペイロードには載るのでハイドレート後は表示されるが、
     **クローラと初回描画が見るHTMLは空**になる。

     実測（ローカル本番ビルド vs 本番）:
       動的（現行）… 実HTML 73,088文字 / 求人タイトルあり / 求人リンク5件
       ISR（試作）… 実HTML 11,526文字 / 求人タイトル**なし** / リンク**0件**

     ⚠️ **ビルドは成功し、ルート表も `○ (Static)` になる。** 型検査もlintも通る。
        HTMLの中身を見るまで気づけない（CLAUDE.md「黙って消える」の一例）。

  ISR にしたいなら、先に**求人一覧の描画をサーバーコンポーネントへ移し**、
  `useSearchParams()` に依存する絞り込みだけをクライアントに残すこと。
  `revalidate` を足すだけでは SEO を壊す。

  なお「あなたへのおすすめ」の切り出しはそのまま残している。
  動的のままでもサーバー描画から3往復（getUser / ow_profiles / getDesiredRoles）が消える。
*/
export const dynamic = "force-dynamic";

// 企業名はベタ書きしない。以前は「LayerX・SmartHR・…」と書いていたが、
// LayerX は Migration 239 で削除済みで、掲載していない企業名が検索結果に出ていた。
// 公開中かつ求人を持つ企業から引く（lib/seo/featuredCompanies.ts）。
export async function generateMetadata(): Promise<Metadata> {
  const lead = await featuredCompanyPrefix("jobs");
  const description = `${lead}IT/SaaS業界の最新募集情報。フルリモート・高年収・職種別に検索できます。`;

  return {
    title: { absolute: "IT/SaaS募集を探す | OPINIO" },
    description,
    keywords: ["IT転職", "SaaS転職", "エンジニア転職", "PdM転職", "フルリモート", "高年収", "OPINIO"],
    alternates: { canonical: "/jobs" },
    openGraph: {
      title: "IT/SaaS募集を探す | OPINIO",
      description,
      type: "website",
      url: "/jobs",
      images: [{ url: "/api/og?type=list&name=%E6%B1%82%E4%BA%BA%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E6%9C%80%E6%96%B0%E6%B1%82%E4%BA%BA%E6%83%85%E5%A0%B1&v=2", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", description },
  };
}

/*
  ⚠️ ここにあった `fetchUserRecommendations` は
     `src/app/api/jobseeker/recommendations/route.ts` に移した（2026-08-13）。
     ページに置いたままだと `cookies()` を読むためページ全体が動的になり、
     上の `revalidate = 300` が効かない。**戻さないこと。**
*/

export default async function JobsPage() {
  const [{ jobs, companies }, parentRoles, roleAliases] = await Promise.all([
    getJobs(),
    getParentRoles(),
    getRoleAliases(),
  ]);

  /* ⚠️ 応募が届く先があるかを企業ごとに解決して Company に載せる（2026-08-11）。
        求人が published でも宛先が無ければ応募は誰にも届かない。
        判定は lib/jobs/application.ts に一本化してあり、ここでは結果を載せるだけ。
     ⚠️ 1社ずつ引かないこと（1社あたり2クエリ走る）。 */
  const applyOpen = await filterCompaniesAcceptingApplications(companies.map((c) => c.id));
  for (const c of companies) c.application_open = applyOpen.has(c.id);

  return (
    <Suspense
      fallback={
        <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 48, borderRadius: 12, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, marginBottom: 20, maxWidth: 500 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 130, borderRadius: 16 }} />
            ))}
          </div>
        </div>
      }
    >
      {/* recommendations は渡さない。JobsClient がログイン中だけ自分で取りに行く */}
      <JobsClient jobs={jobs} companies={companies} parentRoles={parentRoles} roleAliases={roleAliases} />
    </Suspense>
  );
}
