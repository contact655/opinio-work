/**
 * ★企業ページ「人の流れ」の集計（2026-10-27 / 柴さんの決定＝案A）。純粋な関数。
 *
 *   経歴から: 前職（業界の大分類）・行き先（同）・平均在籍（OB）・社内の職種の変化（細かい職種）
 *     → 項目の母数が minCareerFact（3人）以上のときだけ出す
 *   回答から: 入社の決め手の上位（Q1）・入って1年たったころ合っていた割合（Q3）
 *     → 答えた人が minAnswer（5人）以上のときだけ出す
 *   下限未満の項目は null（画面は文言も出さない）。
 *
 * ⚠️★返す形に、個人を特定できる値（user_id・氏名・会社名・個別の期間）を入れないこと。数と業界・職種の名前だけ。
 *    テスト（companyFlow.test.mjs）が、返り値に余計なキーが無いことを確かめている。
 * ⚠️ 母数の絞り込み（isAggregatableUser・visibility_company = 'real'）は呼ぶ側（server.ts）で済ませてから渡す。
 * ⚠️ 前職・行き先で業界まで辿れない人（自由入力の会社・業界の無い会社）は「その他・不明」にまとめず、母数から外す（柴さんの決定）。
 * ⚠️★このファイルは何も import しない（node のテストから直接読むため）。
 */

export type FlowExperience = {
  userId: string;
  companyId: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  roleCategoryId: string | null;
  /** その職歴の会社の業界（大分類に直した id）。辿れなければ null */
  industryParentId: string | null;
  /** 職歴の id（ホームの「似た経歴」で、移った先の転機の回答を引くのに使う） */
  id?: string;
  /** 職種の大分類の id（ホームの「似た経歴」の突き合わせに使う） */
  roleTopId?: string | null;
};

export type FlowTurn = { decisiveReasons: string[]; fitAfterYear: number | null };

export type FlowLabels = {
  industry: (id: string) => string;
  role: (id: string) => string;
  reason: (key: string) => string;
  /** 職種の大分類の名前（検索の「行き先の職種」だけが使う）。辿れなければ "" */
  roleTop?: (id: string) => string;
};

export type FlowOptions = {
  minCareerFact: number;
  minAnswer: number;
  /** Q3 の「合っていた」の下限（4） */
  fitGoodMin: number;
  now?: Date;
};

export type FlowBreakdown = { label: string; count: number }[];

/** ★企業ページに渡す形。⚠️ キーを足すときは、個人が特定できる値でないことを確かめ、テストの許可リストも直す */
export type CompanyFlow = {
  /** 経歴から数えた人数（現役＋OB）。見出しの「N人の経歴から」 */
  people: number;
  previous: { known: number; byIndustry: FlowBreakdown } | null;
  next: { known: number; byIndustry: FlowBreakdown } | null;
  tenure: { alumni: number; avgMonths: number } | null;
  roleChanges: { people: number; paths: FlowBreakdown } | null;
  decisiveTop: { respondents: number; top: FlowBreakdown } | null;
  fitAfterYear: { respondents: number; goodShare: number } | null;
};

const monthIndex = (s: string): number | null => {
  const m = /^(\d{4})-(\d{1,2})/.exec(s);
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null;
};

