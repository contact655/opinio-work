import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { createClient } from "@/lib/supabase/server";
import { PlacementTermsPanel } from "./PlacementTermsPanel";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcTotalExperience } from "@/lib/profile/tenure";
import CandidatesClient from "./CandidatesClient";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { getDesiredRolesFor } from "@/lib/profile/desiredRoles";
import { resolveTopRole } from "@/lib/roles/jobRoles";

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

  /** スカウト送信が有効か。⚠️ API 側（POST /api/biz/scouts）と同じ判定にすること。
   *  片方だけ変えると「押せるのに 503」か「押せないのに送れる」になる。 */
  const scoutSendingEnabledEnv = process.env.SCOUT_SENDING_ENABLED === "true";

  /* 人材紹介（成功報酬）の同意。⚠️ 掲載の同意とは別に、**使うときに**取る。
     ⚠️ API 側（POST /api/biz/scouts）でも同じ判定をしている。
        画面を隠すだけでは直接叩けてしまう。 */
  const { data: { user: authUser } } = await createClient().auth.getUser();
  const placementAgreed = authUser ? await hasAgreedTerms(authUser.id, "placement") : false;
  const scoutSendingEnabled = scoutSendingEnabledEnv && placementAgreed;

  const adminClient = createAdminClient();

  // 並列取得: プロフィール・枠・転職禁止・スカウト済みセット
  const [profileRows, quotaRow, blockedPlacements, sentScouts] = await Promise.all([
    adminClient
      .from("ow_profiles")
      .select("user_id, onboarding_completed, desired_work_styles, desired_prefectures, desired_phase, transfer_timing, transfer_timing_updated_at, scout_enabled, desired_salary_min, desired_salary_max")
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

  /* ow_users 取得。
     ⚠️ **`birth_date` は取らない**（2026-08-20）。候補者一覧に年齢を出さず、
        年齢での絞り込みもしないと決めたため。取ってしまうと、いつでも書ける状態が残る。
        絞り込みは「社会人年数」（下の tenureMonths）で行う。
        理由: 労働施策総合推進法9条で募集・採用時の年齢制限は原則禁止。
        表示だけなら各社もしているが、**年齢で絞り込む機能**は禁止行為を直接手助けする形になる。 */
  const { data: rawUsers, error: rawUsersError } = scoutAuthIds.length > 0
    ? await adminClient
        .from("ow_users")
        .select("id, name, location, is_mentor, is_open_to_work, created_at, auth_id")
        .in("auth_id", scoutAuthIds)
        .neq("visibility", "private")
        .not("is_system", "eq", true)
        .eq("is_test", false)
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
    desired_work_styles: string[] | null;
    desired_prefectures: string[] | null;
    desired_phase: string[] | null;
    transfer_timing: string | null;
    transfer_timing_updated_at: string | null;
    scout_enabled: boolean | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
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
      /* ⚠️ error を捨てない（2026-08-20）。失敗すると `data !== true` で
            **その候補者が黙って一覧から消える**（fail-closed だが気づけない）。 */
      const { data, error } = await adminClient.rpc("can_send_scout", {
        p_company_id: ctx.tenantId,
        p_candidate_id: authId,
      });
      if (error) console.error("[candidates] can_send_scout:", error.message);
      return data === true;
    })
  );

  // 現職情報 + 在籍期間（employment_type・started_at 追加）
  const { data: currentExps } = userIds.length > 0
    ? await adminClient
        .from("ow_experiences")
        .select(`user_id, role_title, role_category_id, employment_type, started_at, ${EXPERIENCE_COMPANY_COLS}`)
        .in("user_id", userIds)
        .eq("is_current", true)
    : { data: [] };

  /* ★社会人年数の元データ（2026-08-20）。
     ⚠️ 上の `currentExps` は `is_current=true` だけなので使えない。
        社会人年数は**すべての職歴のうち最も古い started_at** から出す。
     ⚠️ **その都度計算する。列にもトリガーにもしない。**
        職歴を1件足した瞬間に変わる値なので、保存すると必ず古くなる
        （`ow_profiles.experience_years` を自動計算に置き換えた 2026-08-07 と同じ理由）。 */
  const { data: allExpStarts } = userIds.length > 0
    ? await adminClient
        .from("ow_experiences")
        .select("user_id, started_at")
        .in("user_id", userIds)
    : { data: [] };

  const startedAtsByUser = new Map<string, string[]>();
  for (const e of allExpStarts ?? []) {
    const uid = (e as { user_id: string }).user_id;
    const st = (e as { started_at: string | null }).started_at;
    if (!st) continue;
    if (!startedAtsByUser.has(uid)) startedAtsByUser.set(uid, []);
    startedAtsByUser.get(uid)!.push(st);
  }

  const currentExpByUser = new Map<string, {
    role_title: string | null;
    role_category_id: string | null;
    company: string | null;
    employment_type: string | null;
    started_at: string | null;
  }>();
  for (const exp of currentExps ?? []) {
    if (!currentExpByUser.has(exp.user_id as string)) {
      // master（company_id → ow_companies.name）を最優先。
      // ここは以前 company_text だけを見ていたため、マスタ紐づけの職歴
      // （2026-08-03 時点で 18件中13件）が全て社名なしで表示されていた。
      const company = resolveExperienceCompanyName(exp);
      currentExpByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        role_category_id: exp.role_category_id as string | null,
        company,
        employment_type: exp.employment_type as string | null,
        started_at: exp.started_at as string | null,
      });
    }
  }

  // 職種（ow_roles）。
  // ⚠️ 2026-08-04 まで自由記述のスキルタグを出していた。
  //    表記揺れがあり絞り込みの精度が出ないため、マスタに紐づいた職種に置き換えた。
  //    子階層があれば子（フィールドセールス）、無ければ大分類（営業）を出す。
  const roleTree = await getRoleTree();

  // 希望職種（ow_profile_desired_roles）。auth.users.id 引き
  const desiredByAuthId = await getDesiredRolesFor(
    eligibleUsers.map((u: any) => u.auth_id as string | null).filter((id: string | null): id is string => !!id)
  );

  // 自社求人一覧
  const { data: companyJobs } = await adminClient
    .from("ow_jobs")
    .select("id, title")
    .eq("company_id", ctx.tenantId)
    .eq("status", "published").eq("is_test", false)
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
        /* ⚠️ 職歴が0件なら `calcTotalExperience` が null を返す。**0年で埋めない**
              （新卒と未登録が同じになる。CLAUDE.md「値が無いことを、ある値に置き換えない」）。
              絞り込み側は null を落とさず、そのまま表示する。 */
        tenureMonths: calcTotalExperience(startedAtsByUser.get(u.id as string) ?? [])?.months ?? null,
        currentRole: currentExp?.role_title ?? null,
        currentCompany: currentExp?.company ?? null,
        employmentType: currentExp?.employment_type ?? null,
        startedAt: currentExp?.started_at ?? null,
        roleName: (() => {
          const rid = currentExp?.role_category_id;
          return rid ? roleTree.byId.get(rid)?.name ?? null : null;
        })(),
        topRoleName: (() => {
          const top = resolveTopRole(roleTree, currentExp?.role_category_id);
          return top?.name ?? null;
        })(),
        /* 希望職種は ow_profile_desired_roles（複数可）。
           ⚠️ 絞り込みは expandedIds（職種＋祖先）、表示は names（選ばれたものだけ）。
              展開後の名前を出すと、選んでいない「営業」まで出て嘘になる。 */
        desiredRoleIds: authId ? (desiredByAuthId.get(authId)?.expandedIds ?? []) : [],
        desiredRoleNames: authId ? (desiredByAuthId.get(authId)?.names ?? []) : [],
        workStyles: (profile?.desired_work_styles as string[] | null) || null,
        /* 希望勤務地。⚠️ 表示のみ。絞り込みUIの追加は別タスク。 */
        desiredPrefectures: (profile?.desired_prefectures as string[] | null) || null,
        desiredPhase: profile?.desired_phase || null,
        transferTiming: profile?.transfer_timing || null,
        /* ⚠️ NULL のときは鮮度を出さない。「不明」とも書かない（既存39件は全て NULL） */
        transferTimingUpdatedAt: profile?.transfer_timing_updated_at || null,
        desiredSalaryMin: profile?.desired_salary_min ?? null,
        desiredSalaryMax: profile?.desired_salary_max ?? null,
        onboardingCompleted: profile?.onboarding_completed || false,
        alreadyScouted,
        createdAt: u.created_at as string,
      };
    });

  /* 職種フィルタ用の階層。ow_roles を正にする（JOB_TYPES の自由文字列は廃止）。
     ⚠️ 大分類を選んだら配下の子も当たるよう、候補者側は祖先まで展開済みの
        desiredRoleIds を持たせてある。クライアントは includes() で判定するだけ。
     ⚠️ is_it_saas = true の10件に絞る。非IT系の大分類7件（医療・介護・福祉 等）は
        **過去の職歴を書くために用意した葉**で子を持たず、
        IT/SaaS の候補者サーチで「希望職種」として出しても選ばれない。 */
  const { data: itSaasTopRows } = await adminClient
    .from("ow_roles").select("id").is("parent_id", null).eq("is_active", true).eq("is_it_saas", true);
  const itSaasTopIds = new Set((itSaasTopRows ?? []).map((r) => r.id as string));
  const roleFilterTree = roleTree.topLevel
    .filter((top) => itSaasTopIds.has(top.id))
    .map((top) => ({
      id: top.id,
      name: top.name,
      children: Array.from(roleTree.byId.values())
        .filter((r) => r.parentId === top.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((r) => ({ id: r.id, name: r.name })),
    }));

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
      {/* ⚠️ スカウト送信は停止中（2026-08-09）。受信側の画面が無く、送っても
             求職者に届かないため。再開は SCOUT_SENDING_ENABLED=true
             （詳細は CLAUDE.md「スカウトは送れるが、受け取る手段が無い」）。
             候補者検索そのものは使えるのでページは残す。 */}
      {scoutSendingEnabledEnv && !placementAgreed && (
        <PlacementTermsPanel companyId={ctx.tenantId} />
      )}
      {!scoutSendingEnabledEnv && (
        <div style={{
          background: "var(--warm-soft)", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "14px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            スカウト送信は現在準備中です
          </div>
          <div style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.75 }}>
            求職者側の受信画面を用意している最中のため、送信を一時的に停止しています。
            候補者の検索・閲覧はそのままご利用いただけます。
          </div>
        </div>
      )}
      <CandidatesClient candidates={candidates} scoutQuota={scoutQuota} jobOptions={jobOptions} roleFilterTree={roleFilterTree} scoutSendingEnabled={scoutSendingEnabled} />
    </BusinessLayout>
  );
}
