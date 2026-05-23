import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const { data: jobs } = await supabase
    .from("ow_jobs")
    .select("id, updated_at")
    .in("status", ["active", "published"]);

  const { data: companies } = await supabase
    .from("ow_companies")
    .select("id, updated_at")
    .eq("is_published", true);

  const { data: articles } = await supabase
    .from("ow_articles")
    .select("slug, updated_at")
    .eq("is_published", true);

  const { data: mentors } = await supabase
    .from("ow_mentors")
    .select("id, updated_at")
    .eq("is_available", true);

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
      url: `${baseUrl}/mentors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/career-consultation`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about/scope`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${baseUrl}/about/selection-criteria`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${baseUrl}/consultation-cases`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/biz`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // ── Dynamic: jobs ────────────────────────────────────────────────────────
    ...(jobs?.map((job) => ({
      url: `${baseUrl}/jobs/${job.id}`,
      lastModified: new Date(job.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })) ?? []),

    // ── Dynamic: companies ───────────────────────────────────────────────────
    ...(companies?.map((company) => ({
      url: `${baseUrl}/companies/${company.id}`,
      lastModified: new Date(company.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })) ?? []),

    // ── Dynamic: mentors ─────────────────────────────────────────────────────
    ...(mentors?.map((m) => ({
      url: `${baseUrl}/mentors/${m.id}`,
      lastModified: new Date(m.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
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
