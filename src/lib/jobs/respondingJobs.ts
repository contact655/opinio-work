import "server-only";
import { filterCompaniesWithRespondingStaff } from "@/lib/companies/respondingStaff";

/**
 * ★求人は「応募に答えられる担当者がいる会社」のものだけ見せる（2026-10-27 / 柴さんの決定）。
 *
 *   担当者の判定は `filterCompaniesWithRespondingStaff`（会社と is_test が一致する有効な担当者がいるか）の1か所。
 *   実在の会社に実在の担当者がいなければ、その会社の求人は /jobs・会社ページ・検索・sitemap・合う会社など
 *   **すべての面から外す**。求人のデータも公開の状態（status）も書き換えない ——担当者が付けば自動で戻る。
 *   検証用の会社は検証用の担当者がいれば見える（今までどおり）。
 *
 * ⚠️★`PUBLIC_JOB_MATCH`（publicJobs.ts）には混ぜられない（あちらは列だけの条件で、クライアントからも読む）。
 *    公開側で求人を出す・数えるところは、PUBLIC_JOB_MATCH で引いたあとにここを通す。
 * ⚠️★取得に失敗したら「担当者がいない」に倒す（＝出さない。fail-closed。ログは出す）。
 * ⚠️ 求人ページを直接開いたときは 404 にせず会社ページへ戻す（jobs/[id]/page.tsx）。
 */
export async function respondingCompanyIds(companyIds: (string | null | undefined)[], label: string): Promise<Set<string>> {
  const ids = Array.from(new Set(companyIds.filter((v): v is string => !!v)));
  if (ids.length === 0) return new Set();
  const set = await filterCompaniesWithRespondingStaff(ids);
  if (!set) {
    console.error(`[respondingJobs] ${label}: 担当者の判定に失敗したので求人を出さない`);
    return new Set();
  }
  return set;
}

/** 求人の行から、担当者がいる会社のものだけを残す（company_id で判定） */
export async function keepJobsAtRespondingCompanies<T extends { company_id?: string | null }>(rows: T[], label: string): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ok = await respondingCompanyIds(rows.map((r) => r.company_id), label);
  return rows.filter((r) => !!r.company_id && ok.has(r.company_id));
}
