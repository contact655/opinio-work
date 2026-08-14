import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeesClient } from "./EmployeesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "社員管理 | OPINIO Business" },
};

/** 管理アカウント（`ow_company_admins`）。チーム管理と同じ人たち。 */
export type BizTeamMember = {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  permission: string | null;
  /** 同じ人が経歴（`ow_experiences`）も登録しているか */
  hasExperience: boolean;
};

export type BizEmployee = {
  experienceId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  isMentor: boolean;
  roleTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
};

export default async function EmployeesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();

  /*
    公開を選んだ経歴だけを取得する。

    ⚠️ **`visibility_company` を必ず見ること。** 2026-08-13 まで条件が無く、
       `createAdminClient`（RLS バイパス）で全件引いていたため、
       オンボーディングで「会社名は伏せる」を選んだ人が
       **その勤務先の採用担当者には実名で見えていた**。

       伏せた人が気にしているのは「社名が出ること」ではなく
       **「転職を考えていると今の会社に知られること」**なので、
       ここに出るのはチェックボックスの文面から誰も予想できない。
       CLAUDE.md「ユーザーの非表示希望と企業側の掲載要望が衝突したら
       必ずユーザー側を優先する」（2026-08-02 確立）に従う。

    ⚠️ 企業側が失うものは無い。`masked` / `hidden` の人は公開側にも出ていないので、
       社員管理画面（＝公開時の見え方を調整する画面）で企業がすることが元から無い。

    ⚠️ **企業が自分で隠した行（`ow_company_hidden_experiences`）はここで除外しない。**
       あれは企業が解除できる必要がある。除外の主体が違うので混同しないこと。

    ⚠️ NULL も除外される（`.eq` は NULL に一致しない）。これは意図どおり。
       値が無いものを「公開してよい」とみなさない。
  */
  const { data: rows, error: rowsError } = await admin
    .from("ow_experiences")
    .select(`
      id,
      user_id,
      role_title,
      started_at,
      ended_at,
      is_current,
      ow_users (
        id,
        name,
        avatar_url,
        is_mentor
      )
    `)
    .eq("company_id", ctx.tenantId)
    .eq("visibility_company", "real")
    .order("started_at", { ascending: false });

  // 握り潰さない。0件が「誰もいない」なのか「取得に失敗した」なのか区別できなくなる。
  if (rowsError) {
    console.error("[biz/employees] experiences fetch failed:", rowsError.message);
  }

  // 非表示 experience_id 一覧
  const { data: hiddenRows } = await admin
    .from("ow_company_hidden_experiences")
    .select("experience_id")
    .eq("company_id", ctx.tenantId);
  const hiddenIds = new Set((hiddenRows ?? []).map((r: any) => r.experience_id as string));

  const employees: BizEmployee[] = (rows ?? []).flatMap((row: any) => {
    const user = row.ow_users;
    if (!user) return [];
    return [{
      experienceId: row.id as string,
      userId: user.id as string,
      name: user.name as string | null,
      avatarUrl: user.avatar_url as string | null,
      isMentor: user.is_mentor === true,
      roleTitle: row.role_title as string | null,
      startedAt: row.started_at as string,
      endedAt: row.ended_at as string | null,
      isCurrent: row.is_current as boolean,
    }];
  });

  /* 管理アカウント（チーム管理と同じ `ow_company_admins`）。
     ⚠️ **社員管理はチーム管理を内包する。** 2026-08-14 まで、この画面は
        `ow_experiences`（本人が公開した在籍情報）しか見ておらず、
        採用担当者本人がどこにも出なかった。
     ⚠️ ただし2つは意味が違う（経歴＝本人が公開した在籍情報／
        管理アカウント＝採用管理の権限）。**同じ一覧に混ぜず、区分を分けて出す。** */
  const { data: adminRows, error: adminErr } = await admin
    .from("ow_company_admins")
    .select("user_id, permission, is_active, ow_users (id, name, email, avatar_url)")
    .eq("company_id", ctx.tenantId)
    .eq("is_active", true);
  if (adminErr) console.error("[biz/employees] admins fetch failed:", adminErr.message);

  const experienceUserIds = new Set((rows ?? []).map((r: any) => r.user_id as string));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMembers: BizTeamMember[] = (adminRows ?? []).flatMap((r: any) => {
    const u = r.ow_users;
    if (!u) return [];
    return [{
      userId: u.id as string,
      name: (u.name as string | null) ?? null,
      email: (u.email as string | null) ?? null,
      avatarUrl: (u.avatar_url as string | null) ?? null,
      permission: (r.permission as string | null) ?? null,
      hasExperience: experienceUserIds.has(u.id as string),
    }];
  });

  const current = employees.filter((e) => e.isCurrent && !hiddenIds.has(e.experienceId));
  const alumni = employees.filter((e) => !e.isCurrent && !hiddenIds.has(e.experienceId));
  const hidden = employees.filter((e) => hiddenIds.has(e.experienceId));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <EmployeesClient
        current={current}
        teamMembers={teamMembers}
        alumni={alumni}
        hidden={hidden}
        companyName={ctx.tenantName ?? ""}
      />
    </BusinessLayout>
  );
}
