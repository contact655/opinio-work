import { createClient } from "@/lib/supabase/server";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { notFound } from "next/navigation";
import { CompanyJobsClient } from "./CompanyJobsClient";

export const revalidate = 60;

export default async function CompanyJobsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("ow_companies")
    .select(
      `id, name, logo_url, logo_gradient, logo_letter, industry, location, employee_count,
      ow_jobs(id, title, job_category, employment_type, salary_min, salary_max, location, work_style, status, published_at, catch_copy, urgency, why_hire)`
    )
    .eq("id", params.id)
    .single();

  if (!company) return notFound();

  const allJobs = ((company.ow_jobs as any[]) || []).filter(
    (j) => j.status === "published" || j.status === "active"
  );

  return (
    <>
      <JobseekerHeader />
      <CompanyJobsClient
        company={{
          id: company.id,
          name: company.name,
          logo_url: company.logo_url ?? null,
          logo_gradient: company.logo_gradient ?? null,
          logo_letter: company.logo_letter ?? null,
          industry: company.industry ?? null,
          location: company.location ?? null,
          employee_count: company.employee_count ?? null,
        }}
        allJobs={allJobs}
      />
      <JobseekerFooter />
    </>
  );
}