/** 多い順・同数は名前順 */
function tally(keys: string[], label: (k: string) => string): FlowBreakdown {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([k, count]) => ({ label: label(k), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
}

/**
 * ★1人ぶんの「この会社の前後」。**前職・行き先・在籍月数の定義はここ1か所**（企業ページの「人の流れ」と検索の「出た人」が同じ定義を使う）。
 *   前職   = この会社に入る前の、いちばん最後に始まった他社の職歴
 *   行き先 = この会社を出た月以降（同じ月を含む）に始まった、いちばん早い他社の職歴（OB だけ）
 *   在籍月数 = 開始月と終了月を含め、重なりを除いて足す（OB だけ。lib/profile/tenure.ts の tenureMonths と同じ数え方）
 */
function aroundCompany(rows: readonly FlowExperience[], companyId: string, current: number) {
  const here = rows.filter((r) => r.companyId === companyId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (here.length === 0) return null;
  const others = rows.filter((r) => r.companyId !== companyId);
  const start = here[0].startedAt;
  const isAlumni = here.every((r) => !r.isCurrent);
  const prev = others.filter((r) => r.startedAt < start).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  let next: FlowExperience | null = null;
  let months = 0;
  if (isAlumni) {
    const endIdx = Math.max(...here.map((r) => monthIndex(r.endedAt ?? r.startedAt) ?? -Infinity));
    next = others
      .filter((r) => { const s = monthIndex(r.startedAt); return s !== null && s >= endIdx; })
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0] ?? null;
    const set = new Set<number>();
    for (const r of here) {
      const s = monthIndex(r.startedAt);
      const e = r.isCurrent || !r.endedAt ? current : monthIndex(r.endedAt);
      if (s === null || e === null || e < s) continue;
      for (let m = s; m <= e; m++) set.add(m);
    }
    months = set.size;
  }
  return { here, prev, next, isAlumni, months };
}

export function computeCompanyFlow(
  companyId: string,
  /** 母数の人たちの**全**職歴（会社名を出してよい行だけ）。この会社の行と、前後の他社の行を含む */
  experiences: readonly FlowExperience[],
  /** この会社の転機の回答（母数の人だけ・答えないを除く） */
  turns: readonly FlowTurn[],
  L: FlowLabels,
  opt: FlowOptions,
): CompanyFlow | null {
  const now = opt.now ?? new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const byUser = new Map<string, FlowExperience[]>();
  for (const e of experiences) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
  }

  const prevIndustries: string[] = [];
  const nextIndustries: string[] = [];
  const alumniMonths: number[] = [];
  const rolePaths: string[] = [];
  let people = 0;

  for (const rows of Array.from(byUser.values())) {
    const a = aroundCompany(rows, companyId, current);
    if (!a) continue;
    people++;
    const { here, prev, next, isAlumni, months } = a;
    if (prev?.industryParentId) prevIndustries.push(prev.industryParentId);
    if (isAlumni) {
      if (next?.industryParentId) nextIndustries.push(next.industryParentId);
      if (months > 0) alumniMonths.push(months);
    }

    /* 社内の職種の変化（細かい職種）。最初の職種 → 最後の職種 */
    const roles = here.map((r) => r.roleCategoryId).filter((x): x is string => !!x);
    if (new Set(roles).size >= 2) rolePaths.push(`${roles[0]}>${roles[roles.length - 1]}`);
  }

  if (people === 0) return null;

  const previous = prevIndustries.length >= opt.minCareerFact
    ? { known: prevIndustries.length, byIndustry: tally(prevIndustries, L.industry) } : null;
  const next = nextIndustries.length >= opt.minCareerFact
    ? { known: nextIndustries.length, byIndustry: tally(nextIndustries, L.industry) } : null;
  const tenure = alumniMonths.length >= opt.minCareerFact
    ? { alumni: alumniMonths.length, avgMonths: Math.round(alumniMonths.reduce((a, b) => a + b, 0) / alumniMonths.length) } : null;
  const roleChanges = rolePaths.length >= opt.minCareerFact
    ? { people: rolePaths.length, paths: tally(rolePaths, (k) => { const [a, b] = k.split(">"); return `${L.role(a)} → ${L.role(b)}`; }) } : null;

  /* ★回答由来は項目にも行にも minAnswer（5人）の下限（2026-10-27 / 柴さんの決定）。
        経歴由来の内訳と違い、行ごとの人数が少ないと「誰が何を選んだか」が推測できるため。5人に届く決め手が無ければ項目ごと出さない */
  const q1 = turns.filter((t) => t.decisiveReasons.length > 0);
  const decisiveRows = q1.length >= opt.minAnswer
    ? tally(q1.flatMap((t) => t.decisiveReasons), L.reason).filter((r) => r.count >= opt.minAnswer).slice(0, 3) : [];
  const decisiveTop = decisiveRows.length > 0 ? { respondents: q1.length, top: decisiveRows } : null;
  const q3 = turns.filter((t) => t.fitAfterYear !== null);
  const fitAfterYear = q3.length >= opt.minAnswer
    ? { respondents: q3.length, goodShare: Math.round((q3.filter((t) => (t.fitAfterYear ?? 0) >= opt.fitGoodMin).length / q3.length) * 100) } : null;

  return { people, previous, next, tenure, roleChanges, decisiveTop, fitAfterYear };
}

/** 出せる項目が1つでもあるか（無ければ見出しごと出さない） */
export function hasAnyFlowItem(f: CompanyFlow | null): boolean {
  return !!f && !!(f.previous || f.next || f.tenure || f.roleChanges || f.decisiveTop || f.fitAfterYear);
}

/**
 * ★ログインしていない人と、ページの HTML に渡す形（2026-10-27 / 柴さんの決定）。件数だけで、内訳・平均・割合は入れない。
 *   内訳は「登録すると読めます」とし、ログインしている人にだけ API（/api/jobseeker/companies/[id]/flow）から渡す。
 */
export type CompanyFlowSummary = {
  people: number;
  previous: { known: number } | null;
  next: { known: number } | null;
  tenure: { alumni: number } | null;
  roleChanges: { people: number } | null;
  decisiveTop: { respondents: number } | null;
  fitAfterYear: { respondents: number } | null;
};

export function toFlowSummary(f: CompanyFlow): CompanyFlowSummary {
  return {
    people: f.people,
    previous: f.previous ? { known: f.previous.known } : null,
    next: f.next ? { known: f.next.known } : null,
    tenure: f.tenure ? { alumni: f.tenure.alumni } : null,
    roleChanges: f.roleChanges ? { people: f.roleChanges.people } : null,
    decisiveTop: f.decisiveTop ? { respondents: f.decisiveTop.respondents } : null,
    fitAfterYear: f.fitAfterYear ? { respondents: f.fitAfterYear.respondents } : null,
  };
}

/**
 * ★検索「〈会社〉を出た人」の動き方の集計（2026-10-27 / 柴さんの決定）。**企業ページの「人の流れ」と同じ定義・同じ下限。**
 *   該当人数（OB）・平均在籍・行き先の業界（大分類）・行き先の職種（大分類）
 * ⚠️ 下限は経歴の事実なので minCareerFact（3人）。項目の母数が届かなければ null。OB が届かなければ全体が null
 * ⚠️ 返す形に個人を特定できる値（user_id・会社 id・会社名・個別の期間）を入れない。数と業界・職種の名前だけ
 */
export type LeaverSummary = {
  alumni: number;
  tenure: { alumni: number; avgMonths: number } | null;
  next: { known: number; byIndustry: FlowBreakdown } | null;
  nextRoles: { known: number; byRole: FlowBreakdown } | null;
};

export function computeLeaverSummary(
  companyId: string,
  experiences: readonly FlowExperience[],
  L: Pick<FlowLabels, "industry" | "roleTop">,
  opt: Pick<FlowOptions, "minCareerFact" | "now">,
): LeaverSummary | null {
  const now = opt.now ?? new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const byUser = new Map<string, FlowExperience[]>();
  for (const e of experiences) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
  }
  let alumni = 0;
  const months: number[] = [];
  const nextInd: string[] = [];
  const nextRole: string[] = [];
  for (const rows of Array.from(byUser.values())) {
    const a = aroundCompany(rows, companyId, current);
    if (!a || !a.isAlumni) continue;
    alumni++;
    if (a.months > 0) months.push(a.months);
    if (a.next?.industryParentId) nextInd.push(a.next.industryParentId);
    const top = a.next?.roleCategoryId && L.roleTop ? L.roleTop(a.next.roleCategoryId) : "";
    if (top) nextRole.push(top);
  }
  if (alumni < opt.minCareerFact) return null;
  return {
    alumni,
    tenure: months.length >= opt.minCareerFact
      ? { alumni: months.length, avgMonths: Math.round(months.reduce((x, y) => x + y, 0) / months.length) } : null,
    next: nextInd.length >= opt.minCareerFact ? { known: nextInd.length, byIndustry: tally(nextInd, L.industry) } : null,
    nextRoles: nextRole.length >= opt.minCareerFact ? { known: nextRole.length, byRole: tally(nextRole, (k) => k) } : null,
  };
}

