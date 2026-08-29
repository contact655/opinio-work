import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";
import { filterListedCompanies } from "@/lib/companies/visibility";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const { data: jobs } = await supabase
    .from("ow_jobs")
    .select("id, slug, updated_at")
    .eq("status", "published").eq("is_test", false);

  // ⚠️ sitemap はディレクトリの軸。listing_status='draft' は載せない
  const { data: companies } = await filterListedCompanies(
    supabase.from("ow_companies").select("id, slug, updated_at")
  );

  const { data: articles } = await supabase
    .from("ow_articles")
    .select("slug, updated_at")
    .eq("is_published", true);

  const baseUrl = "https://opinio.jp";

  return [
    // ── Static pages ────────────────────────────────────────────────────────
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/jobs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/business`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    /* ⚠️ **`/biz` は sitemap に入れない**（2026-08-20 に外した）。
          企業向けLPは `/business`（上の行）で、`/biz` は**常に 307 で
          `/biz/auth` へ転送するだけ**のルート。しかも `/biz/auth` は
          robots.ts で Disallow しているので、**「載せて → 転送して → 拒否する」**
          という矛盾した案内になっていた（本番で実測）。
       ⚠️ robots.ts の `allow: ["/", "/biz"]` のコメントは「企業向けLP」と書いているが、
          実体は `/business` に移っている。allow 自体は無害なので残してある。 */
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    // ── Static: article type pages ───────────────────────────────────────────
    ...["employee", "mentor", "ceo", "report"].map((slug) => ({
      url: `${baseUrl}/articles/type/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    /* ⚠️ `/salary`（年収相場）は 2026-08-29 に削除した。**戻さないこと。**
          年収データを増やす予定が無く、しかも画面が「自分の年収を報告すると全データが
          閲覧できます（Glassdoor方式）」と書いていたのに**報告フォームが存在しなかった**
          （CTA は /mypage に飛ぶだけ／`ow_salary_reports` は DROP 済み）。
          出していた数字も求人票のレンジ集計で、「匿名で報告した実績年収」ではなかった。
       ⚠️ sitemap に載せていた10URLは `next.config.mjs` で 301 を張ってある。 */
    // ── Static: job dept pages ───────────────────────────────────────────────
    // ow_roles の9大分類の slug と一致させること（2026-08-03 に独自7スラッグから移行）。
    // 旧 management / infra は next.config.mjs で 301 を張っている。
    ...["exec", "bizdev", "sales", "cs", "marketing", "product", "data-ai", "engineer", "corporate"].map((slug) => ({
      url: `${baseUrl}/jobs/dept/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    // ── Static: careers hub ──────────────────────────────────────────────────
    { url: `${baseUrl}/careers`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.85 },
    // ── /people 配下は載せない ───────────────────────────────────────────────
    //    親（/people）は 7dd4eff4 で sitemap から外し robots.ts でも Disallow にしたが、
    //    子の /people/role/[slug] 7ページが priority 0.75 のまま残っていた（2026-08-04 削除）。
    //    認証必須ページなのでクローラに知らせる意味がない。
    // ── Dynamic: jobs ────────────────────────────────────────────────────────
    ...(jobs?.map((job) => ({
      url: `${baseUrl}/jobs/${job.slug ?? job.id}`,
      lastModified: new Date(job.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })) ?? []),

    // ── Dynamic: companies ───────────────────────────────────────────────────
    ...(companies?.map((company) => ({
      url: `${baseUrl}/companies/${company.slug ?? company.id}`,
      lastModified: new Date(company.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })) ?? []),

    // ── Dynamic: articles ────────────────────────────────────────────────────
    ...(articles?.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })) ?? []),
  ];
}
