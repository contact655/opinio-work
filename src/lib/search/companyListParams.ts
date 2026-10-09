/**
 * /companies の URL → `searchCompanies` の引数（2026-10-09）。
 *
 * ⚠️★ページ（companies/(list)/page.tsx）と件数の API（/api/companies/count）の
 *    **両方がこの1つを通す。** 書き写すと、詳細検索のドロワーの「N社を表示」と
 *    押した後の一覧の件数がずれる（docs/list-filters-20261009.md）。
 */
import type { WorkStyleValue } from "@/lib/search/companies";

export type CompanyListQuery = {
  q?: string;
  phase?: string;
  workStyle?: string;
  hiring?: string;
  location?: string;
  industry?: string;
  target?: string;
  foreign?: string;
  /** 話を聞ける人（`?talk=1`） */
  talk?: string;
  sort?: string;
};

/** 絞り込みがあるか。⚠️ 外資系は含めない（外資系だけのときは一覧グリッドのままページ分けする） */
export function hasCompanyFilter(sp: CompanyListQuery): boolean {
  return Boolean(sp.q || sp.phase || sp.workStyle || sp.hiring || sp.location || sp.industry || sp.target || sp.talk);
}

/** 絞り込みの条件（並び替えを含む・ページ分けは含まない） */
export function companyFilterParams(sp: CompanyListQuery) {
  return {
    q: sp.q || undefined,
    phase: sp.phase || undefined,
    workStyle: (sp.workStyle as WorkStyleValue) || undefined,
    hiring: sp.hiring === "1" ? true : undefined,
    location: sp.location || undefined,
    industry: sp.industry || undefined,
    targetIndustry: sp.target || undefined,
    foreign: sp.foreign === "1" ? true : undefined,
    talk: sp.talk === "1" ? true : undefined,
    sort: sp.sort ?? "newest",
  };
}
