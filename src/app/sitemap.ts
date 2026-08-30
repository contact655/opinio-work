import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { getDeptJobs } from "@/lib/jobs/deptJobs";

/**
 * ★1時間で作り直す（2026-08-30 に追加）。
 *
 * ⚠️★**宣言が無いと、sitemap は「デプロイしたときだけ」更新される。**
 *    実測（2026-08-30 / 本番）: `x-vercel-cache: HIT` /
 *    `cache-control: public, max-age=0, must-revalidate`。
 *    `revalidate` も `dynamic` も無く、ビルド時に固めたものを配り続けていた。
 *
 * ⚠️★**`revalidatePath("/sitemap.xml")` を呼んでいる箇所は0件**（同日実測）。
 *    admin の各操作は `/admin/jobs` `/jobs` 等は revalidate するが sitemap は触らない。
 *    **さらに migration で状態を変えた場合は `revalidatePath` 自体が走らない**
 *    ——実際、同日に求人3件を `private` にしたのは migration だった。
 *    だから**時間ベースで作り直す**のが要る。
 *
 * ⚠️ 放置すると、取り下げた求人・非掲載にした企業の URL を検索エンジンに
 *    知らせ続け、クローラが 404 を踏む。
 *
 * ⚠️ 1時間にしたのは、sitemap がクロールされる間隔に対して十分細かく、
 *    かつ `getDeptJobs()`（`unstable_cache` / revalidate 300）より粗いため。
 *    **これより短くしても、中で読む値のほうが最大5分古い。**
 */
export const revalidate = 3600;

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

  /* ★求人が1件も無い部門ページは sitemap に載せない（2026-08-30）。
        ⚠️ 実測（2026-08-30 / 本番）: **9部門のうち8つが0件**なのに、9つとも
           priority 0.8 で載っており `index, follow` だった。
        ⚠️ 同じ形を既に2回外している —— `/salary` の10URL（2026-08-29）と
           `/people/role/[slug]` の7ページ（2026-08-04）。**中身の無いページを
           自分から知らせない。**
        ⚠️★**画面側と同じ `getDeptJobs()` を使う。** ここで数え直すと、
           「sitemap にはあるのに中身0件」「noindex なのに sitemap にある」が起きる。 */
  const deptJobs = await getDeptJobs();

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
    /* ⚠️ 料金は 2026-08-31 に `/business` から `/business/pricing` へ移設した。
          掲載利用規約 第4条2項が「本サービス上に表示する」と定めているので、
          **インデックス対象として残す**（noindex にしないこと）。 */
    {
      url: `${baseUrl}/business/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
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
    ...["exec", "bizdev", "sales", "cs", "marketing", "product", "data-ai", "engineer", "corporate"]
      .filter((slug) => (deptJobs.get(slug)?.length ?? 0) > 0)   // ★0件の部門は載せない
      .map((slug) => ({
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
