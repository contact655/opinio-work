import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { DepartmentsEditor } from "./DepartmentsEditor";
import { JobRolesEditor } from "./JobRolesEditor";
import { OrganizationTabs } from "./OrganizationTabs";
import type { Department } from "./DepartmentsEditor";
import type { CompanyJobRole, StandardRole } from "./JobRolesEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  /* ★2026-09-21 に「部門・職種」へ改名（サイドバー・見出しと揃えた）。
        それまでタブの題は「組織マスタ」、見出しは「組織体制」で、しかも
        **求職者向け企業ページの「組織体制」（取材で埋めるチーム構成 org_teams）と同じ名前**だった。
        この画面を編集しても、あちらは変わらない。 */
  title: { absolute: "部門・職種 | OPINIO Business" },
};

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");
  /* ★書き込みは管理者だけ（RLS の auth_is_company_admin と API が同じ条件）。
        メンバーには一覧だけ見せる（2026-09-22） */
  const isAdmin = ctx.currentPermission === "admin";

  const activeTab = searchParams?.tab === "roles" ? "roles" : "departments";

  const adminSupabase = createAdminClient();

  /* ★部門・職種は admin クライアントで読む（2026-09-22）。
        ⚠️ `ow_company_job_roles` の RLS は管理者しか通さず（`auth_is_company_admin`）、
           部門も「管理者」か「企業ページ公開中」しか通さない。セッションのクライアントで読むと
           **メンバーには職種が1件も出ず、閲覧だけの画面が空になっていた。**
        ⚠️ この会社に属していることは上の `getTenantContext` で確かめてある。
           **`company_id` の絞り込みが唯一の防波堤**なので外さないこと。 */
  const [deptResult, jobRolesResult, stdRolesResult, jobsResult, linksResult] = await Promise.all([
    adminSupabase
      .from("ow_company_departments")
      .select("id, parent_id, name, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    adminSupabase
      .from("ow_company_job_roles")
      /* ★`parent_id` も引く（2026-09-19 に職種を階層にした）。
            ⚠️★落とすと `flattenTree` が全行を最上位として並べ、**階層が消える**
               （型では気づけない。`?? null` で埋まるため）。 */
      .select("id, parent_id, name, standard_role_id, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    adminSupabase
      .from("ow_roles")
      /* ★`display_order` も取る（2026-09-05）。⚠️ **親ごとの相対順**なので、
            この order だけでは親子が混ざる。木に組むのは `StandardRoleCombobox` 側。 */
      .select("id, name, parent_id, display_order")
      /* ★無効・統合済みを外す（2026-09-05）。**この画面だけが絞っていなかった。**
            ⚠️ 絞り方は `onboarding/page.tsx` と**同じ**にする。ここ独自の条件を書かない。
            ⚠️ 外れるのは6件（全154 → 148）。すべて「営業」配下で、
               `is_active = false` かつ `merged_into_id` が
               「ソリューションエンジニア・プリセールス」を指している統合済みの行。
            ⚠️★**統合先へ読み替える処理は足さない**（今回のスコープ外）。
               既に統合済みの職種に紐づいている企業がいたら、
               `StandardRoleBadge` が名前を出せなくなる。実測（2026-09-05）では
               `ow_company_job_roles` は**1件**で、指しているのは「エンジニア」
               （有効・未統合）なので**この6件には当たらない**。
               ⚠️ 「0件だから安全」ではない。**何を指しているかを見て判断した。** */
      .is("merged_into_id", null)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    /* ★行ごとの「求人 N件」（2026-09-22）。取るのは紐付けの2列だけ。
          ⚠️ admin で引く（下書きの求人も数えるため）ので、company_id の絞り込みを外さないこと。
          ⚠️ 状態は問わない（下書きでも、その部門・職種を使っていることに変わりはない）。 */
    adminSupabase
      .from("ow_jobs")
      .select("department_id, company_job_role_id")
      .eq("company_id", ctx.tenantId),

    /* ★職種と部門の紐付け（2026-09-22）。admin でしか読めない表 */
    adminSupabase
      .from("ow_company_job_role_departments")
      .select("job_role_id, department_id")
      .eq("company_id", ctx.tenantId),
  ]);
  if (linksResult.error) console.error("[biz/organization] 職種と部門の紐付け:", linksResult.error.message);
  /* ⚠️ 削除済みの部門・職種を指す紐付けは落とす（部門・職種は論理削除なので行が残る） */
  const liveDeptIds = new Set((deptResult.data ?? []).map((d) => d.id as string));
  const liveRoleIds = new Set((jobRolesResult.data ?? []).map((r) => r.id as string));
  const roleDepartments: Record<string, string[]> = {};
  for (const l of linksResult.data ?? []) {
    if (!liveDeptIds.has(l.department_id) || !liveRoleIds.has(l.job_role_id)) continue;
    (roleDepartments[l.job_role_id] ??= []).push(l.department_id);
  }
  const linksOk = !linksResult.error;

  if (jobsResult.error) console.error("[biz/organization] 求人の件数を取得できませんでした:", jobsResult.error.message);
  /* ⚠️ 失敗したら件数を出さない（空の集計＝「どこにも使われていない」に見せない） */
  const deptUsage: Record<string, number> = {};
  const roleUsage: Record<string, number> = {};
  for (const j of jobsResult.data ?? []) {
    if (j.department_id) deptUsage[j.department_id] = (deptUsage[j.department_id] ?? 0) + 1;
    if (j.company_job_role_id) roleUsage[j.company_job_role_id] = (roleUsage[j.company_job_role_id] ?? 0) + 1;
  }
  const usageOk = !jobsResult.error;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ⚠️ 外側の余白は BusinessLayout の main が持つ。ここで中央寄せ・余白を足さない
             （2026-09-21 まで二重に付いていて、ほかの画面より右下にずれていた） */}
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
          部門・職種
        </h1>
        {/* ⚠️★「社員登録」と書かないこと。社員登録の部署は自由入力で、ここと繋がっていない
               （部門タブのヒントからは 2026-09-19 に外していたのに、この一文だけ残っていた）。
            ⚠️ 求職者向けのページ（企業ページ・求人ページ）には出ない。2026-09-21 に確認 */}
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 20px" }}>
          求人を作るときに選ぶ部門と職種を登録します。求職者向けのページには表示されません。
        </p>
        <OrganizationTabs activeTab={activeTab} />
      </div>

      {/* ⚠️★外側の余白はここが持つ。`OrgTreeEditor` 側に書き戻さないこと
             （`/dev/preview/org-tree` に置いたときに余白が入り込む）。 */}
      <div style={{ maxWidth: 1100, paddingTop: 20 }}>
        {activeTab === "departments" ? (
          <DepartmentsEditor
            initialDepartments={(deptResult.data ?? []) as Department[]}
            readOnly={!isAdmin}
            usage={usageOk ? deptUsage : undefined}
            roleDepartments={linksOk ? roleDepartments : undefined}
            jobRoles={(jobRolesResult.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string }))}
          />
        ) : (
          <JobRolesEditor
            initialRoles={(jobRolesResult.data ?? []) as CompanyJobRole[]}
            standardRoles={(stdRolesResult.data ?? []) as StandardRole[]}
            readOnly={!isAdmin}
            usage={usageOk ? roleUsage : undefined}
            departments={(deptResult.data ?? []) as Department[]}
            roleDepartments={linksOk ? roleDepartments : undefined}
          />
        )}
      </div>
    </BusinessLayout>
  );
}
