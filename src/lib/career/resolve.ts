/**
 * キャリア軌跡 Phase 1 — サーバー側公開フィルタリング
 *
 * 重要: これらの関数は必ずサーバーコンポーネント / API Route / Server Action で
 * 呼び出すこと。クライアントに CareerStep（実データ）を渡してはならない。
 *
 * 公開制御ルール:
 *   1. visibility_company='hidden' → ステップごと非公開（null を返す）
 *   2. visibility_company='masked' → company_anonymized を表示（実名・FK を渡さない）
 *   3. visibility_company='real'   → 実名表示（companyId も渡す）
 *   4. visibility_salary=false     → salaryMan を null にして渡す
 *   5. visibility_reason=false     → joinReason を null にして渡す
 */

import type { CareerStep, PublicCareerStep, CompanyVisibility } from "@/types/career";

/**
 * visibility_company の設定に従い、表示する企業名を解決する。
 * 'hidden' の場合は null（呼び出し元で step ごと除外する）。
 */
export function maskCompany(
  step: Pick<CareerStep, "visibilityCompany" | "companyText" | "companyAnonymized">
): string | null {
  switch (step.visibilityCompany as CompanyVisibility) {
    case "real":
      return step.companyText ?? null;
    case "masked":
      return step.companyAnonymized ?? "非公開企業";
    case "hidden":
      return null;
  }
}

/**
 * 1ステップを公開用に変換する。
 * visibility_company='hidden' のステップは null を返す（リストから除外する）。
 */
export function resolvePublicStep(step: CareerStep): PublicCareerStep | null {
  if (step.visibilityCompany === "hidden") return null;

  return {
    id: step.id,
    companyDisplay: maskCompany(step),
    // 実名公開の場合のみ companyId を渡す。masked/hidden では渡さない（企業ページへの
    // リンクから個人を特定されないようにするため）。
    companyId: step.visibilityCompany === "real" ? step.companyId : null,
    roleTitle: step.roleTitle,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
    isCurrent: step.isCurrent,
    salaryMan: step.visibilitySalary ? step.salaryMan : null,
    joinReason: step.visibilityReason ? step.joinReason : null,
    employmentType: step.employmentType,
    displayOrder: step.displayOrder,
  };
}

/**
 * ステップ配列を公開用に変換し、displayOrder 順に並べる。
 * hidden ステップは結果に含まれない。
 */
export function resolvePublicSteps(steps: CareerStep[]): PublicCareerStep[] {
  return steps
    .map(resolvePublicStep)
    .filter((s): s is PublicCareerStep => s !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
