import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyRecruiters, getRoleTree } from "@/lib/supabase/queries";
import { getPublicCompanyManagers, getPublicJobManagers } from "@/lib/nextManager/server";
import { expandWithAncestors } from "@/lib/roles/jobRoles";
import { isRegisteredUser } from "@/lib/users/registered";
import type { RelatedPerson, RelatedRole } from "@/lib/jobs/relatedPeopleTypes";

/**
 * ★求人ページのサイドバー「この募集に関わる人」（2026-11-26 / 柴さんの指示）。
 *   並び: 採用担当 → 配属先マネージャー（Hiring Manager）→ チームメンバー（最大3人）
 *
 * ── 誰を出すか（今のルールをそのまま使う。ゆるめない）──────────────────────
 *   採用担当       … getCompanyRecruiters（会社の有効な担当者・会社と is_test が一致する人）
 *   配属先マネージャー … getPublicJobManagers（本人が「採用中」にしている人だけ）
 *   チームメンバー   … この募集と同じ職種で、その会社に在籍中の人（11-25 の「この職種の現役メンバー」と同じ考え方）
 *                      本人が登録済み・システムでない・非公開でない・会社名を伏せていない・会社と is_test が一致
 *   ⚠️ 共通: 本人が登録していない人（auth_id なし）・システム・非公開（private）は出さない。
 *   ⚠️★未ログインには「公開」（visibility = public）の人だけ。会社で働く人の API と同じ線
 *      （/api/jobseeker/companies/[id]/employees）。それまで採用担当と Hiring Manager はサーバーで描いており、
 *      「ログインユーザーのみ」の人の名前も ISR の HTML に入っていた。
 *
 * ⚠️★メッセージのボタンは採用担当と配属先マネージャーだけ（canMessage）。チームメンバーには付けない。
 *    自分の職歴を登録しただけの人で、話すことに同意していない（2026-10-16 に「話を聞ける人」を撤去した判断）。
 * ⚠️ 同じ人が複数の役割に当たるときは1回だけ出し、役割をまとめる（採用担当／配属先マネージャー）。
 * ⚠️ 検証用の会社では検証用の人を出す（実在の会社は実在の人だけ）。チームメンバーもこの規則にそろえる
 *    （getCompanyEmployees は is_test を常に除くので、ここでは自前で引く）。
 */
export const MAX_MEMBERS = 3;

type Job = { id: string; company_id: string; role_category_id: string | null };

export async function loadJobRelatedPeople(job: Job, viewer: { loggedIn: boolean }): Promise<RelatedPerson[]> {
  const db = createAdminClient();
  const [recruiters, managers, { data: co, error: coErr }] = await Promise.all([
    getCompanyRecruiters(job.company_id),
    getPublicJobManagers(job.id, job.company_id, db),
    db.from("ow_companies").select("is_test").eq("id", job.company_id).maybeSingle(),
  ]);
  if (coErr) console.error("[relatedPeople] company:", coErr.message);
  const companyIsTest = co?.is_test === true;

  /* 採用担当・マネージャーの公開範囲（getCompanyRecruiters / getPublicJobManagers は visibility を返さないので引く） */
  const userInfo = await loadStaffInfo(db, [...recruiters.map((r) => r.user_id), ...managers.map((m) => m.userId)]);
  if (!userInfo) return [];
  const visible = (visibility: string | null, authId: string | null, isSystem: boolean | null) =>
    isVisibleTo(viewer, visibility, authId, isSystem);

  const out: RelatedPerson[] = [];
  const byId = new Map<string, RelatedPerson>();
  const add = (p: Omit<RelatedPerson, "roles"> & { role: RelatedRole }) => {
    const prev = byId.get(p.userId);
    if (prev) {
      if (!prev.roles.includes(p.role)) prev.roles.push(p.role);
      prev.canMessage = prev.canMessage || p.canMessage;
      prev.title = prev.title ?? p.title;
      return;
    }
    const { role, ...rest } = p;
    const row: RelatedPerson = { ...rest, roles: [role] };
    byId.set(p.userId, row);
    out.push(row);
  };

  for (const r of recruiters) {
    const u = userInfo.get(r.user_id);
    if (!u || !visible(u.visibility, u.auth_id, u.is_system)) continue;
    add({
      userId: r.user_id, name: r.name, avatarUrl: r.avatar_url,
      title: [r.department, r.role_title].filter(Boolean).join(" ・ ") || null,
      role: "recruiter", canMessage: true,
    });
  }
  for (const m of managers) {
    const u = userInfo.get(m.userId);
    if (!u || !visible(u.visibility, u.auth_id, u.is_system)) continue;
    add({ userId: m.userId, name: m.name, avatarUrl: m.avatarUrl, title: m.headline, role: "manager", canMessage: true });
  }

  for (const mem of await loadMembers(db, job, companyIsTest)) {
    if (byId.has(mem.userId)) continue; // 採用担当・マネージャーとして出ている人はメンバーに重ねない
    if (!visible(mem.visibility, mem.authId, mem.isSystem)) continue;
    if (out.filter((p) => p.roles.includes("member")).length >= MAX_MEMBERS) break;
    add({ userId: mem.userId, name: mem.name, avatarUrl: mem.avatarUrl, title: mem.roleTitle, role: "member", canMessage: false });
  }
  return out;
}

