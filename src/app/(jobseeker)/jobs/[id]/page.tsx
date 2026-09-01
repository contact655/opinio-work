import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getJobBySlugOrId, getJobs } from "@/lib/supabase/queries";
import { fmtMan } from "@/lib/utils/salary";
import { JobDetailView } from "@/components/jobs/JobDetailView";

const getJobBySlugOrIdCached = cache(getJobBySlugOrId);

export const revalidate = 60;

/*
 * ⚠️ **これが無いと `revalidate` が効かない**（2026-08-09 実測）。
 *    本番で突き合わせたところ、動的セグメントは `generateStaticParams` を
 *    持つものだけがキャッシュされていた（詳細は CLAUDE.md）。
 *
 * ⚠️ ここに載らない求人（ビルド後に公開されたもの）も表示できる。
 *    `dynamicParams` の既定が true なので、未知の id は都度レンダリングされ、
 *    以降 revalidate（60秒）に従う。
 *
 * ⚠️ 60秒は掲載状態（`status`）が出るページの上限。伸ばさないこと。
 *    求人を閉じた後も流入し続ける時間になる。
 */
export async function generateStaticParams() {
  // getJobs() は { jobs, companies } を返す。公開中の求人だけが入る
  const { jobs } = await getJobs();
  return jobs.map((j) => ({ id: j.slug ?? j.id }));
}

/**
 * JSON-LD（JobPosting）の employmentType に出す schema.org の語彙。
 * DB の値は日本語（careerOptions.ts の JOB_EMPLOYMENT_TYPES）なので、
 * ここで写せるものだけ写す。**写せない値・未設定は項目ごと出さない。**
 * ⚠️ JOB_EMPLOYMENT_TYPES を増やしたら、ここも足すこと。
 */

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getJobBySlugOrIdCached(params.id);
  if (!result) notFound();
  const { job, company, slug: jobSlug } = result;
  const canonicalId = jobSlug ?? params.id;

  const salaryText = job.salary_min && job.salary_max
    ? `年収${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
    : job.salary_min ? `年収${fmtMan(job.salary_min)}万円〜` : "";

  /* ⚠️ **`??` ではなく `||`。** `mapJob` が `highlight` を
        `catch_copy ?? one_liner ?? ""` で組み立てるので、**値が無いときは空文字で
        null にならない。** `??` だとこのフォールバックは一度も発火せず、
        キャッチコピーの無い求人の meta が年収から始まっていた
        （公開5件は全部持っているので実害は出ていないが、**下書き15件中2件が該当**）。 */
  const description = [
    job.highlight || `${company.name}の${job.role}求人`,
    salaryText,
    job.work_style,
    "IT/SaaS業界の求人はOPINIOで。",
  ].filter(Boolean).join("｜");

  const ogImageUrl = `/api/og?type=job&name=${encodeURIComponent(job.role)}&sub=${encodeURIComponent(company.name)}&badge=${encodeURIComponent(job.roleLabel ?? "")}&v=2`;

  return {
    title: { absolute: `${job.role} — ${company.name} | OPINIO` },
    description,
    alternates: { canonical: `/jobs/${canonicalId}` },
    /* ⚠️ 会社呼称と標準職種名の両方を入れる。呼称だけにすると
          「エンジニア」のような標準職種名でのSEO流入を落とす */
    keywords: [job.role, company.name, job.companyRoleName ?? "", job.roleName ?? "", "IT転職", "SaaS転職", salaryText].filter(Boolean),
    openGraph: {
      title: `${job.role} — ${company.name} | OPINIO`,
      description,
      type: "website",
      url: `/jobs/${canonicalId}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${job.role} — ${company.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${job.role} — ${company.name} | OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

/* ⚠️ 本体は `components/jobs/JobDetailView.tsx`。**プレビューと同じものを描くため。**
      ここにJSXを書き戻さないこと（`/biz/jobs/[id]/preview` と食い違う）。 */
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  return <JobDetailView id={params.id} />;
}
