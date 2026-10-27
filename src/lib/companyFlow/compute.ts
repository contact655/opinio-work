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
};

export type FlowTurn = { decisiveReasons: string[]; fitAfterYear: number | null };

export type FlowLabels = {
  industry: (id: string) => string;
  role: (id: string) => string;
  reason: (key: string) => string;
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
    const here = rows.filter((r) => r.companyId === companyId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    if (here.length === 0) continue;
    people++;
    const others = rows.filter((r) => r.companyId !== companyId);
    const start = here[0].startedAt;
    const isAlumni = here.every((r) => !r.isCurrent);

    /* 前職 = この会社に入る前の、いちばん最後に始まった他社の職歴 */
    const prev = others.filter((r) => r.startedAt < start).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (prev?.industryParentId) prevIndustries.push(prev.industryParentId);

    if (isAlumni) {
      const endIdx = Math.max(...here.map((r) => monthIndex(r.endedAt ?? r.startedAt) ?? -Infinity));
      /* 行き先 = この会社を出た月以降（同じ月を含む）に始まった、いちばん早い他社の職歴 */
      const next = others
        .filter((r) => { const s = monthIndex(r.startedAt); return s !== null && s >= endIdx; })
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
      if (next?.industryParentId) nextIndustries.push(next.industryParentId);

      /* 在籍月数（開始月と終了月を含め、重なりを除いて足す＝lib/profile/tenure.ts の tenureMonths と同じ数え方） */
      const months = new Set<number>();
      for (const r of here) {
        const s = monthIndex(r.startedAt);
        const e = r.isCurrent || !r.endedAt ? current : monthIndex(r.endedAt);
        if (s === null || e === null || e < s) continue;
        for (let m = s; m <= e; m++) months.add(m);
      }
      if (months.size > 0) alumniMonths.push(months.size);
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