type Member = {
  userId: string; name: string; avatarUrl: string | null; roleTitle: string | null;
  authId: string | null; visibility: string | null; isSystem: boolean | null;
};

/** この募集と同じ職種で、その会社に在籍中の人。判定は getJobEmployees と同じ（親↔子の両方向・兄弟は入れない） */
async function loadMembers(db: ReturnType<typeof createAdminClient>, job: Job, companyIsTest: boolean): Promise<Member[]> {
  if (!job.role_category_id) return [];
  const { data: rows, error } = await db
    .from("ow_experiences")
    .select("id, role_title, role_category_id, started_at, ow_users!user_id(id, name, avatar_url, auth_id, is_test, is_system, visibility)")
    .eq("company_id", job.company_id)
    .eq("is_current", true)
    .eq("visibility_company", "real")
    .order("started_at", { ascending: false });
  if (error) { console.error("[relatedPeople] members:", error.message); return []; }
  type Row = { id: string; role_title: string | null; role_category_id: string | null;
    ow_users: { id: string; name: string | null; avatar_url: string | null; auth_id: string | null; is_test: boolean | null; is_system: boolean | null; visibility: string | null } | null };
  const list = ((rows ?? []) as unknown as Row[]).filter((r) => r.ow_users && (r.ow_users.is_test === true) === companyIsTest);
  if (list.length === 0) return [];

  /* 複数職種（ow_experience_roles）。どれか1つでも一致すれば出す（getJobEmployees と同じ） */
  const rolesByExp = new Map<string, string[]>();
  const { data: er, error: erErr } = await db.from("ow_experience_roles").select("experience_id, role_id").in("experience_id", list.map((r) => r.id));
  if (erErr) console.error("[relatedPeople] experience_roles:", erErr.message);
  for (const r of er ?? []) {
    const k = r.experience_id as string;
    rolesByExp.set(k, [...(rolesByExp.get(k) ?? []), r.role_id as string]);
  }

  const tree = await getRoleTree();
  const jobRole = job.role_category_id;
  const jobLineage = new Set(expandWithAncestors(tree, [jobRole]));
  const matches = (roles: string[]) =>
    roles.length > 0 && (roles.some((r) => jobLineage.has(r)) || expandWithAncestors(tree, roles).includes(jobRole));

  const seen = new Set<string>();
  const out: Member[] = [];
  for (const r of list) {
    const u = r.ow_users!;
    if (seen.has(u.id)) continue;
    const roles = Array.from(new Set([...(rolesByExp.get(r.id) ?? []), ...(r.role_category_id ? [r.role_category_id] : [])]));
    if (!matches(roles)) continue;
    const name = (u.name ?? "").trim();
    if (!name) continue;
    seen.add(u.id);
    out.push({ userId: u.id, name, avatarUrl: u.avatar_url, roleTitle: r.role_title, authId: u.auth_id, visibility: u.visibility, isSystem: u.is_system });
  }
  return out;
}

