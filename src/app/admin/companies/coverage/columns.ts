import type { TAB_KEYS } from "../[id]/CompanyDetailClient";

type TabKey = (typeof TAB_KEYS)[number];

/**
 * 充填状況一覧で見る項目。
 *
 * ⚠️ **公開情報から機械的に取れるものだけを並べる。** 取材が要る項目
 *    （culture_description / org_teams / ow_company_tools 等）は入れない。
 *    76社を100%にするのが目的で、取材待ちの列を混ぜると「永久に埋まらない赤」が並ぶ。
 *
 * ⚠️ `logo_url` は**入れていない**。76社すべてが死んだ Clearbit URL を指しており、
 *    「値はあるが表示できない」ため ✓/空欄では表せない。別タスクにする。
 *    （表示は CompanyLogo が Google favicon にフォールバックしているので画像自体は出る）
 *
 * ⚠️ `tab` は `/admin/companies/[id]` の `?tab=` に渡す。**綴りは TAB_KEYS が唯一の出どころ。**
 */
export type CoverageColumn = {
  /** DB の列名。URL の `?empty=` にも使う */
  key: string;
  /** 表のヘッダ（狭いので短く） */
  label: string;
  /** ヘッダに出すツールチップ */
  title: string;
  /** 飛び先のタブ */
  tab: TabKey;
};

export const COVERAGE_COLUMNS: CoverageColumn[] = [
  { key: "description",            label: "説明",     title: "企業について（description）",           tab: "basic" },
  { key: "employee_count",         label: "人数",     title: "従業員数（employee_count）",             tab: "basic" },
  { key: "founded_year",           label: "設立",     title: "設立年（founded_year）",                 tab: "basic" },
  { key: "headquarters_address",   label: "本社",     title: "本社所在地（headquarters_address）",     tab: "basic" },
  { key: "branch_locations",       label: "拠点",     title: "拠点（branch_locations）",               tab: "basic" },
  { key: "capital_type",           label: "資本",     title: "資本区分（capital_type）",               tab: "opinio" },
  { key: "parent_company_name",    label: "親会社",   title: "親会社名（parent_company_name）",        tab: "opinio" },
  { key: "parent_company_country", label: "親国",     title: "親会社の国（parent_company_country）",   tab: "opinio" },
  { key: "capital_notes",          label: "資本注",   title: "資本関係の補足（capital_notes）",         tab: "opinio" },
  { key: "global_employee_count",  label: "世界人数", title: "世界の従業員数（global_employee_count）", tab: "opinio" },
  { key: "main_products",          label: "製品",     title: "主な製品（main_products）",              tab: "opinio" },
  { key: "main_customers",         label: "顧客",     title: "主な顧客（main_customers）",             tab: "opinio" },
  { key: "customer_cases",         label: "事例",     title: "顧客事例（customer_cases）",             tab: "opinio" },
];