/** ★ログインしていない人に渡す形。件数だけで、内訳・平均は入れない */
export type LeaverSummaryCounts = {
  alumni: number;
  tenure: { alumni: number } | null;
  next: { known: number } | null;
  nextRoles: { known: number } | null;
};

export function toLeaverSummaryCounts(s: LeaverSummary): LeaverSummaryCounts {
  return {
    alumni: s.alumni,
    tenure: s.tenure ? { alumni: s.tenure.alumni } : null,
    next: s.next ? { known: s.next.known } : null,
    nextRoles: s.nextRoles ? { known: s.nextRoles.known } : null,
  };
}

/**
 * ★「〈学校〉を出た人の、いま」（2026-10-27 / 柴さんの決定。「人の流れ」と同じ規則にそろえた）。
 *   渡した人たちの**いまの**職歴（現職）の業界（大分類）と職種（大分類）。1人は業界ごと・職種ごとに1回だけ数える
 * ⚠️ 下限は経歴の事実なので minCareerFact（3人）。項目の母数が届かなければ null。会社名は返さない
 * ⚠️ 母数の絞り込み（isAggregatableUser・visibility_company = 'real'・現職だけ）は呼ぶ側で済ませてから渡す
 */
export type CurrentDestinations = {
  industries: { known: number; byIndustry: FlowBreakdown } | null;
  roles: { known: number; byRole: FlowBreakdown } | null;
};

