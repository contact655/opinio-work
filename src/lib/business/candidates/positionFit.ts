/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { inChunks } from "@/lib/supabase/paging";
import { getRoleTree } from "@/lib/supabase/queries";
import { rolesRelated } from "@/lib/business/candidates/touchpoints";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";
import { RANK_LABELS } from "@/lib/constants/careerOptions";
import { rankOrder } from "@/lib/constants/jobFit";
import type { PositionFit, PositionFitItem, PositionFits, PositionOption } from "@/lib/business/candidates/positionFitModel";

/**
 * ★ポジションで見る（2026-10-18 / 柴さんの指示・段1）。自社のポジション（求人）ごとに、候補者の合うところを作る。
 *
 * 突き合わせるもの（求人 × 候補者）:
 *   職種と経験年数 … 求人の職種（ow_job_roles）× 職歴の職種と月数（同じか親子。兄弟は合わない ——接点と同じ `rolesRelated`）
 *   希望職種       … 求人の職種 × 関心のある職種
 *   レベル         … 求人のレベル（position_level）× 職歴の役職（同じかそれ以上）
 *   勤務地         … 求人の勤務地 × お住まい・希望勤務地（フルリモートの求人は勤務地を問わない）
 *
 * ⚠️★読まないもの: 年齢・性別・年収（年齢と性別は法令、年収は本人だけの値）・転職意欲・受け取る範囲・伏せた勤務先の社名。
 *    社名は1つも使わない（職種は伏せた職歴のものも使う ——接点の「できること」と同じで、伏せる対象は社名）。
 * ⚠️ ポジションは自社の求人すべて（下書き・審査中・非公開も含む。差し戻しは除く）。is_test は自社と同じもの。
 *    公開していない求人でも、人事が「この枠に合う人」を探す軸にはなる。⚠️ 求職者には何も出さない。
 * ⚠️ 取得に失敗したら null（画面はポジションの欄を出さない。0件と言わない）。
 */

export type PositionCandidateInput = {
  owUserId: string;
  location: string | null;
  desiredRoleIds: string[];
  desiredPrefectures: string[] | null;
};

const STATUS_LABEL: Record<string, string | null> = {
  published: null, draft: "下書き", pending_review: "審査中", private: "非公開",
};

/** 並べる重み（画面に出さない） */
const W = { roleYearsMet: 6, role: 4, desired: 2, level: 2, location: 1, gap: -1 } as const;

function prefOf(loc: string | null): string | null {
  const p = extractPrefecture(loc);
  return p && (PREFECTURES as readonly string[]).includes(p) ? p : null;
}

