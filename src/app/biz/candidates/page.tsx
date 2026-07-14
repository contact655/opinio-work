import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CandidatesClient from "./CandidatesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求職者を探す | OPINIO Business" },
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

  const supabase = createClient();
  const adminClient = createAdminClient();

  // 転職勧奨禁止期間中の候補者IDを取得（就職後2年以内かつ在職中）
  const { data: blockedPlacements } = await adminClient
    .from("ow_placements")
    .select("candidate_id")
    .is("resigned_at", null)
    .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const blockedCandidateIds = new Set((blockedPlacements ?? []).map((p: any) => p.candidate_id as string));

  // スカウト同意済みの求職者候補を取得
  // - visibility = 'private' は明示的な非表示意思表示なので除外
  // - is_system = true のシステムユーザーを除外
  // - 実際の候補者絞り込みは scout_enabled = true（下のフィルタで実施）
  const { data: rawUsers } = await supabase
    .from("ow_users")
    .select("id, name, location, is_mentor, created_at, auth_id")
    .neq("visibility", "private")
    .not("is_system", "eq", true)
    .order("created_at", { ascending: false })
    .limit(500);

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);
  const authIds = (rawUsers ?? [])
    .filter((u: any) => u.auth_id)
    .map((u: any) => u.auth_id as string);

  // ow_profiles: user_id = auth.users.id（= ow_users.auth_id）経由で取得
  const profilesByAuthId = new Map<string, {
    onboarding_completed: boolean;
    desired_work_style: string | null;
    job_type: string | null;
    desired_phase: string[] | null;
    transfer_timing: string | null;
    scout_enabled: boolean | null;
  }>();

  // プロフィール + 送信枠 を並列取得
  const [profileRows, quotaRow] = await Promise.all([
    authIds.length > 0
      ? adminClient
          .from("ow_profiles")
          .select("user_id, onboarding_completed, desired_work_style, job_type, desired_phase, transfer_timing, scout_enabled")
          .in("user_id", authIds)
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    // スカウト送信枠
    adminClient
      .from("ow_scout_quotas")
      .select("monthly_limit, bonus_credits, used_this_month, period_start")
      .eq("company_id", ctx.tenantId)
      .maybeSingle()
      .then(r => r.data),
  ]);

  for (const p of profileRows) {
    profilesByAuthId.set(p.user_id as string, p as any);
  }

  // 送信枠の計算
  const monthlyLimit = quotaRow?.monthly_limit ?? 30;
  const bonusCredits = quotaRow?.bonus_credits ?? 0;
  const usedThisMonth = quotaRow?.used_this_month ?? 0;
  const remainingQuota = Math.max(0, monthlyLimit + bonusCredits - usedThisMonth);

  // Step 1: scout_enabled = true の候補者だけに絞る（転職勧奨禁止も除外）
  const scoutEnabledUsers = (rawUsers ?? []).filter((u: any) => {
    if (blockedCandidateIds.has(u.id as string)) return false;
    const authId = u.auth_id as string | null;
    const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
    return profile?.scout_enabled === true;
  });

  // Step 2: can_send_scout(company_id, candidate_auth_id) RPC で名前マッチも含めてフィルタ
  // （company_id=NULL の職務経歴でも会社名正規化で突き合わせる）
  const canSendResults = await Promise.all(
    scoutEnabledUsers.map(async (u: any) => {
      const authId = u.auth_id as string | null;
      if (!authId) return false;
      const { data } = await adminClient.rpc("can_send_scout", {
        p_company_id: ctx.tenantId,
        p_candidate_id: authId,
      });
      return data === true;
    })
  );

  // 現職情報を別取得（is_current = true の最初の 1 件）
  const { data: currentExps } = userIds.length > 0
    ? await supabase
        .from("ow_experiences")
        .select("user_id, role_title, company_text, company_anonymized")
        .in("user_id", userIds)
        .eq("is_current", true)
    : { data: [] };

  // user_id → current exp のマップ
  const currentExpByUser = new Map<string, { role_title: string | null; company: string | null }>();
  for (const exp of currentExps ?? []) {
    if (!currentExpByUser.has(exp.user_id as string)) {
      const company = (exp.company_text as string | null)
        || (exp.company_anonymized as string | null)
        || null;
      currentExpByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        company,
      });
    }
  }

  // 自社の求人一覧（スカウト送信時の求人選択に使う）
  const { data: companyJobs } = await adminClient
    .from("ow_jobs")
    .select("id, title")
    .eq("company_id", ctx.tenantId)
    .in("status", ["published", "active"])
    .order("title");

  const candidates = scoutEnabledUsers
    .filter((_u: any, i: number) => canSendResults[i] === true)
    .map((u: any) => {
      const authId = u.auth_id as string | null;
      const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
      const currentExp = currentExpByUser.get(u.id as string) ?? null;
      return {
        id: u.id as string,
        name: (u.name as string) || "名前未設定",
        location: (u.location as string) || null,
        isMentor: (u.is_mentor as boolean) || false,
        currentRole: currentExp?.role_title ?? null,
        currentCompany: currentExp?.company ?? null,
        jobType: profile?.job_type || null,
        workStyle: profile?.desired_work_style || null,
        desiredPhase: profile?.desired_phase || null,
        transferTiming: profile?.transfer_timing || null,
        onboardingCompleted: profile?.onboarding_completed || false,
        createdAt: u.created_at as string,
      };
    });

  const layoutProps = ctx
    ? {
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }
    : { userName: "担当者" };

  const scoutQuota = {
    monthlyLimit,
    bonusCredits,
    usedThisMonth,
    remaining: remainingQuota,
  };

  const jobOptions = (companyJobs ?? []).map((j: any) => ({ id: j.id as string, title: j.title as string }));

  return (
    <BusinessLayout {...layoutProps}>
      <CandidatesClient candidates={candidates} scoutQuota={scoutQuota} jobOptions={jobOptions} />
    </BusinessLayout>
  );
}
