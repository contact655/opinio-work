/**
 * ★つながりの選び方（純粋な関数。2026-10-16 / フェーズ3）。DB を読まない。
 * `lib/companies/connections.ts` が DB から集めた材料を渡して呼ぶ。
 * ⚠️ 切り出したのは、実データに相互フォローが0組で「出る側」を本番で一度も通せないため。
 *    `scripts/check-connections.mjs` が固定データでこの関数を確かめる（陽性対照）。
 */
export type ConnectionCandidate = { userId: string };

export function pickConnections<T extends ConnectionCandidate>(input: {
  /** 企業ページの現役社員（isSeedRow などの除外は済んでいる） */
  current: T[];
  viewerOwUserId: string;
  /** 閲覧者がフォローしている人（ow_users.id） */
  following: ReadonlySet<string>;
  /** 閲覧者をフォローしている人（ow_users.id） */
  followers: ReadonlySet<string>;
  /** 表示を許可した人（ow_profiles.show_as_connection = true。ow_users.id に写したもの） */
  consented: ReadonlySet<string>;
}): T[] {
  const seen = new Set<string>();
  return input.current.filter((e) => {
    if (!e.userId || e.userId === input.viewerOwUserId) return false;
    if (seen.has(e.userId)) return false;
    seen.add(e.userId);
    return input.following.has(e.userId) && input.followers.has(e.userId) && input.consented.has(e.userId);
  });
}
