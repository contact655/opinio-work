import type { Benefit } from "@/lib/companies/benefits";
export type CompanyGenre = {
  id: string;
  name: string;
};

export type Company = {
  id: string;
  /** URL-safe slug (e.g. "salesforce"). Falls back to id when null. */
  slug?: string | null;
  name: string;
  name_en?: string | null;
  tagline: string;
  /* ⚠️ **求職者側の分類軸は事業領域（`business_domains`）へ移行中。**
        `industry`(text) は廃止予定で、新規企業には書かれない。
        これだけを見ている画面は新しい企業を取りこぼす。 */
  industry: string;
  /** 事業領域（主が先頭）。主だけ出すときは `primaryBusinessDomain()` を使う */
  business_domains?: import("@/types/genre").CompanyBusinessDomain[];
  phase: string;
  /* ⚠️ **DB の `ow_companies.employee_count` は text**（「約200名」など）。
        mock だけが数値なので `string | number` の両方を受ける。
     ⚠️ **`null` を潰さないこと。** 未入力の企業が5社ある（2026-08-28 実測・うち公開2社）。
        `?? 0` で埋めると画面に「0名」と出る（実際に出ていた）。 */
  employee_count: string | number | null;
  job_count: number;
  current_mentors: number;
  alumni_mentors: number;
  accepting_casual_meetings: boolean;
  /**
   * 応募が届く先があるか（`getCompanyNotificationRecipients` が1件以上）。
   *
   * ⚠️ **求人の status とは別物。** published でも宛先が無ければ応募は誰にも届かない。
   *    2026-08-11 時点で、公開求人を持つ7社のうち6社が宛先0件だった。
   * ⚠️ 判定は lib/jobs/application.ts に一本化。ここには結果だけを載せる。
   * ⚠️ 付け忘れると undefined になり、応募CTAが出なくなる（安全側）。
   */
  application_open?: boolean;
  /** 求人・面談OKを実際に表示するか（engagement_status 連動） */
  jobs_public?: boolean;
  updated_days_ago: number;
  gradient: string;
  logo_url?: string | null;
  logo_letter?: string | null;
  url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  careers_url?: string | null;
  genres: CompanyGenre[]; // ow_company_genres 由来、空配列の可能性あり
  is_editors_pick?: boolean;
  is_dimmed?: boolean; // 非公開・休止中
  /** ow_companies.is_published。⚠️ 企業ページへのリンクを出すかの判定に使う。
   *  dev では getCompanies が is_published で絞らないため、リンク側でここを見ること */
  is_published?: boolean;
  mission?: string | null;
  fit_positives?: string[] | null;
  brand_name?: string | null;
  industry_id?: string | null;
  saas_category_id?: string | null;
  about?: string | null;
  why_join?: string | null;
  /* ⚠️ 2026-08-31 に `string[]` から変えた。型は `lib/companies/benefits.ts` に集約 */
  benefits?: Benefit[] | null;
  evaluationSystem?: string | null;
};

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function formatUpdated(days: number): string {
  if (days === 0) return "今日更新";
  if (days === 1) return "昨日更新";
  if (days <= 7) return `${days}日前更新`;
  if (days <= 14) return "今週更新";
  if (days <= 21) return "先週更新";
  if (days <= 31) return "今月更新";
  return `${Math.floor(days / 7)}週間前更新`;
}
