/**
 * ★「担当者のいない企業で待っている人」の集計だけ（2026-10-17）。**何も import しない**
 *   （scripts/check-waiting-companies.mjs が固定データで直接読む。実データでは出る側を通せないため）。
 *   DB から集めるのは waitingCompanies.ts。
 */
export type WaitKind = "applications" | "meetings" | "interested";
export type Wait = { companyId: string; userId: string; at: string; kind: WaitKind };

export type WaitingCompany = {
  companyId: string;
  name: string;
  slug: string | null;
  applications: number;
  meetings: number;
  interested: number;
  /** 一番古い待ちの日時 */
  oldestAt: string;
  /** 待っているのが検証用アカウントだけ */
  testOnly: boolean;
  /** この企業への参加依頼（承認待ち）があるか */
  hasJoinRequest: boolean;
};

export function pickWaitingCompanies(input: {
  waits: Wait[];
  /** 利用者 → is_test */
  userIsTest: Map<string, boolean>;
  /** 企業 → 有効な担当者に実在の人／検証用の人がいるか */
  staff: Map<string, { real: boolean; test: boolean }>;
  joinRequestCompanyIds: Set<string>;
  companies: Map<string, { name: string; slug: string | null }>;
}): WaitingCompany[] {
  const out = new Map<string, WaitingCompany & { realWaiting: boolean }>();
  for (const w of input.waits) {
    const isTest = input.userIsTest.get(w.userId) ?? false;
    const st = input.staff.get(w.companyId);
    /* ⚠️ 待っている人と is_test が一致する担当者がいれば、その人には答える人がいる */
    if (st && (isTest ? st.test : st.real)) continue;
    const co = input.companies.get(w.companyId);
    if (!co) continue;
    const row = out.get(w.companyId) ?? {
      companyId: w.companyId, name: co.name, slug: co.slug,
      applications: 0, meetings: 0, interested: 0, oldestAt: w.at,
      testOnly: true, realWaiting: false, hasJoinRequest: input.joinRequestCompanyIds.has(w.companyId),
    };
    row[w.kind] += 1;
    if (w.at < row.oldestAt) row.oldestAt = w.at;
    if (!isTest) row.realWaiting = true;
    row.testOnly = !row.realWaiting;
    out.set(w.companyId, row);
  }
  return Array.from(out.values())
    .map(({ realWaiting: _realWaiting, ...rest }) => rest)
    /* 実在の利用者が待っている企業を上に、その中は古い順 */
    .sort((a, b) => Number(a.testOnly) - Number(b.testOnly) || a.oldestAt.localeCompare(b.oldestAt));
}
