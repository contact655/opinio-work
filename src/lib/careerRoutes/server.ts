/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { pickLatestExperience } from "@/lib/experiences/latest";
import { hostBlockers, sortRouteTalkTags, type RouteTalkTag } from "@/lib/constants/careerRoutes";

/**
 * ★転職ルートの読み込み（2026-11-11）。表は anon / authenticated に権限が無いので、読むのはここ（admin クライアント）だけ。
 *
 * ⚠️★掲載の判定は lib/constants/careerRoutes.ts の hostBlockers の1か所。ここに条件を書き写さない。
 * ⚠️ 失敗したら null を返す（0人として見せない。「壊れているのに準備中に見える」を作らない）。
 * ⚠️ 返す形にメールアドレスを入れない（公開ページに渡る）。
 */

export type RouteSummary = { id: string; slug: string; fromLabel: string; toLabel: string; displayOrder: number; isPublished: boolean };

export type RouteHostCard = {
  hostId: string;
  userId: string;
  /** /u/ の URL に使う（username があれば username） */
  profileKey: string;
  name: string;
  avatarUrl: string | null;
  /** 今の会社（会社名を出してよい職歴だけ。出せなければ null） */
  currentCompany: string | null;
  /** 今の職種（職種マスタの名前） */
  currentRole: string | null;
  /** いま在籍中か（直近の職歴が現職か） */
  isCurrent: boolean;
  movedYear: number | null;
  talkTags: RouteTalkTag[];
  message: string | null;
};

const ROUTE_COLS = "id, slug, from_label, to_label, display_order, is_published" as const;
const HOST_COLS = "id, route_id, user_id, moved_year, talk_tags, message, accepting_consult, is_listed, approved_at, consent_confirmed_at, consent_method" as const;
const USER_COLS = "id, name, username, avatar_url, visibility, auth_id, is_test, is_system" as const;

function toRoute(r: Record<string, unknown>): RouteSummary {
  return {
    id: r.id as string, slug: r.slug as string, fromLabel: r.from_label as string, toLabel: r.to_label as string,
    displayOrder: (r.display_order as number) ?? 0, isPublished: r.is_published === true,
  };
}

type UserRow = { id: string; name: string; username: string | null; avatar_url: string | null; visibility: string | null; auth_id: string | null; is_test: boolean | null; is_system: boolean | null };

function blockersOf(h: Record<string, unknown>, u: UserRow | undefined, routePublished: boolean): string[] {
  return hostBlockers({
    visibility: u?.visibility, authId: u?.auth_id, isTest: u?.is_test, isSystem: u?.is_system,
    acceptingConsult: h.accepting_consult as boolean | null, isListed: h.is_listed as boolean | null,
    approvedAt: h.approved_at as string | null, routePublished,
    consentConfirmedAt: h.consent_confirmed_at as string | null, consentMethod: h.consent_method as string | null,
  });
}