function monthsBetween(start: string | null, end: string | null, now: Date): number {
  if (!start) return 0;
  const s = new Date(start), e = end ? new Date(end) : now;
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return 0;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

const years = (m: number) => Math.floor(m / 12);

export async function getCompanyPositionFits(
  companyId: string,
  companyIsTest: boolean,
  candidates: PositionCandidateInput[],
  now: Date = new Date(),
): Promise<{ positions: PositionOption[]; fits: PositionFits } | null> {
  const db = createAdminClient();
  const [jobsR, tree] = await Promise.all([
    db.from("ow_jobs")
      .select("id, title, status, location, remote_work_status, required_experience_years, position_level, published_at, updated_at, ow_job_roles(role_id)")
      .eq("company_id", companyId).eq("is_test", companyIsTest).in("status", Object.keys(STATUS_LABEL))
      .order("updated_at", { ascending: false }),
    getRoleTree(),
  ]);
  if (jobsR.error) { console.error("[positionFit] ow_jobs:", jobsR.error.message); return null; }

  const jobs = (jobsR.data ?? []).map((j) => ({
    id: j.id as string,
    title: ((j.title as string | null) ?? "").trim() || "（題名なし）",
    status: j.status as string,
    pref: prefOf(j.location as string | null),
    remote: (j.remote_work_status as string | null) === "full_remote",
    roleIds: ((j.ow_job_roles as { role_id: string }[] | null) ?? []).map((x) => x.role_id),
    requiredYears: (j.required_experience_years as number | null) ?? null,
    level: (j.position_level as string | null) ?? null,
  }))
    /* 公開中を先に（同じ状態の中は更新の新しい順） */
    .sort((a, b) => Number(b.status === "published") - Number(a.status === "published"));
  const positions: PositionOption[] = jobs.map((j) => ({ id: j.id, title: j.title, statusLabel: STATUS_LABEL[j.status] ?? null }));
  if (jobs.length === 0 || candidates.length === 0) return { positions, fits: {} };

  const ids = Array.from(new Set(candidates.map((c) => c.owUserId)));
  /* ★id を分けて、1,000 行ずつ最後まで引く（2026-10-19） */
  const expR = await inChunks(ids, (part, from, to) => db.from("ow_experiences")
    .select("id, user_id, role_category_id, started_at, ended_at, rank")
    .in("user_id", part).order("id").range(from, to), "positionFit exps");
  if (expR.error) { console.error("[positionFit] ow_experiences:", expR.error); return null; }
  const expsByUser = new Map<string, { role: string | null; months: number; rank: string | null }[]>();
  for (const e of expR.data ?? []) {
    const arr = expsByUser.get(e.user_id as string) ?? [];
    arr.push({
      role: (e.role_category_id as string | null) ?? null,
      months: monthsBetween((e.started_at as string | null) ?? null, (e.ended_at as string | null) ?? null, now),
      rank: (e.rank as string | null) ?? null,
    });
    expsByUser.set(e.user_id as string, arr);
  }
  const roleName = (id: string) => tree.byId.get(id)?.name ?? null;

  const fits: PositionFits = {};
  for (const j of jobs) {
    const byCand: Record<string, PositionFit> = {};
    const jobRoleNames = j.roleIds.map(roleName).filter((n): n is string => !!n);
    const needLevel = rankOrder(j.level);
    for (const c of candidates) {
      const exps = expsByUser.get(c.owUserId) ?? [];
      const items: PositionFitItem[] = [];
      let rank = 0;

      // 職種と経験年数
      if (j.roleIds.length > 0) {
        const monthsByRole = new Map<string, number>();
        for (const e of exps) if (e.role) monthsByRole.set(e.role, (monthsByRole.get(e.role) ?? 0) + e.months);
        const hit = Array.from(monthsByRole.keys()).filter((r) => j.roleIds.some((jr) => rolesRelated(tree, r, jr)));
        if (hit.length > 0) {
          const best = hit.reduce((a, b) => ((monthsByRole.get(b) ?? 0) > (monthsByRole.get(a) ?? 0) ? b : a));
          const m = monthsByRole.get(best) ?? 0;
          const label = `${roleName(best) ?? "同じ職種"}${m >= 12 ? ` ${years(m)}年` : m > 0 ? " 1年未満" : ""}（経験）`;
          if (j.requiredYears && j.requiredYears > 0) {
            const met = years(m) >= j.requiredYears;
            items.push({ item: "経験年数", text: `${label}　求める経験 ${j.requiredYears}年以上`, ok: met });
            rank += met ? W.roleYearsMet : W.role + W.gap;
          } else {
            items.push({ item: "職種", text: label, ok: true });
            rank += W.role;
          }
        } else {
          items.push({ item: "職種", text: `${jobRoleNames.join("・") || "この職種"}の経験なし`, ok: false });
          rank += W.gap;
        }
        // 希望職種
        const desired = c.desiredRoleIds.find((d) => j.roleIds.some((jr) => rolesRelated(tree, d, jr)));
        if (desired) {
          items.push({ item: "希望職種", text: `${roleName(desired) ?? "同じ職種"}（関心）`, ok: true });
          rank += W.desired;
        }
      }

      // レベル（「役職なし」の求人は誰でも満たすので出さない）
      if (needLevel != null && needLevel > 0) {
        const mine = exps.reduce<number | null>((acc, e) => {
          const o = rankOrder(e.rank);
          return o == null ? acc : acc == null ? o : Math.max(acc, o);
        }, null);
        const need = j.level ? RANK_LABELS[j.level] : null;
        if (need) {
          if (mine != null && mine >= needLevel) {
            const mineValue = exps.map((e) => e.rank).find((r) => rankOrder(r) === mine) ?? null;
            items.push({ item: "レベル", text: `${mineValue ? RANK_LABELS[mineValue] : need}（経験）　求めるレベル ${need}`, ok: true });
            rank += W.level;
          } else if (mine != null) {
            const mineValue = exps.map((e) => e.rank).find((r) => rankOrder(r) === mine) ?? null;
            items.push({ item: "レベル", text: `${mineValue ? RANK_LABELS[mineValue] : "—"}まで（経験）　求めるレベル ${need}`, ok: false });
            rank += W.gap;
          }
          /* ⚠️ 役職が1件も入っていない人は「足りない」と言わない（分からないだけ） */
        }
      }

      // 勤務地
      if (j.remote) {
        items.push({ item: "勤務地", text: "フルリモートのため勤務地を問いません", ok: true });
        rank += W.location;
      } else if (j.pref) {
        const home = prefOf(c.location);
        if (home === j.pref) {
          items.push({ item: "勤務地", text: `${home}在住（勤務地 ${j.pref}）`, ok: true });
          rank += W.location;
        } else if ((c.desiredPrefectures ?? []).includes(j.pref)) {
          items.push({ item: "勤務地", text: `希望勤務地に${j.pref}（勤務地 ${j.pref}）`, ok: true });
          rank += W.location;
        } else if (home) {
          items.push({ item: "勤務地", text: `${home}在住（勤務地 ${j.pref}）`, ok: false });
          rank += W.gap;
        }
        /* ⚠️ お住まいが分からない人は「足りない」と言わない */
      }

      /* 合っているものを先に（作った順を保つ） */
      items.sort((a, b) => Number(b.ok) - Number(a.ok));
      byCand[c.owUserId] = { items, rank };
    }
    fits[j.id] = byCand;
  }
  return { positions, fits };
}
