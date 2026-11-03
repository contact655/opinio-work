/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paging";
import { isAggregatableUser, AGGREGATE_USER_COLUMNS, type AggregateUser } from "@/lib/aggregate/population";
import { isRegisteredUser } from "@/lib/users/registered";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";
import { PATHS_EXCLUDED_COMPANY_IDS } from "@/lib/constants/demoCompanies";
import { companyDisplayName } from "@/lib/companies/displayName";
import { buildMovePairs, type TransitionExperience } from "@/lib/evidence/transitions";
import { pickLatestExperience } from "@/lib/experiences/latest";
import {
  computePaths, hasAnyRow, pathCards, widerWithRows,
  type PathMove, type PathSide, type PathStart, type PathsSummary,
} from "@/lib/paths/compute";

/**
 * ★「行き先」の読み込み（2026-11-04。2026-11-03 に /paths を /people の「前の経歴」と /home の要約へまとめた）。計画は docs/plan-career-paths-20261103.md。
 *
 * ⚠️★決め手の回答は読まない（回答の表も読む lib/companyFlow の母数の読み込みも使わない）。職歴・人・会社・職種・業界だけ。
 * ⚠️★集計の母数は isAggregatableUser。個人カードは「本人が登録済み・システムでない・非公開でない」で、
 *    見ている人と検証用かどうかがそろう人だけ（検証用には検証用の人だけ。実在の人には実在の人だけ）。
 * ⚠️ 外すもの（検証用の会社・PATHS_EXCLUDED_COMPANY_IDS・会社名を出さない職歴）は「移動の単位」で外す（compute.ts）。
 * ⚠️ キャッシュの中にメールアドレスを持たない（母数の判定に使ったら捨てる）。
 */

type PersonRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  gradient: string;
  aggregatable: boolean;
  /** 個人カードに出せる人（登録済み・システムでない・非公開でない）。検証用かどうかは別に見る */
  cardBase: boolean;
  isTest: boolean;
};
type CompanyRow = { id: string; slug: string | null; name: string; industryTopId: string | null; isTest: boolean; pageVisible: boolean; listed: boolean; logoUrl: string | null };
type NamedRow = { id: string; slug: string | null; name: string; parentId: string | null; order: number };
type ExpRow = TransitionExperience & { visibility_company: string | null; role_name: string | null };