/** 今の会社と職種（直近の職歴）。会社名は visibility_company = 'real' の職歴だけ出す */
async function currentJobs(userIds: string[]): Promise<Map<string, { company: string | null; role: string | null; isCurrent: boolean }> | null> {
  const out = new Map<string, { company: string | null; role: string | null; isCurrent: boolean }>();
  if (userIds.length === 0) return out;
  const db = createAdminClient();
  const { data: exps, error } = await db.from("ow_experiences")
    .select("user_id, company_id, company_text, role_category_id, started_at, is_current, visibility_company")
    .in("user_id", userIds);
  if (error) { console.error("[careerRoutes] experiences:", error.message); return null; }
  type Exp = { user_id: string; company_id: string | null; company_text: string | null; role_category_id: string | null; started_at: string | null; is_current: boolean | null; visibility_company: string | null };
  const rows = (exps ?? []) as Exp[];
  const latest = new Map<string, Exp>();
  for (const uid of userIds) {
    const l = pickLatestExperience(rows.filter((e) => e.user_id === uid));
    if (l) latest.set(uid, l);
  }
  const companyIds = Array.from(new Set(Array.from(latest.values()).map((e) => e.company_id).filter((x): x is string => !!x)));
  const roleIds = Array.from(new Set(Array.from(latest.values()).map((e) => e.role_category_id).filter((x): x is string => !!x)));
  const [cRes, rRes] = await Promise.all([
    companyIds.length ? db.from("ow_companies").select("id, name, name_en").in("id", companyIds) : Promise.resolve({ data: [], error: null }),
    roleIds.length ? db.from("ow_roles").select("id, name").in("id", roleIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (cRes.error) { console.error("[careerRoutes] companies:", cRes.error.message); return null; }
  if (rRes.error) { console.error("[careerRoutes] roles:", rRes.error.message); return null; }
  const companyName = new Map(((cRes.data ?? []) as { id: string; name: string; name_en: string | null }[]).map((c) => [c.id, companyDisplayName(c.name, c.name_en).displayName]));
  const roleName = new Map(((rRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  for (const [uid, e] of Array.from(latest.entries())) {
    const showCompany = e.visibility_company === "real";
    const company = showCompany ? (e.company_id ? companyName.get(e.company_id) ?? null : (e.company_text?.trim() || null)) : null;
    out.set(uid, { company, role: e.role_category_id ? roleName.get(e.role_category_id) ?? null : null, isCurrent: e.is_current === true });
  }
  return out;
}

function toCard(h: Record<string, unknown>, u: UserRow, job: { company: string | null; role: string | null; isCurrent: boolean } | undefined): RouteHostCard {
  return {
    hostId: h.id as string, userId: u.id, profileKey: u.username || u.id, name: u.name, avatarUrl: u.avatar_url,
    currentCompany: job?.company ?? null, currentRole: job?.role ?? null, isCurrent: job?.isCurrent ?? false,
    movedYear: (h.moved_year as number | null) ?? null,
    talkTags: sortRouteTalkTags(Array.isArray(h.talk_tags) ? (h.talk_tags as unknown[]) : []),
    message: (h.message as string | null) ?? null,
  };
}

/**
 * ルートのページ。
 *   null           … 読み込みに失敗
 *   { route: null } … そのルートが無い・非公開（404）
 *   hosts が空     … 公開されているが掲載できる人が0人（「準備中です」）
 */
export async function getRoutePage(slug: string): Promise<{ route: RouteSummary | null; hosts: RouteHostCard[] } | null> {
  const db = createAdminClient();
  const { data: route, error } = await db.from("ow_career_routes").select(ROUTE_COLS).eq("slug", slug).maybeSingle();
  if (error) { console.error("[careerRoutes] route:", error.message); return null; }
  if (!route || route.is_published !== true) return { route: null, hosts: [] };
  const { data: hosts, error: hErr } = await db.from("ow_route_hosts").select(HOST_COLS)
    .eq("route_id", route.id).eq("is_listed", true).eq("accepting_consult", true);
  if (hErr) { console.error("[careerRoutes] hosts:", hErr.message); return null; }
  const hostRows = (hosts ?? []) as Record<string, unknown>[];
  const userIds = Array.from(new Set(hostRows.map((h) => h.user_id as string)));
  if (userIds.length === 0) return { route: toRoute(route), hosts: [] };
  const { data: users, error: uErr } = await db.from("ow_users").select(USER_COLS).in("id", userIds);
  if (uErr) { console.error("[careerRoutes] users:", uErr.message); return null; }
  const userById = new Map(((users ?? []) as UserRow[]).map((u) => [u.id, u]));
  const listable = hostRows.filter((h) => blockersOf(h, userById.get(h.user_id as string), true).length === 0);
  const jobs = await currentJobs(listable.map((h) => h.user_id as string));
  if (!jobs) return null;
  const cards = listable.map((h) => toCard(h, userById.get(h.user_id as string) as UserRow, jobs.get(h.user_id as string)));
  /* 転職した年が新しい順（無い人は後ろ）、同じなら名前順 */
  cards.sort((a, b) => (b.movedYear ?? -1) - (a.movedYear ?? -1) || a.name.localeCompare(b.name, "ja"));
  return { route: toRoute(route), hosts: cards };
}

export type ProfileRouteEntry = { route: RouteSummary; movedYear: number | null; talkTags: RouteTalkTag[]; message: string | null };

/**
 * プロフィール（/u/[id]）に出す「経験者として掲載されているルート」。掲載条件を満たすものだけ。
 * ⚠️ 失敗したら空配列（プロフィール全体を落とさない）。ログは出す。
 */
export async function getProfileRoutes(userId: string): Promise<ProfileRouteEntry[]> {
  const db = createAdminClient();
  const [hRes, uRes] = await Promise.all([
    db.from("ow_route_hosts").select(HOST_COLS).eq("user_id", userId).eq("is_listed", true).eq("accepting_consult", true),
    db.from("ow_users").select(USER_COLS).eq("id", userId).maybeSingle(),
  ]);
  if (hRes.error) { console.error("[careerRoutes] profile hosts:", hRes.error.message); return []; }
  if (uRes.error) { console.error("[careerRoutes] profile user:", uRes.error.message); return []; }
  const hosts = (hRes.data ?? []) as Record<string, unknown>[];
  if (hosts.length === 0 || !uRes.data) return [];
  const { data: routes, error: rErr } = await db.from("ow_career_routes").select(ROUTE_COLS).in("id", hosts.map((h) => h.route_id as string));
  if (rErr) { console.error("[careerRoutes] profile routes:", rErr.message); return []; }
  const routeById = new Map(((routes ?? []) as Record<string, unknown>[]).map((r) => [r.id as string, toRoute(r)]));
  const user = uRes.data as UserRow;
  return hosts
    .filter((h) => { const r = routeById.get(h.route_id as string); return !!r && blockersOf(h, user, r.isPublished).length === 0; })
    .map((h) => ({
      route: routeById.get(h.route_id as string) as RouteSummary,
      movedYear: (h.moved_year as number | null) ?? null,
      talkTags: sortRouteTalkTags(Array.isArray(h.talk_tags) ? (h.talk_tags as unknown[]) : []),
      message: (h.message as string | null) ?? null,
    }))
    .sort((a, b) => a.route.displayOrder - b.route.displayOrder);
}

/* ── 運営画面 ─────────────────────────────────────────────────────────── */

export type AdminHostExperience = {
  id: string; company: string; role: string | null; startedAt: string | null; endedAt: string | null; isCurrent: boolean; visibilityCompany: string | null;
};
export type AdminHost = {
  hostId: string; routeId: string; userId: string; profileKey: string; name: string; email: string | null;
  visibility: string | null; isTest: boolean;
  movedYear: number | null; talkTags: RouteTalkTag[]; message: string | null;
  acceptingConsult: boolean; isListed: boolean; approvedAt: string | null;
  /** 本人の同意を確認した日時（ISO）と方法 */
  consentConfirmedAt: string | null; consentMethod: string | null;
  /** 出せない理由（空なら公開中） */
  blockers: string[];
  experiences: AdminHostExperience[];
};
export type AdminRoute = RouteSummary & { hosts: AdminHost[]; listedCount: number };

/** 運営画面の一覧。⚠️ 失敗したら null（0件と見せない） */
export async function getAdminRoutes(): Promise<AdminRoute[] | null> {
  const db = createAdminClient();
  const [rRes, hRes] = await Promise.all([
    db.from("ow_career_routes").select(ROUTE_COLS).order("display_order").order("created_at"),
    db.from("ow_route_hosts").select(HOST_COLS).order("created_at"),
  ]);
  if (rRes.error) { console.error("[careerRoutes] admin routes:", rRes.error.message); return null; }
  if (hRes.error) { console.error("[careerRoutes] admin hosts:", hRes.error.message); return null; }
  const hosts = (hRes.data ?? []) as Record<string, unknown>[];
  const userIds = Array.from(new Set(hosts.map((h) => h.user_id as string)));
  let users: (UserRow & { email: string | null })[] = [];
  let exps: Record<string, unknown>[] = [];
  if (userIds.length) {
    const [uRes, eRes] = await Promise.all([
      db.from("ow_users").select(`${USER_COLS}, email`).in("id", userIds),
      db.from("ow_experiences").select("id, user_id, company_id, company_text, company_anonymized, role_category_id, started_at, ended_at, is_current, visibility_company").in("user_id", userIds),
    ]);
    if (uRes.error) { console.error("[careerRoutes] admin users:", uRes.error.message); return null; }
    if (eRes.error) { console.error("[careerRoutes] admin experiences:", eRes.error.message); return null; }
    users = (uRes.data ?? []) as (UserRow & { email: string | null })[];
    exps = (eRes.data ?? []) as Record<string, unknown>[];
  }
  const companyIds = Array.from(new Set(exps.map((e) => e.company_id as string | null).filter((x): x is string => !!x)));
  const roleIds = Array.from(new Set(exps.map((e) => e.role_category_id as string | null).filter((x): x is string => !!x)));
  const [cRes, roRes] = await Promise.all([
    companyIds.length ? db.from("ow_companies").select("id, name").in("id", companyIds) : Promise.resolve({ data: [], error: null }),
    roleIds.length ? db.from("ow_roles").select("id, name").in("id", roleIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (cRes.error) { console.error("[careerRoutes] admin companies:", cRes.error.message); return null; }
  if (roRes.error) { console.error("[careerRoutes] admin roles:", roRes.error.message); return null; }
  /* ⚠️ 運営の確認用なので、会社は伏せずに正式名で出す（公開ページには渡らない） */
  const companyName = new Map(((cRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const roleName = new Map(((roRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const routes = ((rRes.data ?? []) as Record<string, unknown>[]).map(toRoute);
  return routes.map((route) => {
    const list: AdminHost[] = hosts.filter((h) => h.route_id === route.id).map((h) => {
      const u = userById.get(h.user_id as string);
      const experiences = exps.filter((e) => e.user_id === h.user_id).map((e) => ({
        id: e.id as string,
        company: (e.company_id ? companyName.get(e.company_id as string) : null) ?? (e.company_text as string | null) ?? (e.company_anonymized as string | null) ?? "（会社不明）",
        role: e.role_category_id ? roleName.get(e.role_category_id as string) ?? null : null,
        startedAt: (e.started_at as string | null) ?? null, endedAt: (e.ended_at as string | null) ?? null,
        isCurrent: e.is_current === true, visibilityCompany: (e.visibility_company as string | null) ?? null,
      })).sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
      return {
        hostId: h.id as string, routeId: route.id, userId: h.user_id as string,
        profileKey: u?.username || (h.user_id as string), name: u?.name ?? "（見つからない利用者）", email: u?.email ?? null,
        visibility: u?.visibility ?? null, isTest: u?.is_test === true,
        movedYear: (h.moved_year as number | null) ?? null,
        talkTags: sortRouteTalkTags(Array.isArray(h.talk_tags) ? (h.talk_tags as unknown[]) : []),
        message: (h.message as string | null) ?? null,
        acceptingConsult: h.accepting_consult === true, isListed: h.is_listed === true, approvedAt: (h.approved_at as string | null) ?? null,
        consentConfirmedAt: (h.consent_confirmed_at as string | null) ?? null, consentMethod: (h.consent_method as string | null) ?? null,
        blockers: blockersOf(h, u, route.isPublished),
        experiences,
      };
    });
    return { ...route, hosts: list, listedCount: list.filter((x) => x.blockers.length === 0).length };
  });
}
