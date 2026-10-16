/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";
import { companyDisplayName } from "@/lib/companies/displayName";
import { getRoleNameMap } from "@/lib/supabase/queries";
import { phaseLabel, phaseMatches } from "@/lib/constants/phase";
import { buildMoves, type TransitionExperience } from "@/lib/evidence/transitions";
import {
  DESIRED_PHASE_TO_OPTION,
  MAX_REASONS_PER_COMPANY,
  SIGNAL_WEIGHTS,
  SAME_DOMAIN_LIKED_POINTS,
  domainFitStatus,
  reasonText,
  type DomainFitStatus,
  type ForYouReaction,
  type SignalDetail,
  type SignalKey,
} from "@/lib/forYou/weights";

/**
 * ★「あなたに合う順」の企業一覧を組み立てる（2026-10-15）。
 *
 * 決めごとは weights.ts の冒頭（使うシグナル・使わないシグナルとその理由）。ここは「集めて、点を付けて、並べる」だけ。
 *
 * ── 母集団 ──────────────────────────────────────────────────────────────────
 *   掲載中（listing_status='listed'・公開）の企業すべて。ただし
 *     - 自社（OWN_COMPANY_SLUG）を除く
 *     - ★足切り: 本人がブロックした企業・本人が在籍中の企業（`get_blocked_companies` と
 *       ow_approach_blocked_companies）。**他の条件では落とさない**（柴さんの判断）
 *     - 実在の利用者には検証用の企業（is_test）を出さない。検証用アカウントには検証用の企業も出す
 *       （is_test の一致は会話の判定 `can_contact_without_stance()` と同じ向き。検証で「会話が開く」を通すため）
 *
 * ⚠️ 本人にしか見せない画面。企業には何も渡らない（渡るのは「興味あり」を押した後だけ。react.ts）。
 * ⚠️ 失敗を0件に見せない: 取得に失敗したら `error` を返し、画面は「表示できませんでした」と出す。
 */

export type ForYouCompany = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  isTest: boolean;
  isPublished: boolean;
  /** 1始まりの順位 */
  rank: number;
  score: number;
  /** 点数の高い順。理由文は上位 MAX_REASONS_PER_COMPANY 件 */
  signals: { key: SignalKey; points: number; detail: SignalDetail }[];
  reasons: string[];
  /** 「話を聞いてみたい」を押したら会話が開くか（有効な担当者がいるか。見ている人と is_test が一致する担当者だけ数える） */
  hasResponder: boolean;
  /** タグ「募集あり」（公開中の求人がある） */
  hasOpenJobs: boolean;
  /** タグ「フェーズ」（lib/constants/phase.ts のラベル。不明なら null） */
  phaseLabel: string | null;
  /**
   * ★「気をつけて見てほしいこと」。**いまは器だけで、常に空**（2026-10-15 / 柴さんの指示）。
   *   上段（提案）の判定 `buildCounterEvidence`（lib/evidence/engine.ts）を流用できるかの調査は
   *   docs/phase0-for-you-20261015.md §8。空なら画面は何も出さない
   */
  cautions: string[];
  reaction: { reaction: ForYouReaction; reason: string | null; interestedAt: string | null; opsNotifiedAt: string | null; conversationId: string | null } | null;
};

export type ForYouResult =
  | { ok: true; companies: ForYouCompany[]; withReasonCount: number }
  | { ok: false; error: string };

type CompanyRow = {
  id: string; slug: string | null; name: string; name_en: string | null; tagline: string | null;
  logo_url: string | null; phase: string | null; is_test: boolean | null; is_published: boolean | null;
};

