import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const { data: jobs } = await supabase
    .from("ow_jobs")
    .select("id, updated_at")
    .eq("status", "active");

  const { data: companies } = await supabase
    .from("ow_companies")
    .select("id, updated_at");

  let articles: any[] = [];
  try {
    const { data } = await supabase
      .from("ow_articles")
      .select("slug, updated_at")
      .eq("is_published", true);
    articles = data || [];
  } catch {
    // ow_articles may not exist yet
  }

  const baseUrl = "https://opinio.work";

  return [
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
      priority: 0.8,
    },
    {
      url: `${baseUrl}/career-consultation`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...(jobs?.map((job) => ({
      url: `${baseUrl}/jobs/${job.id}`,
      lastModified: new Date(job.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) ?? []),
    ...(companies?.map((company) => ({
      url: `${baseUrl}/companies/${company.id}`,
      lastModified: new Date(company.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })) ?? []),
    ...articles.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
