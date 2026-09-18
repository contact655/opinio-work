/**
 * 「あと何をすれば根拠が立つか」を企業ごとに数える（運営専用 / 2026-09-18）。
 *
 * ── ★「未回答者を数える」画面ではない ──────────────────────────────────────
 * 根拠の型ごとに**データ源が違う**ので、型ごとに数えて、足りない分を名指しする。
 *
 * ── ★★経路と決め手は「在籍者登録」を必要としない ───────────────────────────
 * どちらも `ow_experiences` から積み上がるので、**その会社を辞めた人（出身者）の
 * 職歴でも増える。** 一方「話せる人」は `ow_company_members` ＋ **在籍中**の職歴が要る。
 *   → **誰に声をかけるかの判断が変わる**ので、在籍中と出身者を**分けて数える。**
 *
 * ── ★`ow_transitions` を読まない ───────────────────────────────────────────
 * あれは導出テーブルで**洗い替えが手動**（2026-09-18 時点で最終 2026-08-26 / 以後
 * 職歴が増えている）。読むと**実態より少なく出る。**
 * `ow_experiences` が正なので、隣接ペアを**その場で組む**。
 * ⚠️ 組み方は `rebuild_ow_transitions()` と同じ（会社の同一性キーは
 *    `company_id` → 正規化した `company_text` の順）。**片方だけ変えないこと。**
 *
 * ⚠️ 除外は `getCompanyEmployees` の `isSeedRow` と同じ集合
 *    （`is_test` / `is_system` / `visibility='private'` / `auth_id IS NULL`）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { companyDisplayName } from "@/lib/companies/displayName";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";

/** 「話せる人」が立つ最低人数。⚠️ 経路・決め手（3）とは別の基準 */
export const TALKABLE_TARGET = 1;

export type CompanyGap = {
  companyId: string;
  companyName: string;
  /** 経路（この会社へ移ってきた人）。★在籍中と出身者を分ける */
  pathCurrent: number;
  pathAlumni: number;
  /** 決め手を答えた職歴。★同上 */
  motiveCurrent: number;
  motiveAlumni: number;
  talkable: number;
  openJobs: number;
  /** いま基準を満たしている根拠の本数（経路 / 決め手 / 話せる人 のうち） */
  standing: number;
  /** 「あと何が足りないか」の1行。★満たしていれば null */
  gapLine: string | null;
};

export type UnansweredPerson = {
  userId: string;
  name: string;
  email: string | null;
  /** 職歴の件数 */
  experiences: number;
  /** ★最終ログイン日。**これが無いと「なぜ答えないか」が分からない** */
  lastSignInAt: string | null;
  /** 対象企業（掲載中のものを優先して表示） */
  companies: string[];
};

export type EvidenceGapsResult = {
  companies: CompanyGap[];
  unanswered: UnansweredPerson[];
  /** ★いつ数えたか。数字だけ持ち出されないように画面に出す */
  computedAt: string;
  targets: { path: number; motive: number; talkable: number; proposal: number };
};

type ExpRow = {
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  join_reasons: string[] | null;
  visibility_company: string;
  ow_users: { auth_id: string | null; is_test: boolean | null; is_system: boolean | null; visibility: string | null } | null;
};

function visible(u: ExpRow["ow_users"]): boolean {
  if (!u) return false;
  return u.auth_id != null && u.is_test !== true && u.is_system !== true && u.visibility !== "private";
}

/** 会社の同一性キー。⚠️ `rebuild_ow_transitions()` と同じ規則 */
function ckey(r: { company_id: string | null; company_text: string | null }, id: string): string {
  return r.company_id ?? (r.company_text ? r.company_text.trim().toLowerCase() : `anon:${id}`);
}

