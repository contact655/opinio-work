import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage = {
  id: string;
  companyId: string;
  name: string;
  color: string;
  orderIndex: number;
  isHired: boolean;
  isRejected: boolean;
};

export type PipelineCandidate = {
  id: string; // ow_job_applications.id
  jobId: string;
  jobTitle: string;
  userId: string | null;
  name: string; // external_name OR ow_users.name
  email: string | null;
  source: string;
  agentCompany: string | null;
  pipelineStageId: string | null;
  memo: string | null;
  createdAt: string;
  appliedAtLabel: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAppliedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchPipelineData(companyId: string): Promise<{
  stages: PipelineStage[];
  candidates: PipelineCandidate[];
  jobs: { id: string; title: string }[];
}> {
  const supabase = createAdminClient();

  const [stagesRes, appsRes, jobsRes] = await Promise.all([
    // Stages for this company
    supabase
      .from("ow_pipeline_stages")
      .select("id, company_id, name, color, order_index, is_hired, is_rejected")
      .eq("company_id", companyId)
      .order("order_index", { ascending: true }),

    // Applications for this company's jobs, joined with job title + user info
    supabase
      .from("ow_job_applications")
      .select(`
        id,
        job_id,
        user_id,
        source,
        agent_company,
        pipeline_stage_id,
        external_name,
        external_email,
        memo,
        created_at,
        ow_jobs!inner(id, title, company_id),
        ow_users(id, name, email)
      `)
      .eq("ow_jobs.company_id", companyId),

    // Published (and active) jobs for this company — used in the add-candidate modal
    supabase
      .from("ow_jobs")
      .select("id, title")
      .eq("company_id", companyId)
      .in("status", ["published", "active"])
      .order("created_at", { ascending: false }),
  ]);

  const stages: PipelineStage[] = (stagesRes.data ?? []).map((s) => ({
    id: s.id,
    companyId: s.company_id,
    name: s.name,
    color: s.color,
    orderIndex: s.order_index,
    isHired: s.is_hired ?? false,
    isRejected: s.is_rejected ?? false,
  }));

  const candidates: PipelineCandidate[] = (appsRes.data ?? []).map((a) => {
    const job = Array.isArray(a.ow_jobs) ? a.ow_jobs[0] : a.ow_jobs;
    const user = Array.isArray(a.ow_users) ? a.ow_users[0] : a.ow_users;
    const name =
      a.external_name ||
      (user as { name?: string } | null)?.name ||
      "(名前なし)";
    const email =
      a.external_email ||
      (user as { email?: string } | null)?.email ||
      null;
    return {
      id: a.id,
      jobId: a.job_id,
      jobTitle: (job as { title?: string } | null)?.title ?? "—",
      userId: a.user_id ?? null,
      name,
      email,
      source: a.source ?? "opinio",
      agentCompany: a.agent_company ?? null,
      pipelineStageId: a.pipeline_stage_id ?? null,
      memo: a.memo ?? null,
      createdAt: a.created_at,
      appliedAtLabel: formatAppliedAt(a.created_at),
    };
  });

  const jobs = (jobsRes.data ?? []).map((j) => ({
    id: j.id,
    title: j.title,
  }));

  return { stages, candidates, jobs };
}
