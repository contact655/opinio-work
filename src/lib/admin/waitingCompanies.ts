import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickWaitingCompanies, type Wait, type WaitingCompany } from "./waitingCompaniesPick";

/**
 * ★利用者が待っているのに、答えられる担当者がいない企業（2026-10-17 / 柴さんの指示）。
 *
 * それまで、担当者のいない企業への応募・面談申込・「興味あり」は**運営へのメール**（【担当者未登録】）にしか
 * 出ておらず、まとめて見られる画面が無かった。運営が担当者の登録を案内する相手を、ここで1つの一覧にする。
 *
 * 待っているもの（どれも「まだ誰も手を付けていない」状態だけ）:
 *   応募        … ow_job_applications.status = 'pending'（求人 → 企業）
 *   面談の申込  … ow_casual_meetings.status = 'pending'
 *   興味あり    … ow_for_you_reactions.reaction = 'interested'（あなたに合う会社）
 *
 * 「担当者がいない」は、**待っている人と is_test が一致する有効な担当者がいない**こと。
 *   ⚠️ 「あなたに合う会社」の hasResponder（lib/forYou/rank.ts）と同じ線。検証用の担当者しかいない
 *      実在の企業（2026-10-17 時点のセールスフォース）は、実在の利用者にとっては「担当者なし」。
 * ⚠️ 検証用の利用者の行は隠さず `testOnly` で区別する（CLAUDE.md「完全に隠さないこと」）。
 * ⚠️ 取得に失敗したら null（0社と読ませない）。
 */
export type { WaitingCompany } from "./waitingCompaniesPick";

export async function loadWaitingCompanies(): Promise<WaitingCompany[] | null> {
  const db = createAdminClient();
  const [apps, meets, likes] = await Promise.all([
    db.from("ow_job_applications").select("user_id, created_at, ow_jobs!job_id(company_id)").eq("status", "pending"),
    db.from("ow_casual_meetings").select("user_id, company_id, created_at").eq("status", "pending"),
    db.from("ow_for_you_reactions").select("user_id, company_id, interested_at, created_at").eq("reaction", "interested"),
  ]);
  for (const [label, r] of [["applications", apps], ["meetings", meets], ["interested", likes]] as const) {
    if (r.error) { console.error(`[waitingCompanies] ${label}:`, r.error.message); return null; }
  }

  const waits: Wait[] = [];
  for (const a of (apps.data ?? []) as unknown as { user_id: string | null; created_at: string; ow_jobs: { company_id: string | null } | null }[]) {
    const cid = a.ow_jobs?.company_id;
    if (cid && a.user_id) waits.push({ companyId: cid, userId: a.user_id, at: a.created_at, kind: "applications" });
  }
  for (const m of (meets.data ?? []) as { user_id: string | null; company_id: string | null; created_at: string }[]) {
    if (m.company_id && m.user_id) waits.push({ companyId: m.company_id, userId: m.user_id, at: m.created_at, kind: "meetings" });
  }
  for (const l of (likes.data ?? []) as { user_id: string | null; company_id: string | null; interested_at: string | null; created_at: string }[]) {
    if (l.company_id && l.user_id) waits.push({ companyId: l.company_id, userId: l.user_id, at: l.interested_at ?? l.created_at, kind: "interested" });
  }
  if (waits.length === 0) return [];

  const companyIds = Array.from(new Set(waits.map((w) => w.companyId)));
  const userIds = Array.from(new Set(waits.map((w) => w.userId)));
  const [cos, users, staff, joins] = await Promise.all([
    db.from("ow_companies").select("id, name, name_en, slug").in("id", companyIds),
    db.from("ow_users").select("id, is_test").in("id", userIds),
    db.from("ow_company_admins").select("company_id, ow_users!user_id(is_test)").in("company_id", companyIds).eq("is_active", true).not("user_id", "is", null),
    db.from("ow_company_join_requests").select("target_company_id").eq("status", "pending").in("target_company_id", companyIds),
  ]);
  for (const [label, r] of [["companies", cos], ["users", users], ["staff", staff], ["join", joins]] as const) {
    if (r.error) { console.error(`[waitingCompanies] ${label}:`, r.error.message); return null; }
  }

  const userTest = new Map(((users.data ?? []) as { id: string; is_test: boolean | null }[]).map((u) => [u.id, u.is_test === true]));
  /* 企業ごとに「実在の担当者がいるか」「検証用の担当者がいるか」 */
  const staffBy = new Map<string, { real: boolean; test: boolean }>();
  for (const s of (staff.data ?? []) as unknown as { company_id: string; ow_users: { is_test: boolean | null } | null }[]) {
    const cur = staffBy.get(s.company_id) ?? { real: false, test: false };
    if (s.ow_users?.is_test === true) cur.test = true; else if (s.ow_users) cur.real = true;
    staffBy.set(s.company_id, cur);
  }
  const joinSet = new Set(((joins.data ?? []) as { target_company_id: string | null }[]).map((j) => j.target_company_id));
  const coBy = new Map(((cos.data ?? []) as { id: string; name: string; name_en: string | null; slug: string | null }[]).map((c) => [c.id, c]));

  return pickWaitingCompanies({
    waits,
    userIsTest: userTest,
    staff: staffBy,
    joinRequestCompanyIds: new Set(Array.from(joinSet).filter((x): x is string => !!x)),
    companies: coBy,
  });
}
