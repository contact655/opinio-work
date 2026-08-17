import type { CareerEntry } from "@/components/profile/MergedTimeline";
import type { Stint } from "@/components/profile/CareerHistoryEditor";
import {
  buildTimelineCareerEntriesFromRaw,
  type RawExperienceRow,
  type CompanyLogoInfo,
  type RoleInfo,
} from "@/lib/utils/timeline";

/**
 * 編集用の `Stint[]` を、表示用の `CareerEntry[]` に変換する。
 *
 * ⚠️ **`/mypage` の本体と `/mypage/details/experience` の両方が使う**（2026-08-17）。
 *    片方に書き写すと、`Stint` に列が増えたときに**どちらか一方だけ直る**形になる。
 *
 * ⚠️ 新しく選んだ企業のロゴは `companyLogoInfo` に無い。頭文字＋既定色に落ちるだけで、
 *    再読み込みすれば正しく出る（`CompanyLogoIcon` が logo_url null を扱える）。
 */
export function stintsToCareerEntries(
  stints: Stint[],
  companyLogoInfo: ({ id: string } & CompanyLogoInfo)[],
  roles: { id: string; name: string; parent_id: string | null }[],
): CareerEntry[] {
  const companyMap = new Map<string, CompanyLogoInfo>(companyLogoInfo.map((c) => [c.id, c]));
  const roleMap = new Map<string, RoleInfo>(
    roles.map((r) => [r.id, {
      name: r.name,
      parent_name: r.parent_id ? (roles.find((p) => p.id === r.parent_id)?.name ?? null) : null,
    }]),
  );
  const rows: RawExperienceRow[] = stints.map((s) => ({
    id: s.id,
    company_id: s.companyId ?? null,
    company_text: s.companyText ?? null,
    company_anonymized: s.companyAnonymized ?? null,
    role_category_id: s.roleCategoryId,
    role_title: s.roleTitle ?? null,
    department: s.department ?? null,
    rank: s.rank ?? null,
    /* ⚠️ `Stint` は "YYYY-MM"、`CareerEntry` は "YYYY-MM-DD"。1日を足す */
    started_at: `${s.startedAt}-01`,
    ended_at: s.isCurrent ? null : (s.endedAt ? `${s.endedAt}-01` : null),
    is_current: s.isCurrent,
    description: s.description ?? null,
    join_reason: s.joinReason ?? null,
    employment_type: s.employmentType ?? null,
    visibility_company_profile: s.visibilityCompanyProfile,
  }));
  return buildTimelineCareerEntriesFromRaw(rows, roleMap, companyMap, true);
}
