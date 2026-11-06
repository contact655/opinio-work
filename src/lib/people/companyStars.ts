/**
 * ★「あなたを気にしている企業」の数え方（2026-11-06 / 柴さんの判断）。
 *
 * 実体は企業の「候補者を探す」の ☆「気になる」（`ow_candidate_stars`）。
 * 印は会社に1つ（主キーが company_id × candidate_user_id）なので、
 * 担当者が何人いても、1人でも付ければその会社として1社に数える。
 *
 * 数えない会社:
 *   ・停止中（suspended_at がある）
 *   ・検証用かどうかが本人と食い違う（実在の人に検証用の会社の印を見せない。逆も）
 *   ・☆を付けられる担当者（有効な管理者・採用担当）がもういない
 *
 * ⚠️★本人に出すのは数だけ。会社名・誰が付けたか・いつ付けたかは返さない。
 * ⚠️ 何も import しない（`npm test` が直接読む）。DB を読むのは companyStarsServer.ts。
 */

export type StarRow = { company_id: string };
export type StarCompany = { id: string; is_test: boolean | null; suspended_at: string | null };
export type StarStaff = { company_id: string; permission: string | null; is_active: boolean | null };

/** ☆を付けられる権限（`can(..., "candidates.notes")` と同じ集合。旧値 member は採用担当） */
const STAR_ROLES = new Set(["admin", "recruiter", "member"]);

export function countStarringCompanies(
  stars: StarRow[],
  companies: StarCompany[],
  staff: StarStaff[],
  viewerIsTest: boolean,
): number {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const staffed = new Set(
    staff.filter((s) => s.is_active === true && STAR_ROLES.has(s.permission ?? "")).map((s) => s.company_id),
  );
  const counted = new Set<string>();
  for (const s of stars) {
    const c = byId.get(s.company_id);
    if (!c) continue;
    if (c.suspended_at) continue;
    if ((c.is_test === true) !== viewerIsTest) continue;
    if (!staffed.has(c.id)) continue;
    counted.add(c.id);
  }
  return counted.size;
}