export async function buildForYou(owUserId: string): Promise<ForYouResult> {
  const db = createAdminClient();

  /* ── 0. 本人 ─────────────────────────────────────────────────────────────── */
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id, auth_id, is_test").eq("id", owUserId).maybeSingle();
  if (meErr || !me?.auth_id) {
    console.error("[forYou] ow_users:", meErr?.message ?? "not found");
    return { ok: false, error: "利用者を確認できませんでした" };
  }
  const viewerIsTest = me.is_test === true;
  const authId = me.auth_id as string;

  const [myExpRes, myReviewRes, desiredRes, profileRes, blockedRes, approachBlockRes, reactionsRes, ownCompanyId, roleMap] = await Promise.all([
    db.from("ow_experiences").select("id, company_id, role_category_id, is_current").eq("user_id", owUserId),
    /* ★本人の入社後レビューのフィット度（2026-10-17。weights.ts の domainFitStatus）。本人の回答だけ */
    db.from("ow_workplace_reviews").select("company_id, fit_score").eq("user_id", owUserId),
    db.from("ow_profile_desired_roles").select("role_id").eq("user_id", authId),
    db.from("ow_profiles").select("desired_phase").eq("user_id", authId).maybeSingle(),
    /* ★在籍中（自由入力の社名の突合を含む）と手動ブロック。⚠️ 引数は auth 空間 */
    db.rpc("get_blocked_companies", { p_auth_user_id: authId }),
    /* ★企業からのメッセージで本人がブロックした企業（ow_users 空間） */
    db.from("ow_approach_blocked_companies").select("company_id").eq("user_id", owUserId),
    db.from("ow_for_you_reactions")
      .select("company_id, reaction, reason, interested_at, ops_notified_at, conversation_id").eq("user_id", owUserId),
    getOwnCompanyId(),
    getRoleNameMap(),
  ]);
  for (const [label, r] of [
    ["ow_experiences", myExpRes], ["ow_workplace_reviews", myReviewRes], ["ow_profile_desired_roles", desiredRes], ["ow_profiles", profileRes],
    ["get_blocked_companies", blockedRes], ["ow_approach_blocked_companies", approachBlockRes], ["ow_for_you_reactions", reactionsRes],
  ] as const) {
    if (r.error) console.error(`[forYou] ${label}:`, r.error.message);
  }
  /* ⚠️★足切りの材料が取れないときは出さない（ブロックした企業が並ぶのを防ぐ。0件や全件に倒さない） */
  if (blockedRes.error || approachBlockRes.error || myExpRes.error) {
    return { ok: false, error: "一覧を作れませんでした" };
  }

  const excluded = new Set<string>([
    ...((blockedRes.data ?? []) as { company_id: string }[]).map((r) => r.company_id),
    ...(approachBlockRes.data ?? []).map((r) => r.company_id as string),
  ]);
  if (ownCompanyId) excluded.add(ownCompanyId);

  /* ── 1. 母集団（掲載中の企業）──────────────────────────────────────────────── */
  let coQuery = db.from("ow_companies")
    .select("id, slug, name, name_en, tagline, logo_url, phase, is_test, is_published")
    .eq("listing_status", "listed").eq("is_published", true);
  if (!viewerIsTest) coQuery = coQuery.eq("is_test", false);
  const { data: coRows, error: coErr } = await coQuery;
  if (coErr) {
    console.error("[forYou] ow_companies:", coErr.message);
    return { ok: false, error: "一覧を作れませんでした" };
  }
  const companies = ((coRows ?? []) as CompanyRow[]).filter((c) => !excluded.has(c.id));
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length === 0) return { ok: true, companies: [], withReasonCount: 0 };

  /* ── 2. 材料 ───────────────────────────────────────────────────────────────── */
  const myExps = (myExpRes.data ?? []) as { id: string; company_id: string | null; role_category_id: string | null; is_current: boolean }[];
  const myCompanyIds = Array.from(new Set(myExps.map((e) => e.company_id).filter(Boolean) as string[]));

  const [domainRes, jobsRes, allExpRes, adminsRes] = await Promise.all([
    /* S1′ 事業領域。本人の職歴の会社と、母集団の会社の両方 */
    db.from("ow_company_business_domains")
      .select("company_id, domain_id, ow_business_domains!domain_id(name, is_active)")
      .in("company_id", Array.from(new Set([...companyIds, ...myCompanyIds]))),
    /* S2 公開求人の職種。⚠️ 実在の利用者には is_test の求人を出さない（PUBLIC_JOB_MATCH と同じ向き） */
    (viewerIsTest
      ? db.from("ow_jobs").select("id, company_id, ow_job_roles(role_id)").eq("status", "published").in("company_id", companyIds)
      : db.from("ow_jobs").select("id, company_id, ow_job_roles(role_id)").eq("status", "published").eq("is_test", false).in("company_id", companyIds)),
    /* S5 移った人。★`ow_transitions` を読まない（lib/evidence/transitions.ts の注記）。正は ow_experiences */
    db.from("ow_experiences")
      .select("id, user_id, company_id, company_text, role_category_id, started_at, ended_at, is_current, visibility_company, ow_users!user_id(auth_id, is_test, is_system, visibility)"),
    /* S7 担当者（「興味あり」の行き先） */
    db.from("ow_company_admins")
      .select("company_id, ow_users!user_id(auth_id, is_test)")
      .in("company_id", companyIds).eq("is_active", true).not("user_id", "is", null),
  ]);
  for (const [label, r] of [
    ["business_domains", domainRes], ["ow_jobs", jobsRes], ["ow_experiences(all)", allExpRes],
    ["ow_company_admins", adminsRes],
  ] as const) {
    if (r.error) console.error(`[forYou] ${label}:`, r.error.message);
  }

  type UserRef = { auth_id: string | null; is_test: boolean | null; is_system?: boolean | null; visibility?: string | null } | null;
  /* ★人を数えるときの条件（lib/evidence/fetch.ts の isVisibleUser と同じ）。登録済み・検証用でない・システムでない・非公開でない */
  const visibleUser = (u: UserRef) =>
    !!u && u.auth_id != null && u.is_test !== true && u.is_system !== true && u.visibility !== "private";

  /* S1′: 会社 → 有効な事業領域 */
  const domainsByCompany = new Map<string, Map<string, string>>();
  for (const r of (domainRes.data ?? []) as unknown as { company_id: string; domain_id: string; ow_business_domains: { name: string; is_active: boolean } | null }[]) {
    if (!r.ow_business_domains?.is_active) continue;
    if (!domainsByCompany.has(r.company_id)) domainsByCompany.set(r.company_id, new Map());
    domainsByCompany.get(r.company_id)!.set(r.domain_id, r.ow_business_domains.name);
  }
  /* 本人の職歴の事業領域。domain → 現職だけで一致したか（過去の職歴があれば「前職」） */
  const myDomains = new Map<string, { name: string; onlyCurrent: boolean }>();
  /* ★domain → その領域に当たる本人の勤務先のフィット度（会社ごとに1つ。未回答は null） */
  const fitByCompany = new Map<string, number>();
  for (const rv of (myReviewRes.data ?? []) as { company_id: string | null; fit_score: number | null }[]) {
    if (rv.company_id && typeof rv.fit_score === "number") fitByCompany.set(rv.company_id, rv.fit_score);
  }
  const domainCompanyFits = new Map<string, Map<string, number | null>>();
  for (const e of myExps) {
    if (!e.company_id) continue;
    for (const [d, name] of Array.from(domainsByCompany.get(e.company_id)?.entries() ?? [])) {
      const prev = myDomains.get(d);
      myDomains.set(d, { name, onlyCurrent: (prev ? prev.onlyCurrent : true) && e.is_current });
      if (!domainCompanyFits.has(d)) domainCompanyFits.set(d, new Map());
      domainCompanyFits.get(d)!.set(e.company_id, fitByCompany.get(e.company_id) ?? null);
    }
  }
  const domainStatus = (d: string): DomainFitStatus =>
    domainFitStatus(Array.from(domainCompanyFits.get(d)?.values() ?? []));

  /* S2: 本人の職種（職歴を先に。希望は後）。★判定は getJobEmployees と同じ（兄弟は拾わない） */
  const myRoles: { id: string; fromDesired: boolean }[] = [];
  for (const e of myExps) if (e.role_category_id) myRoles.push({ id: e.role_category_id, fromDesired: false });
  for (const r of (desiredRes.data ?? []) as { role_id: string }[]) myRoles.push({ id: r.role_id, fromDesired: true });
  const parentOf = (id: string) => roleMap.get(id)?.parent_id ?? null;
  const roleMatches = (mine: string, job: string) =>
    mine === job || mine === parentOf(job) || parentOf(mine) === job;
  const jobRolesByCompany = new Map<string, string[]>();
  for (const j of (jobsRes.data ?? []) as unknown as { company_id: string; ow_job_roles: { role_id: string }[] | null }[]) {
    const arr = jobRolesByCompany.get(j.company_id) ?? [];
    for (const r of j.ow_job_roles ?? []) arr.push(r.role_id);
    jobRolesByCompany.set(j.company_id, arr);
  }

  /* S5: 本人の勤務先の事業領域 × 移った人の移る前の会社の事業領域（2026-10-15 に業種から変えた。weights.ts） */
  const allExps = (allExpRes.data ?? []) as unknown as (TransitionExperience & { visibility_company: string | null; ow_users: UserRef })[];
  const moves = buildMoves(
    allExps
      .filter((e) => e.user_id !== owUserId && visibleUser(e.ow_users) && e.visibility_company !== "hidden" && !!e.started_at)
      .map((e) => ({
        id: e.id, user_id: e.user_id, company_id: e.company_id, company_text: e.company_text,
        role_category_id: e.role_category_id, started_at: e.started_at, ended_at: e.ended_at, is_current: e.is_current,
      })),
  );
  const fromCompanyIds = Array.from(new Set(moves.map((m) => m.fromCompanyId).filter(Boolean) as string[]));
  const domainsOfFrom = new Map<string, string[]>(); // 移る前の会社 → domain_id[]
  if (fromCompanyIds.length > 0 && myDomains.size > 0) {
    const { data, error } = await db.from("ow_company_business_domains").select("company_id, domain_id").in("company_id", fromCompanyIds);
    if (error) console.error("[forYou] 移る前の会社の事業領域:", error.message);
    for (const r of data ?? []) {
      const arr = domainsOfFrom.get(r.company_id as string) ?? [];
      arr.push(r.domain_id as string);
      domainsOfFrom.set(r.company_id as string, arr);
    }
  }
  /* 企業 → 移ってきた人の出身の事業領域（本人の勤務先の事業領域と一致したものだけ）。前職で一致したものを優先 */
  const movedDomainByCompany = new Map<string, { name: string; onlyCurrent: boolean }>();
  for (const m of moves) {
    if (!m.toCompanyId || !m.fromCompanyId) continue;
    for (const d of domainsOfFrom.get(m.fromCompanyId) ?? []) {
      const mine = myDomains.get(d);
      if (!mine) continue;
      const prev = movedDomainByCompany.get(m.toCompanyId);
      if (!prev || (prev.onlyCurrent && !mine.onlyCurrent)) movedDomainByCompany.set(m.toCompanyId, mine);
    }
  }

  /* S7 */
  const responders = new Set<string>();
  for (const r of (adminsRes.data ?? []) as unknown as { company_id: string; ow_users: UserRef }[]) {
    /* ★見ている人と is_test が一致する担当者だけ。検証用の担当者しかいない実在の企業（セールスフォース）は
          実在の利用者には「担当者なし」になる（実在の利用者に返信できる人がいないため） */
    if (r.ow_users?.auth_id && (r.ow_users.is_test === true) === viewerIsTest) responders.add(r.company_id);
  }

  /* 希望フェーズ */
  const desiredPhases = ((profileRes.data?.desired_phase as string[] | null) ?? [])
    .map((p) => DESIRED_PHASE_TO_OPTION[p]).filter(Boolean);

  const reactionByCompany = new Map(
    ((reactionsRes.data ?? []) as { company_id: string; reaction: ForYouReaction; reason: string | null; interested_at: string | null; ops_notified_at: string | null; conversation_id: string | null }[])
      .map((r) => [r.company_id, { reaction: r.reaction, reason: r.reason, interestedAt: r.interested_at, opsNotifiedAt: r.ops_notified_at, conversationId: r.conversation_id }]),
  );

  /* ── 3. 点数 ───────────────────────────────────────────────────────────────── */
  const scored = companies.map((c) => {
    const signals: ForYouCompany["signals"] = [];

    /* S2 */
    const jobRoles = jobRolesByCompany.get(c.id) ?? [];
    const hitRole = myRoles.find((m) => jobRoles.some((j) => roleMatches(m.id, j)));
    if (hitRole) {
      const roleName = roleMap.get(hitRole.id)?.name;
      if (roleName) signals.push({ key: "role_opening", points: SIGNAL_WEIGHTS.role_opening, detail: { key: "role_opening", roleName, fromDesired: hitRole.fromDesired } });
    }
    /* S1′（自分の在籍した会社自身は母集団に入っていても、在籍中なら足切り済み。前職の会社は「同じ領域」と言えるので出す） */
    const coDomains = domainsByCompany.get(c.id);
    if (coDomains) {
      /* ★「合っていた」と答えた会社の領域を最優先、次に過去の職歴（「前職と同じ」）。
            「合っていなかった」とだけ答えた領域は理由にしない（2026-10-17。weights.ts の domainFitStatus） */
      const hits = Array.from(coDomains.keys())
        .map((d) => { const m = myDomains.get(d); return m ? { ...m, status: domainStatus(d) } : null; })
        .filter((h): h is { name: string; onlyCurrent: boolean; status: DomainFitStatus } => !!h && h.status !== "disliked");
      const best = hits.find((h) => h.status === "liked") ?? hits.find((h) => !h.onlyCurrent) ?? hits[0];
      if (best && !myCompanyIds.includes(c.id)) {
        const liked = best.status === "liked";
        signals.push({
          key: "same_domain",
          points: liked ? SAME_DOMAIN_LIKED_POINTS : SIGNAL_WEIGHTS.same_domain,
          detail: { key: "same_domain", domainName: best.name, fromCurrent: best.onlyCurrent, liked },
        });
      }
    }
    /* S5 */
    const movedFrom = movedDomainByCompany.get(c.id);
    if (movedFrom) signals.push({ key: "moved_from_domain", points: SIGNAL_WEIGHTS.moved_from_domain, detail: { key: "moved_from_domain", domainName: movedFrom.name, fromCurrent: movedFrom.onlyCurrent } });
    /* フェーズ */
    const phaseHit = desiredPhases.find((p) => phaseMatches(c.phase, p.option));
    if (phaseHit) signals.push({ key: "phase_match", points: SIGNAL_WEIGHTS.phase_match, detail: { key: "phase_match", phaseLabel: phaseHit.label } });

    signals.sort((a, b) => b.points - a.points);
    const score = signals.reduce((s, x) => s + x.points, 0);
    return {
      row: c,
      displayName: companyDisplayName(c.name, c.name_en).displayName,
      signals,
      score,
    };
  });

  /* ── 4. 並べる（weights.ts の TIE_BREAK_NOTE）────────────────────────────────── */
  scored.sort((a, b) =>
    b.score - a.score
    || b.signals.length - a.signals.length
    || a.displayName.localeCompare(b.displayName, "ja")
    || a.row.id.localeCompare(b.row.id),
  );

  const out: ForYouCompany[] = scored.map((s, i) => ({
    id: s.row.id,
    slug: s.row.slug,
    name: s.displayName,
    tagline: s.row.tagline,
    logoUrl: s.row.logo_url,
    isTest: s.row.is_test === true,
    isPublished: s.row.is_published === true,
    rank: i + 1,
    score: s.score,
    signals: s.signals,
    reasons: s.signals.slice(0, MAX_REASONS_PER_COMPANY).map((x) => reasonText(x.detail)),
    /* ★会社自身の is_test も見ている人と一致すること（会話の判定 can_contact_without_stance() が見る向きと同じ）。
          一致しないと、担当者がいても会話は開かない（検証用アカウント × 実在の企業） */
    hasResponder: responders.has(s.row.id) && (s.row.is_test === true) === viewerIsTest,
    hasOpenJobs: jobRolesByCompany.has(s.row.id),
    phaseLabel: phaseLabel(s.row.phase),
    cautions: [],
    reaction: reactionByCompany.get(s.row.id) ?? null,
  }));

  return { ok: true, companies: out, withReasonCount: out.filter((c) => c.reasons.length > 0).length };
}
