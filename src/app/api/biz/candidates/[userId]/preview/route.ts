import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { isCompanyReviewed } from "@/lib/business/scoutGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS, MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1）。候補者1人ぶん。
 *
 * ⚠️★見せてよいかは**一覧と同じ関数**（`loadCompanyCandidates` を1人に絞って呼ぶ）。
 *    一覧に出ない人（can_send_scout が false・転職意欲が未設定など）は 404。ここで条件を組み立てない。
 * ⚠️ ゲートは /biz/candidates のページと同じ（審査済み・プランが引ける・candidateSearch が使える）。
 * ⚠️ 職歴の会社名は、本人が伏せている行では出さない（一覧と同じ「非公開企業」）。
 */
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isCompanyReviewed(ctx) || ctx.planType === null || !canUse(ctx.planType, "candidateSearch")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const loaded = await loadCompanyCandidates({
    companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, planType: ctx.planType, onlyOwUserId: params.userId,
  });
  const candidate = loaded.candidates.find((c) => c.id === params.userId);
  if (!candidate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const db = createAdminClient();
  const [userR, expR, skillR, roleTree] = await Promise.all([
    db.from("ow_users").select("about_me").eq("id", params.userId).maybeSingle(),
    db.from("ow_experiences")
      .select(`id, role_title, role_category_id, started_at, ended_at, is_current, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .eq("user_id", params.userId)
      .order("started_at", { ascending: false, nullsFirst: false }),
    db.from("ow_user_skills").select("id, skill:ow_skills(label)").eq("user_id", params.userId).order("created_at", { ascending: true }),
    getRoleTree(),
  ]);
  for (const r of [userR, expR, skillR]) {
    if (r.error) {
      console.error("[candidates/preview]", r.error.message);
      return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
    }
  }

  const experiences = ((expR.data ?? []) as Record<string, unknown>[]).map((e) => ({
    id: e.id as string,
    /* ⚠️★本人が伏せている行は社名を出さない（一覧と同じ置き換え） */
    company: ((e.visibility_company as string | null) ?? "real") === "real"
      ? resolveExperienceCompanyName(e as Parameters<typeof resolveExperienceCompanyName>[0])
      : MASKED_COMPANY_LABEL,
    roleTitle: (e.role_title as string | null) ?? null,
    roleName: e.role_category_id ? roleTree.byId.get(e.role_category_id as string)?.name ?? null : null,
    startedAt: (e.started_at as string | null) ?? null,
    endedAt: (e.ended_at as string | null) ?? null,
    isCurrent: e.is_current === true,
  }));
  const skills = ((skillR.data ?? []) as { skill: { label: string } | { label: string }[] | null }[])
    .map((s) => (Array.isArray(s.skill) ? s.skill[0]?.label : s.skill?.label))
    .filter((l): l is string => !!l);

  return NextResponse.json({
    candidate,
    aboutMe: ((userR.data?.about_me as string | null) ?? "").trim() || null,
    experiences,
    skills,
    touchpointMaterials: loaded.touchpointMaterials,
    approachJobs: loaded.approachJobs,
  });
}
