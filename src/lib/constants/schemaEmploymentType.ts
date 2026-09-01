/**
 * 求人の雇用形態 → schema.org の employmentType。
 *
 * ⚠️ `generateMetadata`（`/jobs/[id]/page.tsx`）と本体（`JobDetailView`）の**両方が使う**ので
 *    ここに置いてある。2箇所に書き写すと、構造化データと画面がずれる。
 */
export const SCHEMA_EMPLOYMENT_TYPE: Record<string, string | undefined> = {
  "正社員": "FULL_TIME",
  "契約社員": "CONTRACTOR",
  "業務委託": "CONTRACTOR",
  "インターン": "INTERN",
  "アルバイト・パート": "PART_TIME",
};
