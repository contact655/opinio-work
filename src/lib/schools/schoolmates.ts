import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCHABLE_SCHOOL_TYPES } from "@/lib/constants/schools";
import { isRegisteredUser } from "@/lib/users/registered";
import { resolveExperienceCompanyLabel, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";

/**
 * ★プロフィールの「同じ学校の人」（2026-10-21 / 柴さんの指示）。
 *   プロフィールの持ち主と同じ学校（大学・大学院・高校）に登録している他のユーザーを、学校ごとに数人ずつ返す。
 * ⚠️ 見せる範囲は学校のページと同じ: ログイン中だけ（呼ぶ側が判定）・大学・大学院・高校だけ（SEARCHABLE_SCHOOL_TYPES）。
 *    非公開・検証用・システム・本人が登録していない行は出さない
 * ⚠️ 持ち主と見ている人は並べない。見ている人も同じ学校なら viewerAlso を立てる（「あなたも◯◯の出身です」）
 */
export type Schoolmate = { userId: string; name: string; initial: string; avatarUrl: string | null; sub: string };
export type SchoolmateGroup = { schoolId: string; schoolName: string; total: number; people: Schoolmate[]; viewerAlso: boolean };

const PER_SCHOOL = 8;

export async function getSchoolmates(ownerId: string, viewerId: string | null): Promise<SchoolmateGroup[]> {
  const db = createAdminClient();
  const { data: own, error: ownErr } = await db
    .from("ow_user_educations")
    .select("school_id, ow_schools!school_id(id, name, type)")
    .eq("user_id", ownerId)
    .not("school_id", "is", null);
  if (ownErr) console.error("[schoolmates] own:", ownErr.message);
  type School = { id: string; name: string; type: string | null };
  const schools = new Map<string, School>();
  for (const r of (own ?? []) as unknown as { school_id: string; ow_schools: School | School[] | null }[]) {
    const sc = Array.isArray(r.ow_schools) ? r.ow_schools[0] : r.ow_schools;
    if (sc && (SEARCHABLE_SCHOOL_TYPES as readonly string[]).includes(sc.type ?? "")) schools.set(sc.id, sc);
  }
  if (schools.size === 0) return [];

  const { data: rows, error } = await db
    .from("ow_user_educations")
    .select("school_id, user_id, ow_users!user_id(id, name, avatar_url, visibility, is_test, is_system, auth_id)")
    .in("school_id", Array.from(schools.keys()));
  if (error) console.error("[schoolmates] peers:", error.message);
  type U = { id: string; name: string | null; avatar_url: string | null; visibility: string | null; is_test: boolean | null; is_system: boolean | null; auth_id: string | null };
  const bySchool = new Map<string, Map<string, U>>();
  const viewerSchools = new Set<string>();
  for (const r of (rows ?? []) as unknown as { school_id: string; user_id: string; ow_users: U | U[] | null }[]) {
    if (viewerId && r.user_id === viewerId) { viewerSchools.add(r.school_id); continue; }
    if (r.user_id === ownerId) continue;
    const u = Array.isArray(r.ow_users) ? r.ow_users[0] : r.ow_users;
    /* ⚠️ auth_id を select から落とさないこと（落とすと全員が外れる） */
    if (!u?.name || u.is_test || u.is_system || u.visibility === "private" || !isRegisteredUser(u)) continue;
    const m = bySchool.get(r.school_id) ?? new Map<string, U>();
    m.set(u.id, u);
    bySchool.set(r.school_id, m);
  }

  const shownIds = Array.from(new Set(Array.from(bySchool.values()).flatMap((m) => Array.from(m.keys()).slice(0, PER_SCHOOL))));
  const subs = new Map<string, string>();
  if (shownIds.length > 0) {
    const { data: exps, error: expErr } = await db
      .from("ow_experiences")
      .select(`user_id, role_title, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", shownIds).eq("is_current", true);
    if (expErr) console.error("[schoolmates] experiences:", expErr.message);
    for (const e of (exps ?? []) as unknown as ({ user_id: string; role_title: string | null } & Parameters<typeof resolveExperienceCompanyLabel>[0])[]) {
      if (subs.has(e.user_id)) continue;
      const s = [resolveExperienceCompanyLabel(e), e.role_title].filter(Boolean).join(" / ");
      if (s) subs.set(e.user_id, s);
    }
  }

  return Array.from(schools.values())
    .map((sc) => {
      const m = bySchool.get(sc.id) ?? new Map<string, U>();
      const people = Array.from(m.values()).slice(0, PER_SCHOOL).map((u) => ({
        userId: u.id, name: u.name as string, initial: (u.name as string).charAt(0), avatarUrl: u.avatar_url, sub: subs.get(u.id) ?? "",
      }));
      return { schoolId: sc.id, schoolName: sc.name, total: m.size, people, viewerAlso: viewerSchools.has(sc.id) };
    })
    .filter((g) => g.total > 0 || g.viewerAlso);
}