export function computeCurrentDestinations(
  rows: readonly { userId: string; industryParentId: string | null; roleTopLabel: string | null }[],
  industryName: (id: string) => string,
  minCareerFact: number,
): CurrentDestinations | null {
  const ind = new Map<string, Set<string>>();
  const role = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.industryParentId) ind.set(r.industryParentId, (ind.get(r.industryParentId) ?? new Set<string>()).add(r.userId));
    if (r.roleTopLabel) role.set(r.roleTopLabel, (role.get(r.roleTopLabel) ?? new Set<string>()).add(r.userId));
  }
  const usersOf = (m: Map<string, Set<string>>) => new Set(Array.from(m.values()).flatMap((x) => Array.from(x)));
  const known = (m: Map<string, Set<string>>) => usersOf(m).size;
  const expand = (m: Map<string, Set<string>>) => Array.from(m.entries()).flatMap(([k, set]) => Array.from(set).map(() => k));
  const out: CurrentDestinations = {
    industries: known(ind) >= minCareerFact ? { known: known(ind), byIndustry: tally(expand(ind), industryName) } : null,
    roles: known(role) >= minCareerFact ? { known: known(role), byRole: tally(expand(role), (k) => k) } : null,
  };
  return out.industries || out.roles ? out : null;
}

/**
 * ★ホーム「あなたと似た経歴の人は、こう動いています」（2026-10-27 / 柴さんの決定）。**「人の流れ」と同じ定義・同じ下限。**
 *
 *   似た経歴 = 直近の職歴の「職種の大分類 × 業界の大分類」が本人と同じ職歴を持つ人（D4）。**本人は母数に含めない**
 *   動いた人 = その職歴の会社を出て（OB）、出た月以降に他社へ移った人。前後の定義は aroundCompany（「人の流れ」と共有）
 *   集計    = 動いた人の 行き先の業界（大分類）・行き先の職種（大分類）・その会社での在籍（平均）・1年後に合っていた割合
 *
 * ⚠️ 下限: 経歴の事実（行き先・在籍）は minCareerFact（3人）、回答（1年後）は minAnswer（5人）。届かなければ項目ごと null
 * ⚠️ 動いた人が minCareerFact に届かなければ全体が null（ホームに箱を出さない）
 * ⚠️ 返す形に個人を特定できる値（user_id・会社 id・会社名・個別の期間）を入れない。数と業界・職種の名前だけ
 * ⚠️ 母数の絞り込み（isAggregatableUser・visibility_company = 'real'）は呼ぶ側で済ませてから渡す
 */
