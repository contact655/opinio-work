/**
 * ★検索の「移動」の当てはめ（2026-10-27 / 柴さんの決定）。**純粋な関数。型以外は何も import しない**（node のテストから直接読むため）。
 *
 * ⚠️★人の検索のいまの AND（「1つの職歴が、職歴側の条件を全部満たす」runSearch.ts）とは**別の関数**。
 *    移動は「隣り合う2つの職歴」への条件なので、職歴1行への条件では書けない。混ぜないこと。
 *
 *   left（行き先つき） … その会社の職歴が全部終わっていて、出た直後の他社の職歴が行き先の条件を満たす
 *                        （直後の定義は lib/companyFlow の aroundCompany と同じ：出た月以降に始まった最初の他社）
 *   move               … 会社が変わった隣り合う2つの職歴（lib/evidence/transitions.ts の buildMoves と同じ並べ方）が、
 *                        移る前・移った先の条件を満たす
 *
 * ⚠️ 会社名を伏せた職歴（visibility_company が real でない）は、業界・会社の手がかりにしない（呼ぶ側で industryParentId を null・key を行ごとにして渡す）
 */
import type { TransitionIntent, TransitionSide } from "./transitionIntent";

export type MatchExp = {
  id: string;
  /** 会社の同一性キー（company_id → 正規化した社名 → 行ごと。buildMoves と同じ規則） */
  key: string;
  companyId: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  /** 会社の業界の大分類。辿れなければ null */
  industryParentId: string | null;
  isForeign: boolean | null;
  /** その職歴の職種と祖先の id（expandWithAncestors 済み） */
  roleIds: string[];
};

export type TransitionMatch = { prev: MatchExp | null; cur: MatchExp };

const month = (s: string | null): number | null => {
  const m = s ? /^(\d{4})-(\d{1,2})/.exec(s) : null;
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null;
};

function sideMatches(e: MatchExp, side: TransitionSide | undefined): boolean {
  if (!side) return true;
  if (side.industryId) {
    if (!e.industryParentId) return false;
    if (side.notIndustry ? e.industryParentId === side.industryId : e.industryParentId !== side.industryId) return false;
  }
  if (side.foreign === true && e.isForeign !== true) return false;
  if (side.roleIds && !e.roleIds.some((id) => side.roleIds!.includes(id))) return false;
  return true;
}

/** 並べ方は buildMoves と同じ（開始日 → 終了日。終了日が無いものは後ろ） */
export function sortExperiences(rows: readonly MatchExp[]): MatchExp[] {
  return [...rows].sort((a, b) =>
    a.startedAt === b.startedAt
      ? (a.endedAt ?? "9999-12-31").localeCompare(b.endedAt ?? "9999-12-31")
      : a.startedAt.localeCompare(b.startedAt),
  );
}

/**
 * 1人ぶんの職歴が移動の条件を満たすか。満たすなら、当てはまった移動（移る前・移った先）を返す（いちばん新しいもの）。
 * ⚠️ prevOf と、行き先の無い left は対象外（null）。前者は検索で出さず、後者は人の検索の OB・OG の絞り込みで出す
 */
export function matchTransition(rows: readonly MatchExp[], intent: TransitionIntent): TransitionMatch | null {
  const exps = sortExperiences(rows);
  if (intent.kind === "left") {
    if (!intent.to) return null;
    const here = exps.filter((e) => e.companyId === intent.companyId);
    if (here.length === 0 || here.some((e) => e.isCurrent)) return null;
    const endIdx = Math.max(...here.map((e) => month(e.endedAt ?? e.startedAt) ?? -Infinity));
    const next = exps.find((e) => e.companyId !== intent.companyId && (month(e.startedAt) ?? -Infinity) >= endIdx);
    if (!next || !sideMatches(next, intent.to)) return null;
    return { prev: here[here.length - 1], cur: next };
  }
  if (intent.kind !== "move") return null;

  let found: TransitionMatch | null = null;
  for (let i = 1; i < exps.length; i++) {
    const prev = exps[i - 1];
    const cur = exps[i];
    if (prev.key === cur.key) continue; // 同じ会社での役割の変化は移動ではない
    if (intent.crossIndustry) {
      if (!prev.industryParentId || !cur.industryParentId || prev.industryParentId === cur.industryParentId) continue;
      found = { prev, cur };
      continue;
    }
    if (!sideMatches(cur, intent.to)) continue;
    if (intent.firstTime) {
      const earlier = exps.slice(0, i);
      const to = intent.to!;
      if (intent.firstTime === "industry" && earlier.some((e) => sideMatches(e, { industryId: to.industryId, notIndustry: to.notIndustry }))) continue;
      if (intent.firstTime === "role" && earlier.some((e) => sideMatches(e, { roleIds: to.roleIds }))) continue;
      if (intent.firstTime === "foreign" && earlier.some((e) => e.isForeign === true)) continue;
      found = { prev, cur };
      continue;
    }
    if (!sideMatches(prev, intent.from)) continue;
    /* ★片側だけ業界を言ったときは、もう片側はその反対（「IT以外から来た」＝IT へ来た、「金融から来た」＝金融以外へ） */
    const from = intent.from;
    const to = intent.to;
    if (from?.industryId && !to?.industryId) {
      if (!cur.industryParentId) continue;
      if (from.notIndustry ? cur.industryParentId !== from.industryId : cur.industryParentId === from.industryId) continue;
    }
    if (to?.industryId && !from?.industryId) {
      if (!prev.industryParentId) continue;
      if (to.notIndustry ? prev.industryParentId !== to.industryId : prev.industryParentId === to.industryId) continue;
    }
    found = { prev, cur };
  }
  return found;
}

/**
 * ★会社を指定しない移動の集計（柴さんの決定 7）。**業界の大分類だけ。会社名は出さない。**
 *   移る前の業界・移った先の業界。項目の母数が min（経歴の事実なので3人）に届かなければ null
 * ⚠️ 渡すのは、集計に入れてよい人（isAggregatableUser）の当てはまった移動だけ（呼ぶ側で絞る）
 */
export type MoveSummary = {
  people: number;
  from: { known: number; byIndustry: { label: string; count: number }[] } | null;
  to: { known: number; byIndustry: { label: string; count: number }[] } | null;
};

export function summarizeMoves(
  matches: readonly TransitionMatch[],
  industryName: (id: string) => string,
  min: number,
): MoveSummary | null {
  if (matches.length < min) return null;
  const tally = (ids: string[]) => {
    const m = new Map<string, number>();
    for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([id, count]) => ({ label: industryName(id), count }))
      .filter((r) => r.label)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
  };
  const fromIds = matches.map((m) => m.prev?.industryParentId).filter((x): x is string => !!x);
  const toIds = matches.map((m) => m.cur.industryParentId).filter((x): x is string => !!x);
  return {
    people: matches.length,
    from: fromIds.length >= min ? { known: fromIds.length, byIndustry: tally(fromIds) } : null,
    to: toIds.length >= min ? { known: toIds.length, byIndustry: tally(toIds) } : null,
  };
}

/** ★ログインしていない人に渡す形。件数だけ */
export function toMoveSummaryCounts(s: MoveSummary) {
  return { people: s.people, from: s.from ? { known: s.from.known } : null, to: s.to ? { known: s.to.known } : null };
}