type Population = {
  people: PersonRow[];
  companies: CompanyRow[];
  roles: NamedRow[];
  industries: NamedRow[];
  experiences: ExpRow[];
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

/* ⚠️ unstable_cache の中では no-store のクライアントを使わない（CLAUDE.md）。返す値は JSON にできる形（Map にしない） */
const loadPathsPopulationCached = unstable_cache(async (): Promise<Population | null> => {
  const db = createAdminClient();
  const [exps, users, companies, roles, industries] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) => db.from("ow_experiences")
      .select("id, user_id, company_id, company_text, role_category_id, started_at, ended_at, is_current, visibility_company")
      .order("id").range(from, to), "paths experiences"),
    fetchAllRows<Record<string, unknown>>((from, to) => db.from("ow_users")
      .select(`id, name, avatar_url, avatar_color, email, ${AGGREGATE_USER_COLUMNS}`)
      .order("id").range(from, to), "paths users"),
    fetchAllRows<Record<string, unknown>>((from, to) => db.from("ow_companies")
      .select("id, slug, name, name_en, is_test, industry_id, is_published, listing_status, suspended_at, logo_url")
      .order("id").range(from, to), "paths companies"),
    fetchAllRows<Record<string, unknown>>((from, to) => db.from("ow_roles")
      .select("id, slug, name, parent_id, is_active, display_order").order("id").range(from, to), "paths roles"),
    fetchAllRows<Record<string, unknown>>((from, to) => db.from("ow_industries")
      .select("id, slug, name, parent_id, is_active, display_order").order("id").range(from, to), "paths industries"),
  ]);
  const failed = [exps, users, companies, roles, industries].find((r) => r.error);
  if (failed) {
    console.error("[paths] load:", failed.error);
    return null;
  }
  const named = (rows: Record<string, unknown>[]): NamedRow[] => rows
    .filter((r) => r.is_active !== false)
    .map((r) => ({ id: r.id as string, slug: (r.slug as string | null) ?? null, name: r.name as string, parentId: (r.parent_id as string | null) ?? null, order: Number(r.display_order ?? 0) }));
  const roleRows = named(roles.data);
  const roleName = new Map(roleRows.map((r) => [r.id, r.name]));
  const industryRows = named(industries.data);
  const industryParent = new Map(industryRows.map((i) => [i.id, i.parentId ?? i.id]));
  return {
    people: users.data.map((u) => {
      const agg = u as unknown as AggregateUser & { id: string; name: string };
      return {
        id: agg.id,
        name: agg.name,
        avatarUrl: (u.avatar_url as string | null) ?? null,
        gradient: typeof u.avatar_color === "string" && u.avatar_color.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT,
        aggregatable: isAggregatableUser(agg),
        cardBase: isRegisteredUser(agg) && agg.is_system !== true && agg.visibility !== "private"
          && !(typeof agg.email === "string" && agg.email.toLowerCase().endsWith("@seed.internal")),
        isTest: agg.is_test === true,
      };
    }),
    companies: companies.data.map((c) => ({
      id: c.id as string,
      slug: (c.slug as string | null) ?? null,
      name: companyDisplayName(c.name as string, (c.name_en as string | null) ?? null).displayName,
      industryTopId: c.industry_id ? industryParent.get(c.industry_id as string) ?? null : null,
      isTest: c.is_test === true,
      pageVisible: c.is_published === true && c.is_test !== true && c.suspended_at == null,
      listed: c.is_published === true && c.listing_status === "listed" && c.is_test !== true && c.suspended_at == null,
      logoUrl: (c.logo_url as string | null) ?? null,
    })),
    roles: roleRows,
    industries: industryRows,
    experiences: exps.data
      .filter((e) => typeof e.started_at === "string" && e.started_at)
      .map((e) => ({
        id: e.id as string,
        user_id: e.user_id as string,
        company_id: (e.company_id as string | null) ?? null,
        company_text: (e.company_text as string | null) ?? null,
        role_category_id: (e.role_category_id as string | null) ?? null,
        started_at: e.started_at as string,
        ended_at: (e.ended_at as string | null) ?? null,
        is_current: e.is_current === true,
        visibility_company: (e.visibility_company as string | null) ?? null,
        role_name: e.role_category_id ? roleName.get(e.role_category_id as string) ?? null : null,
      })),
  };
}, ["paths-population-v2"], { revalidate: 300 });

export type PathsOption = { slug: string; name: string };
export type PathsRowView = {
  label: string; count: number; href: string | null;
  /** ★会社の行だけ（2026-11-04。ホームの右の列）。ロゴと、その会社の業界（会社の属性。人から作った値ではない） */
  logoUrl?: string | null;
  industryLabel?: string | null;
};
export type PathsCardView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  gradient: string;
  initial: string;
  fromLabel: string;
  toLabel: string;
  toIsCurrent: boolean;
};
export type PathsStartView = { role: PathsOption | null; industry: PathsOption | null; company: PathsOption | null };
export type PathsView = {
  options: { roles: PathsOption[]; industries: PathsOption[]; companies: PathsOption[] };
  start: PathsStartView | null;
  /** 起点を本人の直近の職歴から入れたか */
  autoStart: boolean;
  /** ★本人の直近の職歴から作った起点（職種の大分類 × 業界の大分類。作れなければ null）。
   *  /people の「自分の直近の経歴を入れる」と /home の要約が使う（2026-11-03） */
  selfStart: PathsStartView | null;
  summary: { moverCount: number | null; company: PathsRowView[]; role: PathsRowView[]; industry: PathsRowView[] } | null;
  /** 一段広げると集計が出る起点（集計が出ないときだけ） */
  wider: PathsStartView[];
  /** ログイン中だけ。未ログインは null（空配列ではなく null。「出していない」を区別する） */
  cards: PathsCardView[] | null;
};

