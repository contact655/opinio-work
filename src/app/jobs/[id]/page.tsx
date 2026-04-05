import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JobDetailClient from "./JobDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: job } = await supabase
    .from("ow_jobs")
    .select("title, ow_companies(name)")
    .eq("id", params.id)
    .single();

  if (!job) return { title: "求人詳細 | opinio.work" };

  const companyName = (job.ow_companies as any)?.name ?? "";
  return {
    title: `${job.title} | ${companyName} | opinio.work`,
    description: `${companyName}の${job.title}求人詳細。マッチ度・仕事内容・選考フローを確認できます。`,
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // メイン求人データ取得
  const { data: job } = await supabase
    .from("ow_jobs")
    .select(
      `*,
      ow_companies(
        id, name, industry, phase, employee_count,
        avg_salary, funding_total, founded_year,
        brand_color, url, logo_url
      ),
      ow_job_requirements(id, requirement_type, content, display_order)`
    )
    .eq("id", params.id)
    .single();

  if (!job) return notFound();

  const company = job.ow_companies as any;

  // ユーザー情報取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // マッチスコア取得（企業ベース）
  let matchScore: any = null;
  if (user && company) {
    const { data } = await supabase
      .from("ow_match_scores")
      .select("overall_score, match_reasons")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle();
    matchScore = data;
  }

  // お気に入り状態
  let isFavorited = false;
  if (user) {
    const { data } = await supabase
      .from("ow_job_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", params.id)
      .maybeSingle();
    isFavorited = !!data;
  }

  // 関連求人（同職種・別求人）
  let similarJobs: any[] = [];
  if (job.job_category) {
    const { data } = await supabase
      .from("ow_jobs")
      .select(
        `id, title, salary_min, salary_max, job_category,
        ow_companies(id, name, brand_color, url, logo_url)`
      )
      .eq("job_category", job.job_category)
      .eq("status", "active")
      .neq("id", params.id)
      .limit(3);
    similarJobs = data || [];
  }

  // 求人要件を整理
  const requirements = job.ow_job_requirements || [];
  const mustReqs = requirements
    .filter((r: any) => r.requirement_type === "must")
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
  const wantReqs = requirements
    .filter((r: any) => r.requirement_type === "want")
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-[#f8f8f6]">
        <JobDetailClient
          job={job}
          company={company}
          matchScore={matchScore}
          isFavorited={isFavorited}
          isLoggedIn={!!user}
          mustReqs={mustReqs}
          wantReqs={wantReqs}
          similarJobs={similarJobs}
        />
      </main>
      <Footer />
    </>
  );
}
