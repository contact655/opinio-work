import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ArticleDetailClient from "./ArticleDetailClient";

export const dynamic = "force-dynamic";

async function getArticle(articleId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_articles")
    .select("*")
    .eq("id", articleId)
    .eq("is_published", true)
    .single();
  return data;
}

async function getCompany(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select("id, name, logo_url, url")
    .eq("id", companyId)
    .single();
  return data;
}

export default async function ArticleDetailPage({
  params,
}: {
  params: { id: string; articleId: string };
}) {
  const [article, company] = await Promise.all([
    getArticle(params.articleId),
    getCompany(params.id),
  ]);

  if (!article || !company) return notFound();

  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen bg-white">
        <ArticleDetailClient
          article={article}
          company={company}
          companyId={params.id}
        />
      </main>
      <JobseekerFooter />
    </>
  );
}
