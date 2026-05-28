import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentContact = {
  id: string;
  agencyId: string;
  name: string;
  email: string;
  isPrimary: boolean;
};

export type AgentAgency = {
  id: string;
  companyId: string;
  agencyName: string;
  memo: string | null;
  isActive: boolean;
  contacts: AgentContact[];
  assignedJobIds: string[];
  candidateCount: number;
};

export type AgentJobPreview = {
  id: string;
  title: string;
  company: { name: string };
};

export type AgentCandidate = {
  id: string;
  name: string;
  email: string | null;
  jobTitle: string;
  pipelineStageId: string | null;
  createdAt: string;
  appliedAtLabel: string;
};

export type AgentPortalData = {
  agency: { id: string; agencyName: string; companyId: string };
  assignedJobs: AgentJobPreview[];
  candidates: AgentCandidate[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日";
  if (days === 1) return "1日前";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all agencies for a given company (with contacts + assigned job IDs + candidate count).
 */
export async function fetchAgenciesForCompany(companyId: string): Promise<AgentAgency[]> {
  const admin = createAdminClient();

  // 1. Agencies
  const { data: agencies, error: agErr } = await admin
    .from("ow_agent_agencies")
    .select("id, company_id, agency_name, memo, is_active, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (agErr || !agencies || agencies.length === 0) return [];

  const agencyIds = agencies.map((a) => a.id);

  // 2. Contacts, assigned jobs, candidates in parallel
  const [contactsRes, agentJobsRes, candidatesRes] = await Promise.all([
    admin
      .from("ow_agent_contacts")
      .select("id, agency_id, name, email, is_primary")
      .in("agency_id", agencyIds)
      .order("is_primary", { ascending: false }),
    admin
      .from("ow_agent_jobs")
      .select("agency_id, job_id")
      .in("agency_id", agencyIds),
    admin
      .from("ow_job_applications")
      .select("id, agency_id")
      .in("agency_id", agencyIds),
  ]);

  const contacts = contactsRes.data ?? [];
  const agentJobs = agentJobsRes.data ?? [];
  const candidates = candidatesRes.data ?? [];

  return agencies.map((a) => ({
    id: a.id,
    companyId: a.company_id,
    agencyName: a.agency_name,
    memo: a.memo ?? null,
    isActive: a.is_active ?? true,
    contacts: contacts
      .filter((c) => c.agency_id === a.id)
      .map((c) => ({
        id: c.id,
        agencyId: c.agency_id,
        name: c.name,
        email: c.email,
        isPrimary: c.is_primary ?? false,
      })),
    assignedJobIds: agentJobs.filter((j) => j.agency_id === a.id).map((j) => j.job_id),
    candidateCount: candidates.filter((c) => c.agency_id === a.id).length,
  }));
}

/**
 * Find the agency for a given contact email.
 * Returns agency info + assigned jobs + submitted candidates.
 */
export async function fetchAgencyByContactEmail(email: string): Promise<AgentPortalData | null> {
  if (!email) return null;
  const admin = createAdminClient();

  // 1. Find contact
  const { data: contact } = await admin
    .from("ow_agent_contacts")
    .select("id, agency_id")
    .eq("email", email)
    .maybeSingle();

  if (!contact) return null;

  // 2. Fetch agency
  const { data: agency } = await admin
    .from("ow_agent_agencies")
    .select("id, agency_name, company_id, is_active")
    .eq("id", contact.agency_id)
    .maybeSingle();

  if (!agency || !agency.is_active) return null;

  // 3. Assigned jobs
  const { data: agentJobs } = await admin
    .from("ow_agent_jobs")
    .select("job_id")
    .eq("agency_id", agency.id);

  const jobIds = (agentJobs ?? []).map((j) => j.job_id);

  // 4. Jobs + company name
  let assignedJobs: AgentJobPreview[] = [];
  if (jobIds.length > 0) {
    const { data: jobRows } = await admin
      .from("ow_jobs")
      .select("id, title, company_id, ow_companies!company_id(name)")
      .in("id", jobIds);
    assignedJobs = (jobRows ?? []).map((j) => ({
      id: j.id,
      title: j.title,
      company: { name: (j.ow_companies as unknown as { name: string } | null)?.name ?? "" },
    }));
  }

  // 5. Candidates submitted by this agency
  const { data: appRows } = await admin
    .from("ow_job_applications")
    .select("id, external_name, external_email, pipeline_stage_id, created_at, job_id")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  // 6. Resolve job titles for candidates
  const candidateJobIds = Array.from(new Set((appRows ?? []).map((a) => a.job_id).filter(Boolean)));
  let jobTitleMap: Record<string, string> = {};
  if (candidateJobIds.length > 0) {
    const { data: jRows } = await admin
      .from("ow_jobs")
      .select("id, title")
      .in("id", candidateJobIds);
    for (const j of jRows ?? []) jobTitleMap[j.id] = j.title;
  }

  const candidates: AgentCandidate[] = (appRows ?? []).map((a) => ({
    id: a.id,
    name: a.external_name ?? "—",
    email: a.external_email ?? null,
    jobTitle: jobTitleMap[a.job_id] ?? "—",
    pipelineStageId: a.pipeline_stage_id ?? null,
    createdAt: a.created_at,
    appliedAtLabel: daysAgo(a.created_at),
  }));

  return {
    agency: { id: agency.id, agencyName: agency.agency_name, companyId: agency.company_id },
    assignedJobs,
    candidates,
  };
}
