import type { Company } from "@/app/companies/mockCompanies";

/**
 * ★`/jobs` がクライアントへ渡す企業（2026-10-09）。**画面が使う列だけ。**
 *
 * ⚠️★`Company` をそのまま渡さないこと。`/jobs` の RSC ペイロードに載るので、
 *    渡した列はすべてページのソースから読める。2026-10-09 まで全社ぶんの説明文・
 *    福利厚生・評価制度まで載っていた。
 * ⚠️ 列を足すときは、`JobsClient` / `JobListItem` / `JobCardGrid` / `JobPane` が
 *    本当に読むかを確かめてから。型をこの Pick にしてあるので、使っていない列は
 *    足さなくても tsc が落ちない ＝ **足すのは読む側が tsc に落とされたときだけ**。
 */
export type JobsListCompany = Pick<
  Company,
  | "id"
  | "slug"
  | "name"
  | "brand_name"
  | "tagline"
  | "phase"
  | "url"
  | "employee_count"
  | "employee_count_band"
  | "employee_count_as_of"
  | "business_domains"
  | "is_published"
  | "application_open"
  | "gradient"
  | "logo_letter"
  | "logo_url"
>;

export function toJobsListCompany(c: Company): JobsListCompany {
  return {
    id: c.id,
    slug: c.slug ?? null,
    name: c.name,
    brand_name: c.brand_name ?? null,
    tagline: c.tagline,
    phase: c.phase,
    url: c.url ?? null,
    employee_count: c.employee_count,
    employee_count_band: c.employee_count_band ?? null,
    employee_count_as_of: c.employee_count_as_of ?? null,
    business_domains: c.business_domains ?? [],
    is_published: c.is_published,
    application_open: c.application_open,
    gradient: c.gradient,
    logo_letter: c.logo_letter ?? null,
    logo_url: c.logo_url ?? null,
  };
}
