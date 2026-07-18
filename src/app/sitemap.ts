import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const { data: jobs } = await supabase
    .from("ow_jobs")
    .select("id, slug, updated_at")
    .in("status", ["active", "published"]);

  const { data: companies } = await supabase
    .from("ow_companies")
    .select("id, slug, updated_at")
    .eq("is_published", true);

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
    {
      url: `${baseUrl}/biz`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.45,
    },
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
    // ── Static: salary pages ─────────────────────────────────────────────────
    { url: `${baseUrl}/salary`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.85 },
    ...["enterprise-sales", "customer-success", "sales-engineer", "solutions-architect", "backend-engineer", "ml-engineer", "product-manager", "smb-sales", "other"].map((slug) => ({
      url: `${baseUrl}/salary/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    // ── Static: job dept pages ───────────────────────────────────────────────
    ...["sales", "marketing", "management", "corporate", "product", "engineer", "infra"].map((slug) => ({
      url: `${baseUrl}/jobs/dept/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
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