export async function fetchEvidenceGaps(): Promise<EvidenceGapsResult | null> {
  const db = createAdminClient();

  const [{ data: companyRows, error: coErr }, { data: expRows, error: expErr }] = await Promise.all([
    /* ⚠️ `.eq("listing_status","listed")` を直書きしないこと（CLAUDE.md） */
    filterListedCompanies(db.from("ow_companies").select("id, name, name_en")),
    db
      .from("ow_experiences")
      .select("user_id, company_id, company_text, started_at, ended_at, is_current, join_reasons, visibility_company, ow_users!user_id(auth_id, is_test, is_system, visibility)"),
  ]);
  if (coErr) console.error("[evidenceGaps] ow_companies:", coErr.message);
  if (expErr) console.error("[evidenceGaps] ow_experiences:", expErr.message);
  /* ⚠️ 取得に失敗したら null。**「0社」と表示しない**（CLAUDE.md） */
  if (coErr || expErr) return null;

  const exps = ((expRows ?? []) as unknown as ExpRow[]).filter(
    (e) => visible(e.ow_users) && e.visibility_company !== "hidden",
  );
  const listed = (companyRows ?? []) as { id: string; name: string; name_en: string | null }[];
  const listedIds = new Set(listed.map((c) => c.id));

  const [{ data: members, error: memErr }, { data: jobs, error: jobErr }] = await Promise.all([
    db.from("ow_company_members").select("user_id, company_id").eq("display_consent", true).eq("is_public", true),
    db.from("ow_jobs").select("company_id").eq("status", "published").eq("is_test", false),
  ]);
  if (memErr) console.error("[evidenceGaps] ow_company_members:", memErr.message);
  if (jobErr) console.error("[evidenceGaps] ow_jobs:", jobErr.message);

  // ── 経路: 隣接ペアを組んで「この会社へ移ってきた人」を数える ────────────────
  const byUser = new Map<string, ExpRow[]>();
  for (const e of exps) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
    byUser.get(e.user_id)!.push(e);
  }
  /** company_id → 移ってきた user の集合（在籍中 / 出身者に分ける） */
  const pathCur = new Map<string, Set<string>>();
  const pathAlu = new Map<string, Set<string>>();
  /* ⚠️ `for (const x of map)` にしないこと。tsconfig の target では TS2802。設定は触らない */
  for (const [uid, rows] of Array.from(byUser.entries())) {
    const sorted = [...rows].sort((a, b) =>
      a.started_at === b.started_at
        ? (a.ended_at ?? "9999-12-31").localeCompare(b.ended_at ?? "9999-12-31")
        : a.started_at.localeCompare(b.started_at),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      /* 会社が変わったときだけ「移った」と数える */
      if (ckey(prev, `${uid}:${i - 1}`) === ckey(cur, `${uid}:${i}`)) continue;
      const to = cur.company_id;
      if (!to || !listedIds.has(to)) continue;
      const bucket = cur.is_current ? pathCur : pathAlu;
      if (!bucket.has(to)) bucket.set(to, new Set());
      bucket.get(to)!.add(uid);
    }
  }

  // ── 決め手 / 話せる人 / 求人 ────────────────────────────────────────────────
  const motiveCur = new Map<string, number>(), motiveAlu = new Map<string, number>();
  for (const e of exps) {
    if (!e.company_id || !listedIds.has(e.company_id)) continue;
    if ((e.join_reasons?.length ?? 0) === 0) continue;
    const m = e.is_current ? motiveCur : motiveAlu;
    m.set(e.company_id, (m.get(e.company_id) ?? 0) + 1);
  }
  const currentAt = new Set(exps.filter((e) => e.is_current && e.company_id).map((e) => `${e.user_id}:${e.company_id}`));
  const talkable = new Map<string, number>();
  for (const m of (members ?? []) as { user_id: string; company_id: string }[]) {
    if (!listedIds.has(m.company_id)) continue;
    if (!currentAt.has(`${m.user_id}:${m.company_id}`)) continue;
    talkable.set(m.company_id, (talkable.get(m.company_id) ?? 0) + 1);
  }
  const jobCount = new Map<string, number>();
  for (const j of (jobs ?? []) as { company_id: string }[]) {
    jobCount.set(j.company_id, (jobCount.get(j.company_id) ?? 0) + 1);
  }

  // ── 組み立て ────────────────────────────────────────────────────────────────
  const companies: CompanyGap[] = listed.map((c) => {
    const pc = pathCur.get(c.id)?.size ?? 0, pa = pathAlu.get(c.id)?.size ?? 0;
    const mc = motiveCur.get(c.id) ?? 0, ma = motiveAlu.get(c.id) ?? 0;
    const tk = talkable.get(c.id) ?? 0;
    const path = pc + pa, motive = mc + ma;

    const standing =
      (path >= MIN_AGGREGATE_COUNT ? 1 : 0) +
      (motive >= MIN_AGGREGATE_COUNT ? 1 : 0) +
      (tk >= TALKABLE_TARGET ? 1 : 0);

    /* ★「あと何が足りないか」。**満たしている本数から逆算して1行で言う。** */
    let gapLine: string | null = null;
    if (standing < MIN_EVIDENCE_FOR_PROPOSAL) {
      const needs: string[] = [];
      if (path < MIN_AGGREGATE_COUNT) needs.push(`経路があと${MIN_AGGREGATE_COUNT - path}件`);
      if (motive < MIN_AGGREGATE_COUNT) needs.push(`決め手があと${MIN_AGGREGATE_COUNT - motive}件`);
      if (tk < TALKABLE_TARGET) needs.push(`話せる人があと${TALKABLE_TARGET - tk}名`);
      /* 立てたい本数に届くまでに必要な「いちばん近い組み合わせ」を出す */
      const short = MIN_EVIDENCE_FOR_PROPOSAL - standing;
      gapLine = needs.length
        ? `${needs.slice(0, short).join("と")}そろえば、根拠が${MIN_EVIDENCE_FOR_PROPOSAL}本立ちます`
        : null;
    }

    return {
      companyId: c.id,
      companyName: companyDisplayName(c.name, c.name_en).displayName,
      pathCurrent: pc, pathAlumni: pa,
      motiveCurrent: mc, motiveAlumni: ma,
      talkable: tk,
      openJobs: jobCount.get(c.id) ?? 0,
      standing,
      gapLine,
    };
  });
  /* 立っている本数が多い順 → 近い順。⚠️ 社名で安定させる */
  companies.sort(
    (a, b) =>
      b.standing - a.standing ||
      (b.pathCurrent + b.pathAlumni + b.motiveCurrent + b.motiveAlumni) -
        (a.pathCurrent + a.pathAlumni + a.motiveCurrent + a.motiveAlumni) ||
      a.companyName.localeCompare(b.companyName, "ja"),
  );

  // ── 未回答者 ────────────────────────────────────────────────────────────────
  /* ★最終ログイン日は `auth.users` にしか無い。PostgREST からは join できないので
        Admin API で引く。⚠️ これが無いと「なぜ答えないか」が分からない
        （2026-09-18: 未回答4人は全員、設問が出た 09-12 より前が最終ログインだった）。 */
  const lastSignIn = new Map<string, string | null>();
  const { data: authList, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authErr) console.error("[evidenceGaps] listUsers:", authErr.message);
  for (const u of authList?.users ?? []) lastSignIn.set(u.id, u.last_sign_in_at ?? null);

  const nameById = new Map(listed.map((c) => [c.id, companyDisplayName(c.name, c.name_en).displayName]));
  const unansweredMap = new Map<string, UnansweredPerson>();
  const { data: users, error: uErr } = await db
    .from("ow_users")
    .select("id, name, email, auth_id, is_test, is_system, visibility");
  if (uErr) console.error("[evidenceGaps] ow_users:", uErr.message);
  const userById = new Map(((users ?? []) as { id: string; name: string; email: string | null; auth_id: string | null }[]).map((u) => [u.id, u]));

  for (const [uid, rows] of Array.from(byUser.entries())) {
    /* ⚠️ 1件でも答えていれば「未回答」に出さない（全件回答を求める画面ではない） */
    if (rows.some((r: ExpRow) => (r.join_reasons?.length ?? 0) > 0)) continue;
    const u = userById.get(uid);
    if (!u) continue;
    const cos = Array.from(
      new Set(rows.map((r: ExpRow) => (r.company_id ? nameById.get(r.company_id) : null)).filter(Boolean) as string[]),
    );
    unansweredMap.set(uid, {
      userId: uid,
      name: u.name ?? "—",
      email: u.email ?? null,
      experiences: rows.length,
      lastSignInAt: u.auth_id ? (lastSignIn.get(u.auth_id) ?? null) : null,
      companies: cos,
    });
  }
  const unanswered = Array.from(unansweredMap.values()).sort(
    /* 掲載企業に紐づく人を先に。次に職歴が多い順 */
    (a, b) => b.companies.length - a.companies.length || b.experiences - a.experiences,
  );

  return {
    companies,
    unanswered,
    computedAt: new Date().toISOString(),
    targets: {
      path: MIN_AGGREGATE_COUNT,
      motive: MIN_AGGREGATE_COUNT,
      talkable: TALKABLE_TARGET,
      proposal: MIN_EVIDENCE_FOR_PROPOSAL,
    },
  };
}
