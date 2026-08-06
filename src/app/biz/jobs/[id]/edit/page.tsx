import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchJobById, fetchTeamMembers } from "@/lib/business/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { RoleItem, DeptItem } from "@/components/business/JobEditForm";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: `求人編集 | OPINIO Business` };
}


export default async function JobEditPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const adminClient = createAdminClient();
  const [jobData, teamMembers, rolesResult, aliasResult, deptsResult] = await Promise.all([
    fetchJobById(supabase, params.id),
    fetchTeamMembers(supabase, ctx.tenantId),
    /*
      求人フォームの職種候補。
      ⚠️ is_active = true かつ is_it_saas = true で絞る（is_it_saas は 2026-08-06 に追加）。
         is_it_saas は「OPINIO の掲載企業（SaaS/IT）の求人で使う職種か」の意味に
         再定義した。非IT系の大分類7件（医療・建設・製造ほか）は求人には出さない。
         ⚠️ ユーザーの職歴入力（/profile/edit）ではこのフラグで絞らないこと。
            過去職歴には非IT職が入る。
    */
    adminClient.from("ow_roles").select("id, parent_id, name, level").eq("is_active", true).eq("is_it_saas", true).order("display_order", { ascending: true }),
    /*
      職種の別名（ow_role_aliases・120件）。検索でヒットさせるために全件渡す。
      ⚠️「法人営業」でフィールドセールスに当たらないと、標準職種の名前を知らない人が
         辿り着けない。ow_roles 99 + 別名 120 = 219件なので全件クライアント渡しでよい。
    */
    adminClient.from("ow_role_aliases").select("role_id, alias"),
    supabase.from("ow_company_departments").select("id, parent_id, name, display_order").eq("company_id", ctx.tenantId).is("deleted_at", null).order("display_order").order("name"),
  ]);

  if (!jobData) {
    return (
      <BusinessLayout userName={ctx.userName} variant="fullBleed">
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
          求人が見つかりませんでした
        </div>
      </BusinessLayout>
    );
  }

  if (jobData.companyId !== ctx.tenantId) {
    notFound();
  }

  /*
    ⚠️ この求人が既に持っている職種は、is_active / is_it_saas の条件から外れていても
       候補に残す。落とすとフォームのタグから消え、企業が別項目だけ直して保存した
       瞬間に職種が失われる。統合・無効化を運用で回す以上、必ず起きる。
    ⚠️ 親も一緒に足すこと。子だけ足しても親セレクトに親が無ければ子セレクトが開かない。
  */
  const baseRoles = (rolesResult.data ?? []) as RoleItem[];
  const baseIds = new Set(baseRoles.map((r) => r.id));
  const missingIds = Array.from(new Set(
    jobData.jobRoles.map((jr) => jr.roleId).filter((id) => !baseIds.has(id)),
  ));

  let extraRoles: RoleItem[] = [];
  if (missingIds.length > 0) {
    const { data: missing } = await adminClient
      .from("ow_roles").select("id, parent_id, name, level").in("id", missingIds);
    extraRoles = (missing ?? []) as RoleItem[];
    const parentIds = Array.from(new Set(
      extraRoles.map((r) => r.parent_id).filter((id): id is string => !!id && !baseIds.has(id)),
    ));
    if (parentIds.length > 0) {
      const { data: parents } = await adminClient
        .from("ow_roles").select("id, parent_id, name, level").in("id", parentIds);
      extraRoles = [...extraRoles, ...((parents ?? []) as RoleItem[])];
    }
  }

  const roles: RoleItem[] = [...baseRoles, ...extraRoles];
  const departments: DeptItem[] = (deptsResult.data ?? []) as DeptItem[];
  const initialDepartmentId = (jobData.job as unknown as { department_id?: string | null }).department_id ?? null;

  /*
    自社での呼び方の初期値。
    ⚠️ 論理削除済み（deleted_at あり）でも入力欄には出す。企業が自分で入れた値なので、
       編集画面で黙って消すと「保存したら消えた」になる。表示側でのフォールバックとは別の話。
  */
  /* ⚠️ fetchJobById の SELECT に company_job_role_id は入っていないので、ここで別途引く。
        fetchJobById 側に足すと、この列を必要としない一覧側まで巻き込む。 */
  let initialCompanyRoleName = "";
  const { data: jobLink, error: jobLinkErr } = await supabase
    .from("ow_jobs")
    .select("company_job_role_id, ow_company_job_roles!company_job_role_id(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (jobLinkErr) console.error("[JobEditPage] company job role", jobLinkErr.message);
  initialCompanyRoleName =
    (jobLink?.ow_company_job_roles as unknown as { name: string } | null)?.name ?? "";

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      variant="fullBleed"
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobEditForm
        mode="edit"
        initialJob={jobData.job}
        initialAssigneeIds={jobData.assigneeIds}
        initialJobRoles={jobData.jobRoles}
        companyId={ctx.tenantId}
        teamMembers={teamMembers}
        roles={roles}
        roleAliases={toAliasMap(aliasResult.data as { role_id: string; alias: string }[] | null)}
        departments={departments}
        initialDepartmentId={initialDepartmentId}
        initialCompanyRoleName={initialCompanyRoleName}
      />
    </BusinessLayout>
  );
}

/** role_id → 別名[] に畳む。RoleSearchSelect にそのまま渡せる形 */
function toAliasMap(rows: { role_id: string; alias: string }[] | null): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const r of rows ?? []) {
    if (!m[r.role_id]) m[r.role_id] = [];
    m[r.role_id].push(r.alias);
  }
  return m;
}