export type SimilarPaths = {
  /** 動いた人の数（画面の「〇人の動きから」） */
  movers: number;
  next: { known: number; byIndustry: FlowBreakdown } | null;
  nextRoles: { known: number; byRole: FlowBreakdown } | null;
  tenure: { people: number; avgMonths: number } | null;
  fitAfterYear: { respondents: number; goodShare: number } | null;
};

export function computeSimilarPaths(
  viewerUserId: string,
  key: { roleTopId: string; industryParentId: string },
  experiences: readonly FlowExperience[],
  /** 職歴の id → 転機の Q3（1〜5）。答えないを選んだ回答は呼ぶ側で除く */
  fitByExperienceId: ReadonlyMap<string, number>,
  L: Pick<FlowLabels, "industry" | "roleTop">,
  opt: FlowOptions,
): SimilarPaths | null {
  const now = opt.now ?? new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const byUser = new Map<string, FlowExperience[]>();
  for (const e of experiences) {
    if (e.userId === viewerUserId) continue; // ★本人は母数に含めない
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
  }
  let movers = 0;
  const nextInd: string[] = [];
  const nextRole: string[] = [];
  const months: number[] = [];
  const fits: number[] = [];
  for (const rows of Array.from(byUser.values())) {
    const companies = Array.from(new Set(rows
      .filter((r) => r.companyId && r.roleTopId === key.roleTopId && r.industryParentId === key.industryParentId)
      .map((r) => r.companyId as string)));
    /* その人が似た職歴の会社を出て移った例のうち、いちばん最近のもの（1人は1回だけ数える） */
    let best: { next: FlowExperience; months: number; endedAt: string } | null = null;
    for (const companyId of companies) {
      const a = aroundCompany(rows, companyId, current);
      if (!a || !a.isAlumni || !a.next) continue;
      const endedAt = a.here.map((r) => r.endedAt ?? r.startedAt).sort().slice(-1)[0];
      if (!best || endedAt > best.endedAt) best = { next: a.next, months: a.months, endedAt };
    }
    if (!best) continue;
    movers++;
    if (best.next.industryParentId) nextInd.push(best.next.industryParentId);
    const top = best.next.roleCategoryId && L.roleTop ? L.roleTop(best.next.roleCategoryId) : "";
    if (top) nextRole.push(top);
    if (best.months > 0) months.push(best.months);
    const fit = best.next.id ? fitByExperienceId.get(best.next.id) : undefined;
    if (typeof fit === "number") fits.push(fit);
  }
  if (movers < opt.minCareerFact) return null;
  return {
    movers,
    next: nextInd.length >= opt.minCareerFact ? { known: nextInd.length, byIndustry: tally(nextInd, L.industry) } : null,
    nextRoles: nextRole.length >= opt.minCareerFact ? { known: nextRole.length, byRole: tally(nextRole, (k) => k) } : null,
    tenure: months.length >= opt.minCareerFact
      ? { people: months.length, avgMonths: Math.round(months.reduce((x, y) => x + y, 0) / months.length) } : null,
    /* ★回答は5人から（項目ごと）。割合は1つの値なので、行の下限は回答者の数で見る（「人の流れ」の fitAfterYear と同じ） */
    fitAfterYear: fits.length >= opt.minAnswer
      ? { respondents: fits.length, goodShare: Math.round((fits.filter((f) => f >= opt.fitGoodMin).length / fits.length) * 100) } : null,
  };
}
