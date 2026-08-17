import type { Stint } from "@/components/profile/CareerHistoryEditor";

/**
 * `ow_experiences` の行 → 編集フォームの `Stint`（2026-08-17 に切り出した）。
 *
 * ⚠️ **`/mypage` と `/mypage/details/experience` の両方が使う。**
 *    書き写すと、`Stint` に項目が増えたときに**片方だけ直る**形になる。
 *    列の取り忘れは「別の項目を直して保存しただけで消える」に直結する
 *    （`lib/experiences/columns.ts` の冒頭コメント参照）。
 *
 * ⚠️ **`?? 既定値` で埋めない列がある。** `visibility_*` は DB が NOT NULL なので、
 *    取得漏れを既定値で隠すと同じ事故が黙って通る。
 */
export function rowsToStints(
  rows: Record<string, unknown>[],
  companyNameById: Map<string, string>,
  roleNameById: Map<string, string>,
  gapsByExperience: Map<string, { axis: string; rating: string }[]>,
): Stint[] {
  return rows.map((r) => {
    let companyType: "master" | "custom" | "anon";
    let displayCompanyName: string;
    if (r.company_id) {
      companyType = "master";
      displayCompanyName = companyNameById.get(r.company_id as string) ?? "不明な企業";
    } else if (r.company_text) {
      companyType = "custom";
      displayCompanyName = r.company_text as string;
    } else {
      companyType = "anon";
      displayCompanyName = (r.company_anonymized as string) ?? "非公開企業";
    }
    const roleUuid = r.role_category_id as string;
    return {
      id: r.id as string,
      displayCompanyName,
      companyType,
      companyId: (r.company_id as string | null) ?? undefined,
      companyText: (r.company_text as string | null) ?? undefined,
      companyAnonymized: (r.company_anonymized as string | null) ?? undefined,
      roleCategoryId: roleUuid,
      roleLabel: roleNameById.get(roleUuid) ?? roleUuid,
      roleTitle: (r.role_title as string | null) ?? undefined,
      startedAt: r.started_at ? (r.started_at as string).slice(0, 7) : "",
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: (r.description as string | null) ?? undefined,
      joinReason: (r.join_reason as string | null) ?? undefined,
      employmentType: (r.employment_type as string | null) ?? undefined,
      /* ⚠️ department / rank は PUT が無条件に上書きするので、ここで拾わないと
            別の項目を直して保存しただけで消える。 */
      department: (r.department as string | null) ?? undefined,
      rank: (r.rank as Stint["rank"]) ?? null,
      /* ⚠️ 公開設定3列。DB は NOT NULL なので `?? 既定値` で埋めない。 */
      visibilityCompany: r.visibility_company as Stint["visibilityCompany"],
      visibilityCompanyProfile: r.visibility_company_profile as Stint["visibilityCompanyProfile"],
      visibilityReason: r.visibility_reason as boolean,
      prefecture: (r.prefecture as string | null) ?? undefined,
      remoteWorkStatus: (r.remote_work_status as string | null) ?? undefined,
      joinReasons: (r.join_reasons as string[] | null) ?? [],
      joinReasonPrimary: (r.join_reason_primary as string | null) ?? undefined,
      leaveReasons: (r.leave_reasons as string[] | null) ?? [],
      gaps: gapsByExperience.get(r.id as string) ?? [],
    };
  });
}
