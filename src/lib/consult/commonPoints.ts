/**
 * ★受け取った人に見せる「送った人との共通点」（2026-11-05 / キャリア相談）。選び方はこの関数だけ。
 *   集めるのは lib/consult/commonPointsServer.ts（プロフィールに出ている情報だけを渡す）。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★渡すのは「相手のプロフィールで見えている情報」だけ。非公開の情報（年収・生年月日・性別・本人だけの回答など）を
 *    ここに渡さないこと。判定にも表示にも使わない。
 * ⚠️ 学校は大学・大学院・高校だけ（「同じ学校の人」と同じ範囲。小中・幼稚園は使わない）。呼ぶ側で絞る。
 */

export type CommonPointSide = {
  /** 学校（大学・大学院・高校だけ） */
  schools: { id: string; name: string; type: "highschool" | "university" | "graduate_school" }[];
  /** 職歴の会社（会社マスタの会社だけ・会社名を出している職歴） */
  companies: { id: string; name: string; isCurrent: boolean }[];
  /** 職歴の会社の業種 */
  industries: { id: string; name: string }[];
  /** 職歴の職種（大分類） */
  roles: { id: string; name: string }[];
};

export type CommonPoint = { kind: "school" | "company" | "industry" | "role"; label: string };

/** 出す数の上限（多すぎると読まれない） */
export const COMMON_POINTS_MAX = 3;

const SCHOOL_WORD = { highschool: "高校", university: "大学", graduate_school: "大学院" } as const;

export function pickCommonPoints(viewer: CommonPointSide, other: CommonPointSide): CommonPoint[] {
  const out: CommonPoint[] = [];
  const seen = new Set<string>();
  const push = (p: CommonPoint, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  const mySchools = new Set(viewer.schools.map((s) => s.id));
  for (const s of other.schools) {
    if (mySchools.has(s.id)) push({ kind: "school", label: `同じ${SCHOOL_WORD[s.type]}（${s.name}）` }, `s:${s.id}`);
  }

  const myCompanies = new Map(viewer.companies.map((c) => [c.id, c]));
  let sharedCompany = false;
  for (const c of other.companies) {
    const mine = myCompanies.get(c.id);
    if (!mine) continue;
    sharedCompany = true;
    push({ kind: "company", label: mine.isCurrent && c.isCurrent ? `同じ会社（${c.name}）` : `同じ会社の出身（${c.name}）` }, `c:${c.id}`);
  }

  /* 同じ会社があれば業種は言わなくても分かるので、会社が重ならないときだけ「同業」 */
  if (!sharedCompany) {
    const myIndustries = new Set(viewer.industries.map((i) => i.id));
    for (const i of other.industries) {
      if (myIndustries.has(i.id)) push({ kind: "industry", label: `同業（${i.name}）` }, `i:${i.id}`);
    }
  }

  const myRoles = new Set(viewer.roles.map((r) => r.id));
  for (const r of other.roles) {
    if (myRoles.has(r.id)) push({ kind: "role", label: `同じ職種（${r.name}）` }, `r:${r.id}`);
  }

  return out.slice(0, COMMON_POINTS_MAX);
}
