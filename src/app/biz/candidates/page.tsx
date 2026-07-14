import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import CandidatesClient from "./CandidatesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "候補者を探す | OPINIO Business" },
};

export default async function CandidatesPage() {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName="担当者">
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: 40, textAlign: "center", maxWidth: "var(--max-w-form)", margin: "60px auto",
        }}>
          <p style={{ fontSize: 14, color: "var(--error)" }}>
            企業アカウントが見つかりませんでした。ログインし直してください。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  // 未承認企業は候補者検索不可
  if (!ctx.isPublished) {
    return (
      <BusinessLayout {...{
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: "48px 40px", textAlign: "center", maxWidth: 520, margin: "60px auto",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--warm-soft)", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            運営審査が完了するまでお待ちください
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 0 }}>
            候補者検索・スカウト送信は、運営による企業審査が完了した後にご利用いただけます。<br />
            審査が完了次第、メールでご連絡します。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  const adminClient = createAdminClient();

  // 並列取得: プロフィール・枠・転職禁止・スカウト済みセット
  const [profileRows, quotaRow, blockedPlacements, sentScouts] = await Promise.all([
    adminClient
      .from("ow_profiles")
      .select("user_id, onboarding_completed, desired_work_style, job_type, desired_phase, transfer_timing, scout_enabled")
      .eq("scout_enabled", true)
      .then(r => r.data ?? []),
    adminClient
      .from("ow_scout_quotas")
      .select("monthly_limit, bonus_credits, used_this_month, period_start")
      .eq("company_id", ctx.tenantId)
      .maybeSingle()
      .then(r => r.data),
    // 転職勧奨禁止（就職後2年以内かつ在職中）
    adminClient
      .from("ow_placements")
      .select("candidate_id")
      .is("resigned_at", null)
      .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .then(r => r.data ?? []),
    // この企業が既にスカウトを送った candidate_id（auth_id）セット
    adminClient
      .from("ow_scouts")
      .select("candidate_id")
      .eq("company_id", ctx.tenantId)
      .then(r => r.data ?? []),
  ]);

  const blockedCandidateIds = new Set((blockedPlacements).map((p: any) => p.candidate_id as string));
  const scoutedAuthIds = new Set((sentScouts).map((s: any) => s.candidate_id as string));

  // scout_enabled=true ユーザーの auth_id 一覧
  const scoutAuthIds = profileRows.map((p: any) => p.user_id as string);

  // ow_users 取得（birth_date・is_open_to_work を取得）
  const { data: rawUsers, error: rawUsersError } = scoutAuthIds.length > 0
    ? await adminClient
        .from("ow_users")
        .select("id, name, location, is_mentor, is_open_to_work, birth_date, created_at, auth_id")
        .in("auth_id", scoutAuthIds)
        .neq("visibility", "private")
        .not("is_system", "eq", true)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [], error: null };

  if (rawUsersError) {
    console.error("[candidates] ow_users fetch error:", rawUsersError);
  }

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);

  // auth_id → profile マップ
  const profilesByAuthId = new Map<string, {
    onboarding_completed: boolean;
    desired_work_style: string | null;
    job_type: string | null;
    desired_phase: string[] | null;
    transfer_timing: string | null;
    scout_enabled: boolean | null;
  }>();
  for (const p of profileRows) {
    profilesByAuthId.set(p.user_id as string, p as any);
  }

  // 送信枠
  const monthlyLimit = quotaRow?.monthly_limit ?? 30;
  const bonusCredits = quotaRow?.bonus_credits ?? 0;
  const usedThisMonth = quotaRow?.used_this_month ?? 0;
  const remainingQuota = Math.max(0, monthlyLimit + bonusCredits - usedThisMonth);

  // 転職勧奨禁止除外
  const eligibleUsers = (rawUsers ?? []).filter((u: any) => !blockedCandidateIds.has(u.id as string));

  // can_send_scout RPC（自社在籍者除外）
  const canSendResults = await Promise.all(
    eligibleUsers.map(async (u: any) => {
      const authId = u.auth_id as string | null;
      if (!authId) return false;
      const { data } = await adminClient.rpc("can_send_scout", {
        p_company_id: ctx.tenantId,
        p_candidate_id: authId,
      });
      return data === true;
    })
  );

  // 現職情報 + 在籍期間（employment_type・started_at 追加）
  const { data: currentExps } = userIds.length > 0
    ? await adminClient
        .from("ow_experiences")
        .select("user_id, role_title, company_text, company_anonymized, employment_type, started_at")
        .in("user_id", userIds)
        .eq("is_current", true)
    : { data: [] };

  const currentExpByUser = new Map<string, {
    role_title: string | null;
    company: string | null;
    employment_type: string | null;
    started_at: string | null;
  }>();
  for (const exp of currentExps ?? []) {
    if (!currentExpByUser.has(exp.user_id as string)) {
      const company = (exp.company_text as string | null)
        || (exp.company_anonymized as string | null)
        || null;
      currentExpByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        company,
        employment_type: exp.employment_type as string | null,
        started_at: exp.started_at as string | null,
      });
    }
  }

  // スキルタグ（user_id → labels）
  const { data: skillRows } = userIds.length > 0
    ? await adminClient
        .from("ow_user_skill_tags")
        .select("user_id, label, sort_order")
        .in("user_id", userIds)
        .order("sort_order")
    : { data: [] };

  const skillsByUser = new Map<string, string[]>();
  for (const s of skillRows ?? []) {
    const uid = s.user_id as string;
    if (!skillsByUser.has(uid)) skillsByUser.set(uid, []);
    skillsByUser.get(uid)!.push(s.label as string);
  }

  // 自社求人一覧
  const { data: companyJobs } = await adminClient
    .from("ow_jobs")
    .select("id, title")
    .eq("company_id", ctx.tenantId)
    .in("status", ["published", "active"])
    .order("title");

  const candidates = eligibleUsers
    .filter((_u: any, i: number) => canSendResults[i] === true)
    .map((u: any) => {
      const authId = u.auth_id as string | null;
      const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
      const currentExp = currentExpByUser.get(u.id as string) ?? null;
      const alreadyScouted = authId ? scoutedAuthIds.has(authId) : false;
      return {
        id: u.id as string,
        name: (u.name as string) || "名前未設定",
        location: (u.location as string) || null,
        isMentor: (u.is_mentor as boolean) || false,
        isOpenToWork: (u.is_open_to_work as boolean) || false,
        birthYear: (u.birth_date as string) ? new Date(u.birth_date as string).getFullYear() : null,
        currentRole: currentExp?.role_title ?? null,
        currentCompany: currentExp?.company ?? null,
        employmentType: currentExp?.employment_type ?? null,
        startedAt: currentExp?.started_at ?? null,
        skills: skillsByUser.get(u.id as string) ?? [],
        jobType: profile?.job_type || null,
        workStyle: profile?.desired_work_style || null,
        desiredPhase: profile?.desired_phase || null,
        transferTiming: profile?.transfer_timing || null,
        onboardingCompleted: profile?.onboarding_completed || false,
        alreadyScouted,
        createdAt: u.created_at as string,
      };
    });

  const layoutProps = {
    userName: ctx.userName,
    tenantName: ctx.tenantName,
    tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter,
    memberships: ctx.allCompanies,
    currentTenantId: ctx.tenantId,
  };

  const scoutQuota = { monthlyLimit, bonusCredits, usedThisMonth, remaining: remainingQuota };
  const jobOptions = (companyJobs ?? []).map((j: any) => ({ id: j.id as string, title: j.title as string }));

  return (
    <BusinessLayout {...layoutProps}>
      <CandidatesClient candidates={candidates} scoutQuota={scoutQuota} jobOptions={jobOptions} />
    </BusinessLayout>
  );
}
