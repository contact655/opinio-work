/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS, MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";

/**
 * ★企業に見せる候補者のプロフィールの中身（自己紹介・経歴・スキル）。2026-10-10 / 候補者探し 段4 で切り出した。
 * ⚠️★右のプレビュー（`/api/biz/candidates/[userId]/preview`）と「声かけを書く」が同じ関数を使う。
 * ⚠️★**見せてよい人かはここでは見ない。** 呼び出し側が先に `loadCompanyCandidates`（can_send_scout）で確かめること。
 * ⚠️ 本人が社名を伏せている職歴は社名を出さない（一覧と同じ「非公開企業」）。
 * ⚠️ 取れなければ null。
 */
export type CandidateProfileForCompany = {
  aboutMe: string | null;
  experiences: { id: string; company: string | null; companyMasked: boolean; roleTitle: string | null; roleName: string | null; startedAt: string | null; endedAt: string | null; isCurrent: boolean }[];
  skills: string[];
};

export async function getCandidateProfileForCompany(owUserId: string): Promise<CandidateProfileForCompany | null> {
  const db = createAdminClient();
  const [userR, expR, skillR, roleTree] = await Promise.all([
    db.from("ow_users").select("about_me").eq("id", owUserId).maybeSingle(),
    db.from("ow_experiences")
      .select(`id, role_title, role_category_id, started_at, ended_at, is_current, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .eq("user_id", owUserId)
      .order("started_at", { ascending: false, nullsFirst: false }),
    db.from("ow_user_skills").select("id, skill:ow_skills(label)").eq("user_id", owUserId).order("created_at", { ascending: true }),
    getRoleTree(),
  ]);
  for (const r of [userR, expR, skillR]) {
    if (r.error) { console.error("[candidates/profile]", r.error.message); return null; }
  }
  const experiences = ((expR.data ?? []) as Record<string, unknown>[]).map((e) => {
    const real = ((e.visibility_company as string | null) ?? "real") === "real";
    return {
      id: e.id as string,
      company: real ? resolveExperienceCompanyName(e as Parameters<typeof resolveExperienceCompanyName>[0]) : MASKED_COMPANY_LABEL,
      companyMasked: !real,
      roleTitle: (e.role_title as string | null) ?? null,
      roleName: e.role_category_id ? roleTree.byId.get(e.role_category_id as string)?.name ?? null : null,
      startedAt: (e.started_at as string | null) ?? null,
      endedAt: (e.ended_at as string | null) ?? null,
      isCurrent: e.is_current === true,
    };
  });
  const skills = ((skillR.data ?? []) as { skill: { label: string } | { label: string }[] | null }[])
    .map((s) => (Array.isArray(s.skill) ? s.skill[0]?.label : s.skill?.label))
    .filter((l): l is string => !!l);
  return { aboutMe: ((userR.data?.about_me as string | null) ?? "").trim() || null, experiences, skills };
}
