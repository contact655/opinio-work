import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const [deptResult, jobRolesResult, stdRolesResult] = await Promise.all([
    supabase
      .from("ow_company_departments")
      .select("id, parent_id, name, display_order")
      .eq("company_id", ctx.tenantId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),

    supabase
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
  ]);

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
          />
        ) : (
          <JobRolesEditor
            initialRoles={(jobRolesResult.data ?? []) as CompanyJobRole[]}
            standardRoles={(stdRolesResult.data ?? []) as StandardRole[]}
            readOnly={!isAdmin}
          />
        )}
      </div>
    </BusinessLayout>
  );
}