export type PathsQuery = { role?: string | null; industry?: string | null; company?: string | null };

function slugToId(rows: { id: string; slug: string | null }[], slug: string | null | undefined): string | null {
  if (!slug) return null;
  return rows.find((r) => r.slug === slug)?.id ?? null;
}

/**
 * ★画面に出すものをまとめて作る。viewer は見ている人（未ログインは null）。
 * ⚠️ 未ログインには cards を返さない（null）。集計には user_id を入れない（compute.ts）。
 */
export async function getPathsView(
  query: PathsQuery,
  viewer: { owUserId: string; isTest: boolean } | null,
  opts: { autoStart?: boolean } = {},
): Promise<PathsView | null> {
  /* ★起点が URL に無いとき本人の直近の職歴から入れるか。/home は入れる（既定）、/people は入れない（一覧を勝手に絞らない） */
  const allowAutoStart = opts.autoStart !== false;
  const pop = await loadPathsPopulationCached();
  if (!pop) return null;

  const topRoles = pop.roles.filter((r) => !r.parentId).sort((a, b) => a.order - b.order);
  const topIndustries = pop.industries.filter((i) => !i.parentId).sort((a, b) => a.order - b.order);
  const roleTopOf = new Map<string, string>();
  for (const r of pop.roles) roleTopOf.set(r.id, r.parentId ?? r.id);
  const companyById = new Map(pop.companies.map((c) => [c.id, c]));
  const personById = new Map(pop.people.map((p) => [p.id, p]));
  const startable = (c: CompanyRow) => c.listed && !PATHS_EXCLUDED_COMPANY_IDS.has(c.id) && !!c.slug;

  const options = {
    roles: topRoles.filter((r) => r.slug).map((r) => ({ slug: r.slug as string, name: r.name })),
    industries: topIndustries.filter((i) => i.slug).map((i) => ({ slug: i.slug as string, name: i.name })),
    companies: pop.companies.filter(startable).sort((a, b) => a.name.localeCompare(b.name, "ja")).map((c) => ({ slug: c.slug as string, name: c.name })),
  };

  /* 起点。URL に無ければ、ログイン中は本人の直近の職歴から（職種の大分類 × 業界の大分類） */
  let roleId = slugToId(topRoles, query.role);
  let industryId = slugToId(topIndustries, query.industry);
  const companyRow = query.company ? pop.companies.find((c) => c.slug === query.company && startable(c)) ?? null : null;
  let companyId = companyRow?.id ?? null;
  let autoStart = false;
  /* ⚠️ 本人の職歴は本人のものなので、会社名を伏せた職歴でも業界を使う（本人にだけ出す画面） */
  let self: { roleId: string; industryId: string } | null = null;
  if (viewer) {
    const latest = pickLatestExperience(pop.experiences.filter((e) => e.user_id === viewer.owUserId));
    const r = latest?.role_category_id ? roleTopOf.get(latest.role_category_id) ?? null : null;
    const i = latest?.company_id ? companyById.get(latest.company_id)?.industryTopId ?? null : null;
    if (r && i) self = { roleId: r, industryId: i };
  }
  if (allowAutoStart && !query.role && !query.industry && !query.company && self) {
    roleId = self.roleId;
    industryId = self.industryId;
    companyId = null;
    autoStart = true;
  }
  if (companyId) industryId = null;
  const start: PathStart | null = roleId || industryId || companyId ? { roleId, industryId, companyId } : null;

  const toOption = (rows: NamedRow[], id: string | null): PathsOption | null => {
    const r = id ? rows.find((x) => x.id === id) : null;
    return r?.slug ? { slug: r.slug, name: r.name } : null;
  };
  const startView = (s: PathStart): PathsStartView => ({
    role: toOption(topRoles, s.roleId),
    industry: toOption(topIndustries, s.industryId),
    company: s.companyId ? (() => { const c = companyById.get(s.companyId); return c?.slug ? { slug: c.slug, name: c.name } : null; })() : null,
  });

  const selfStart = self ? startView({ roleId: self.roleId, industryId: self.industryId, companyId: null }) : null;

  if (!start) return { options, start: null, autoStart: false, selfStart, summary: null, wider: [], cards: viewer ? [] : null };

  /* 移動の組 → 片側 */
  const side = (e: ExpRow): PathSide => {
    const c = e.company_id ? companyById.get(e.company_id) : undefined;
    return {
      experienceId: e.id,
      companyId: e.company_id,
      companyName: c?.name ?? e.company_text,
      roleTopId: e.role_category_id ? roleTopOf.get(e.role_category_id) ?? null : null,
      industryTopId: c?.industryTopId ?? null,
      usable: e.visibility_company === "real" && c?.isTest !== true && !(e.company_id && PATHS_EXCLUDED_COMPANY_IDS.has(e.company_id)),
      startedAt: e.started_at,
      isCurrent: e.is_current,
    };
  };
  const expById = new Map(pop.experiences.map((e) => [e.id, e]));
  const moves: PathMove[] = buildMovePairs(pop.experiences).map(({ userId, from, to }) => {
    const p = personById.get(userId);
    return {
      userId,
      from: side(from),
      to: side(to),
      aggregatable: p?.aggregatable === true,
      cardable: !!viewer && p?.cardBase === true && p.isTest === viewer.isTest,
    };
  });

  const s: PathsSummary = computePaths(moves, start, MIN_AGGREGATE_COUNT);
  const roleName = new Map(pop.roles.map((r) => [r.id, r.name]));
  const industryName = new Map(pop.industries.map((i) => [i.id, i.name]));
  const summary = {
    moverCount: s.moverCount,
    company: s.company.map((r) => {
      const c = companyById.get(r.id);
      return {
        label: c?.name ?? "", count: r.count, href: c?.pageVisible && c.slug ? `/companies/${c.slug}` : null,
        logoUrl: c?.logoUrl ?? null,
        industryLabel: c?.industryTopId ? industryName.get(c.industryTopId) ?? null : null,
      };
    }).filter((r) => r.label),
    role: s.role.map((r) => ({ label: roleName.get(r.id) ?? "", count: r.count, href: null })).filter((r) => r.label),
    industry: s.industry.map((r) => ({ label: industryName.get(r.id) ?? "", count: r.count, href: null })).filter((r) => r.label),
  };
  const wider = hasAnyRow(s)
    ? []
    : widerWithRows(moves, start, MIN_AGGREGATE_COUNT, (id) => companyById.get(id)?.industryTopId ?? null).map(startView);

  const label = (sd: PathSide) => {
    const e = sd.experienceId ? expById.get(sd.experienceId) : undefined;
    return [sd.companyName, e?.role_name].filter(Boolean).join(" - ");
  };
  const cards = viewer
    ? pathCards(moves, start, { excludeUserId: viewer.owUserId }).map((m) => {
      const p = personById.get(m.userId)!;
      return {
        userId: m.userId,
        name: p.name,
        avatarUrl: p.avatarUrl,
        gradient: p.gradient,
        initial: p.name.charAt(0),
        fromLabel: label(m.from),
        toLabel: label(m.to),
        toIsCurrent: m.to.isCurrent,
      };
    })
    : null;

  return { options, start: startView(start), autoStart, selfStart, summary, wider, cards };
}
