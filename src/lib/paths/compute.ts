/**
 * ★「行き先」（/paths）の集計（2026-11-04 / 柴さんの承認した計画 docs/plan-career-paths-20261103.md）。純粋な関数だけ。
 *
 * ⚠️★このファイルは何も import しない（node のテストから直接読むため）。移動の組（buildMovePairs）と母数の判定は
 *    呼ぶ側（server.ts）で済ませてから渡す。
 * ⚠️★決め手の回答は一切使わない。入力に回答の項目を持たせないこと。
 * ⚠️★集計の出力（PathsSummary）に user_id・氏名を入れない。個人は pathCards が別に返す（ログイン中だけ使う）。
 * ⚠️ 外すもの（検証用の会社・株式会社エージェント・会社名を出さない職歴）は「移動の単位」で外す。
 *    side.usable が false の側を持つ移動は数えない（職歴を先に抜くと、隣り合わない2つが移動に化ける）。
 */

/** 移動の片側（前の職歴か、次の職歴） */
export type PathSide = {
  /** 個人カードの表示用（職歴の行）。集計では使わない */
  experienceId?: string;
  companyId: string | null;
  companyName: string | null;
  roleTopId: string | null;
  industryTopId: string | null;
  /** 会社名を出してよい職歴で、検証用の会社でもエージェントでもない */
  usable: boolean;
  startedAt: string;
  isCurrent: boolean;
};

export type PathMove = {
  userId: string;
  from: PathSide;
  to: PathSide;
  /** 集計の母数に入る人（isAggregatableUser） */
  aggregatable: boolean;
  /** 個人カードに出してよい人（見ている人ごとに server.ts が決める） */
  cardable: boolean;
};

/** 起点。職種（大分類）・業界（大分類）・会社。2つまで（職種×業界・職種×会社） */
export type PathStart = { roleId: string | null; industryId: string | null; companyId: string | null };

export type DestinationRow = { id: string; count: number };
export type PathsSummary = {
  /** 起点から移った人の数。下限に届かなければ null（数も出さない） */
  moverCount: number | null;
  company: DestinationRow[];
  role: DestinationRow[];
  industry: DestinationRow[];
};

export const PATHS_ROWS_PER_DIMENSION = 5;
export const PATHS_CARD_LIMIT = 24;

/**
 * 起点を整える。会社と業界は同時に持たない（会社が業界を決めるので会社を残す）。
 * 何も無ければ null。
 */
export function normalizeStart(s: Partial<PathStart>): PathStart | null {
  const roleId = s.roleId || null;
  const companyId = s.companyId || null;
  const industryId = companyId ? null : s.industryId || null;
  if (!roleId && !companyId && !industryId) return null;
  return { roleId, industryId, companyId };
}

function sideMatches(side: PathSide, start: PathStart): boolean {
  if (start.roleId && side.roleTopId !== start.roleId) return false;
  if (start.industryId && side.industryTopId !== start.industryId) return false;
  if (start.companyId && side.companyId !== start.companyId) return false;
  return true;
}

/** 数えてよい移動のうち、起点から出たもの */
function movesFrom(moves: readonly PathMove[], start: PathStart): PathMove[] {
  return moves.filter((m) => m.from.usable && m.to.usable && sideMatches(m.from, start));
}

function topRows(counts: Map<string, Set<string>>, min: number): DestinationRow[] {
  return Array.from(counts.entries())
    .map(([id, users]) => ({ id, count: users.size }))
    .filter((r) => r.count >= min)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, PATHS_ROWS_PER_DIMENSION);
}

/**
 * ★集計。母数は aggregatable の人だけ。
 * ・起点全体が min 人未満なら、行も人数も出さない
 * ・行き先の会社・職種（大分類）・業界（大分類）の各行は min 人以上だけ。「その他」にまとめない
 * ・1人が同じ起点から何度移っていても、各行で1回だけ数える
 */
export function computePaths(moves: readonly PathMove[], start: PathStart, min: number): PathsSummary {
  const empty: PathsSummary = { moverCount: null, company: [], role: [], industry: [] };
  const list = movesFrom(moves, start).filter((m) => m.aggregatable);
  const movers = new Set(list.map((m) => m.userId));
  if (movers.size < min) return empty;
  const by = { company: new Map<string, Set<string>>(), role: new Map<string, Set<string>>(), industry: new Map<string, Set<string>>() };
  const add = (map: Map<string, Set<string>>, id: string | null, user: string) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id)!.add(user);
  };
  for (const m of list) {
    add(by.company, m.to.companyId, m.userId);
    add(by.role, m.to.roleTopId, m.userId);
    add(by.industry, m.to.industryTopId, m.userId);
  }
  return { moverCount: movers.size, company: topRows(by.company, min), role: topRows(by.role, min), industry: topRows(by.industry, min) };
}

/** 集計に行が1つでもあるか */
export function hasAnyRow(s: PathsSummary): boolean {
  return s.company.length + s.role.length + s.industry.length > 0;
}

/**
 * ★個人カード（ログイン中だけ使う）。cardable の人の、起点から出た移動。1人1件（いちばん新しい移動）・新しい順・上限あり。
 * ⚠️ 人数を画面に出さないこと（集計の下限を回り込まれる）。
 */
export function pathCards(moves: readonly PathMove[], start: PathStart, opts: { excludeUserId: string | null }): PathMove[] {
  const latest = new Map<string, PathMove>();
  for (const m of movesFrom(moves, start)) {
    if (!m.cardable || m.userId === opts.excludeUserId) continue;
    const prev = latest.get(m.userId);
    if (!prev || m.to.startedAt > prev.to.startedAt) latest.set(m.userId, m);
  }
  return Array.from(latest.values())
    .sort((a, b) => b.to.startedAt.localeCompare(a.to.startedAt) || a.userId.localeCompare(b.userId))
    .slice(0, PATHS_CARD_LIMIT);
}

/**
 * ★一段広げた起点の候補（計画 5）。
 *   職種×会社 → 職種だけ／会社の業界×職種　職種×業界 → 職種だけ／業界だけ　会社 → 会社の業界　職種・業界だけ → 無し
 */
export function widenStart(start: PathStart, industryOfCompany: (companyId: string) => string | null): PathStart[] {
  const out: PathStart[] = [];
  const ind = start.companyId ? industryOfCompany(start.companyId) : null;
  if (start.companyId && start.roleId) {
    out.push({ roleId: start.roleId, industryId: null, companyId: null });
    if (ind) out.push({ roleId: start.roleId, industryId: ind, companyId: null });
  } else if (start.companyId) {
    if (ind) out.push({ roleId: null, industryId: ind, companyId: null });
  } else if (start.roleId && start.industryId) {
    out.push({ roleId: start.roleId, industryId: null, companyId: null });
    out.push({ roleId: null, industryId: start.industryId, companyId: null });
  }
  return out;
}

/** 広げた候補のうち、集計の行が出るものだけ（出ない候補は出さない） */
export function widerWithRows(
  moves: readonly PathMove[], start: PathStart, min: number, industryOfCompany: (companyId: string) => string | null,
): PathStart[] {
  return widenStart(start, industryOfCompany).filter((s) => hasAnyRow(computePaths(moves, s, min)));
}
