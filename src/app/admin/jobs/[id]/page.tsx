import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import JobDetailClient from "./JobDetailClient";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import type { RoleItem } from "@/components/business/JobEditForm";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function AdminJobDetailPage({ params }: Props) {
  const supabase = createAdminClient();

  // Fetch job + company in parallel
  const { data: job, error } = await supabase
    .from("ow_jobs")
    .select(`
      id, title, job_category, employment_type, department,
      ow_job_roles!job_id(is_primary, ow_roles!role_id(name)),
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
      source_url, source_verified_at,
      rejection_reason, rejection_date, rejection_reviewer,
      company_id,
      ow_companies!company_id (id, name, industry, employee_count, is_published)
    `)
    .eq("id", params.id)
    .single();

  if (error || !job) notFound();

  /*
    職種の編集用データ。求人フォームと同じ絞り込み（is_active かつ is_it_saas）にする。
    ⚠️ 選択中の職種とその親は、条件から外れていても候補に足し戻す。
       落とすと画面のタグから消え、運営が別項目だけ直して保存した瞬間に職種が失われる。
    ⚠️ 職種タグは no-store で引く。付け替えの反映を fetch キャッシュに邪魔させない。
  */
  const noStore = createNoStoreAdminClient();
  const [rolesResult, aliasResult, jobRolesResult] = await Promise.all([
    supabase.from("ow_roles").select("id, parent_id, name, level")
      .eq("is_active", true).eq("is_it_saas", true).order("display_order", { ascending: true }),
    supabase.from("ow_role_aliases").select("role_id, alias"),
    noStore.from("ow_job_roles").select("role_id, is_primary").eq("job_id", params.id),
  ]);
  if (rolesResult.error) console.error("[AdminJobDetailPage] roles", rolesResult.error.message);
  if (jobRolesResult.error) console.error("[AdminJobDetailPage] job_roles", jobRolesResult.error.message);

  const baseRoles = (rolesResult.data ?? []) as RoleItem[];
  const baseIds = new Set(baseRoles.map((r) => r.id));
  const initialJobRoles = (jobRolesResult.data ?? []).map((r) => ({
    roleId: r.role_id as string, isPrimary: r.is_primary === true,
  }));
  const missingIds = initialJobRoles.map((r) => r.roleId).filter((id) => !baseIds.has(id));
  let extraRoles: RoleItem[] = [];
  if (missingIds.length > 0) {
    const { data: missing } = await supabase
      .from("ow_roles").select("id, parent_id, name, level").in("id", missingIds);
    extraRoles = (missing ?? []) as RoleItem[];
    const parentIds = Array.from(new Set(
      extraRoles.map((r) => r.parent_id).filter((id): id is string => !!id && !baseIds.has(id)),
    ));
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from("ow_roles").select("id, parent_id, name, level").in("id", parentIds);
      extraRoles = [...extraRoles, ...((parents ?? []) as RoleItem[])];
    }
  }
  const roles: RoleItem[] = [...baseRoles, ...extraRoles];

  const roleAliases: Record<string, string[]> = {};
  for (const r of (aliasResult.data ?? []) as { role_id: string; alias: string }[]) {
    if (!roleAliases[r.role_id]) roleAliases[r.role_id] = [];
    roleAliases[r.role_id].push(r.alias);
  }

  // Cast the Supabase join result to the shape JobDetailClient expects.
  // The join returns ow_companies as an object or null; the `as unknown` bridge
  // avoids the unsafe `as any` while keeping the explicit target type.
  type JobForClient = Omit<typeof job, "ow_companies"> & {
    ow_companies: { id: string; name: string; industry: string | null; employee_count: string | null; is_published: boolean } | null;
  };
  return (
    <JobDetailClient
      job={job as unknown as JobForClient}
      roles={roles}
      roleAliases={roleAliases}
      initialJobRoles={initialJobRoles}
    />
  );
}