type StaffInfo = { auth_id: string | null; visibility: string | null; is_system: boolean | null };

/** 担当者・マネージャーの公開範囲を引く。⚠️ 取れなければ null（呼び出し側は誰も出さない向きに倒す） */
async function loadStaffInfo(db: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Map<string, StaffInfo> | null> {
  const out = new Map<string, StaffInfo>();
  const uniq = Array.from(new Set(ids));
  if (uniq.length === 0) return out;
  const { data, error } = await db.from("ow_users").select("id, auth_id, visibility, is_system").in("id", uniq);
  if (error) { console.error("[relatedPeople] staff users:", error.message); return null; }
  for (const u of data ?? []) {
    out.set(u.id as string, {
      auth_id: (u.auth_id as string | null) ?? null, visibility: (u.visibility as string | null) ?? null,
      is_system: (u.is_system as boolean | null) ?? null,
    });
  }
  return out;
}

/** ★見せてよいか。本人が登録済み・システムでない・非公開でない。未ログインには「公開」の人だけ */
function isVisibleTo(viewer: { loggedIn: boolean }, visibility: string | null, authId: string | null, isSystem: boolean | null): boolean {
  return isRegisteredUser({ auth_id: authId }) && isSystem !== true && visibility !== "private"
    && (viewer.loggedIn || visibility === "public");
}

/**
 * ★企業ページの「話せる人」（2026-11-26 / 柴さんの指示）。並び: Hiring Manager → 採用担当。
 *   Hiring Manager … getPublicCompanyManagers（担当者で採用中の人＋申告の採用中）
 *   採用担当       … getCompanyRecruiters（求人ページと同じ）
 *   ⚠️ 見せてよいかの判定は求人ページと同じ（isVisibleTo）。ゆるめない。
 *   ⚠️★それまで企業ページは採用担当をサーバーで描いており、「ログインユーザーのみ」の人の名前が未ログインの HTML に入っていた。
 */
export async function loadCompanyContactPeople(companyId: string, viewer: { loggedIn: boolean }): Promise<RelatedPerson[]> {
  const db = createAdminClient();
  const [managers, recruiters] = await Promise.all([
    getPublicCompanyManagers(companyId, db),
    getCompanyRecruiters(companyId),
  ]);
  const info = await loadStaffInfo(db, [...managers.map((m) => m.userId), ...recruiters.map((r) => r.user_id)]);
  if (!info) return [];
  const out: RelatedPerson[] = [];
  const byId = new Map<string, RelatedPerson>();
  const add = (p: Omit<RelatedPerson, "roles"> & { role: RelatedRole }) => {
    const u = info.get(p.userId);
    if (!u || !isVisibleTo(viewer, u.visibility, u.auth_id, u.is_system)) return;
    const prev = byId.get(p.userId);
    if (prev) {
      if (!prev.roles.includes(p.role)) prev.roles.push(p.role);
      prev.title = prev.title ?? p.title;
      return;
    }
    const { role, ...rest } = p;
    const row: RelatedPerson = { ...rest, roles: [role] };
    byId.set(p.userId, row);
    out.push(row);
  };
  for (const m of managers) add({ userId: m.userId, name: m.name, avatarUrl: m.avatarUrl, title: m.headline, role: "manager", canMessage: true });
  for (const r of recruiters) {
    add({
      userId: r.user_id, name: r.name, avatarUrl: r.avatar_url,
      title: [r.department, r.role_title].filter(Boolean).join(" ・ ") || null,
      role: "recruiter", canMessage: true,
    });
  }
  return out;
}
