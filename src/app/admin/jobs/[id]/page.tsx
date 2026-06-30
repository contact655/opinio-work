import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import JobDetailClient from "./JobDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function AdminJobDetailPage({ params }: Props) {
  const supabase = createAdminClient();

  // Fetch job + company in parallel
  const { data: job, error } = await supabase
    .from("ow_jobs")
    .select(`
      id, title, job_category, employment_type, department,
      salary_min, salary_max, salary_note,
      location, remote_work_status, work_style,
      description_markdown, description,
      required_skills, requirements,
      preferred_skills, preferred,
      culture_fit, selection_steps, selection_process,
      message_to_candidates,
      catch_copy, one_liner,
      probation_period, selection_duration, start_date_preference,
      status, submitted_at, published_at, updated_at,
      rejection_reason, rejection_date, rejection_reviewer,
      company_id,
      ow_companies!company_id (id, name, industry, employee_count, is_published)
    `)
    .eq("id", params.id)
    .single();

  if (error || !job) notFound();

  // Cast the Supabase join result to the shape JobDetailClient expects.
  // The join returns ow_companies as an object or null; the `as unknown` bridge
  // avoids the unsafe `as any` while keeping the explicit target type.
  type JobForClient = Omit<typeof job, "ow_companies"> & {
    ow_companies: { id: string; name: string; industry: string | null; employee_count: string | null; is_published: boolean } | null;
  };
  return <JobDetailClient job={job as unknown as JobForClient} />;
}
