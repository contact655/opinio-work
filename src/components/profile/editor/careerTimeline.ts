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
 * ⚠️ 新しく選んだ企業は `companyLogoInfo`（ページを開いたときにサーバーが作る一覧）に無い。
 *    ★2026-10-17 まで、そのとき**会社名まで「非公開」になっていた**（timeline.ts が名前を引けない行を
 *       匿名企業の扱いに落とすため）。いまは Stint が持っている表示名で補う。
 *    補った行は、再読み込みするまで次のとおり:
 *      ・ロゴは頭文字＋既定色（`CompanyLogoIcon` が logo_url null を扱える）
 *      ・企業ページへのリンクを付けない（isPublished: false）。まだ公開していない企業で 404 にしないため
 */
export function stintsToCareerEntries(
  stints: Stint[],
  companyLogoInfo: ({ id: string } & CompanyLogoInfo)[],
  roles: { id: string; name: string; parent_id: string | null }[],
): CareerEntry[] {
  const companyMap = new Map<string, CompanyLogoInfo>(companyLogoInfo.map((c) => [c.id, c]));
  /* ★一覧に無い会社（このページで新しく足した会社）は、表示名だけで補う（上の注記） */
  for (const s of stints) {
    if (s.companyId && !companyMap.has(s.companyId) && s.displayCompanyName) {
      companyMap.set(s.companyId, { name: s.displayCompanyName, logoUrl: null, logoLetter: null, logoGradient: null, isPublished: false });
    }
    /* 出向先も同じ一覧で名前を引くので、同じように補う */
    if (s.secondmentCompanyId && !companyMap.has(s.secondmentCompanyId) && s.secondmentCompanyName) {
      companyMap.set(s.secondmentCompanyId, { name: s.secondmentCompanyName, logoUrl: null, logoLetter: null, logoGradient: null, isPublished: false });
    }
  }
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
    rank_title: s.rankTitle ?? null,
    /* ⚠️ `Stint` は "YYYY-MM"、`CareerEntry` は "YYYY-MM-DD"。1日を足す */
    started_at: `${s.startedAt}-01`,
    ended_at: s.isCurrent ? null : (s.endedAt ? `${s.endedAt}-01` : null),
    is_current: s.isCurrent,
    description: s.description ?? null,
    join_reason: s.joinReason ?? null,
    employment_type: s.employmentType ?? null,
    visibility_company: s.visibilityCompany,
    /* ★出向先（2026-09-12）。⚠️ 落とすと、保存した直後だけ「〇〇へ出向」が消える
          （再読み込みで戻る形の分かりにくい不具合になる）。
       ⚠️ ここは `Stint`（名前を持っている）→ `RawExperienceRow`（id と text）の変換。
          マスタの id は下の `companyMap` で名前に戻るので、**id があれば id を渡す**。 */
    secondment_company_id: s.secondmentCompanyId ?? null,
    secondment_company_text: s.secondmentCompanyId ? null : (s.secondmentCompanyName ?? null),
  }));
  return buildTimelineCareerEntriesFromRaw(rows, roleMap, companyMap, true);
}
