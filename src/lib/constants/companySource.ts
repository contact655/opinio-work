/**
 * `ow_companies.source` — **どの入口から作られたか。誰が作ったか（ロール）ではない。**
 *
 * ⚠️★**DB の CHECK とこのファイルは同じ migration で一緒に動かすこと**
 *    （`20260905060000_company_source_check_and_industry_description.sql`）。
 *    CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
 *
 * ── なぜ CHECK を後から張ったか ──────────────────────────────────────────────
 * この列は 2026-05-18（`archive/104`）に `source text` として足されただけで、
 * **CHECK も定数も無かった。** 104 のコメントが宣言した語彙は
 * `admin_seed / self_serve / NULL` だったが、実測（2026-09-05 / 100社）は:
 *
 *     migration 79 / NULL 9 / manual 8 / biz_self 3 / admin_seed 1
 *     ★宣言にあった self_serve は **0件**
 *     ★宣言に無い migration と manual が **87件**
 *
 * **宣言が0件で、宣言に無い値が大多数**という、CHECK の無い列挙列で必ず起きる形。
 * 誰もエラーを見ないので、気づくには数えるしかなかった。
 */

export const COMPANY_SOURCES = [
  /** SQL で投入した（`supabase/migrations/`） */
  "migration",
  /** 運営が手で作成した */
  "manual",
  /** `POST /api/biz/companies` — 企業担当者が自社を登録した */
  "biz_self",
  /** 初期投入 */
  "admin_seed",
  /** ★`POST /api/jobseeker/companies` — 求職者が経歴入力から作成した（2026-09-05） */
  "user",
] as const;

export type CompanySource = (typeof COMPANY_SOURCES)[number];

/** 運営画面に出す名前。⚠️ 値そのもの（`biz_self`）を画面に出さない */
export const COMPANY_SOURCE_LABELS: Record<CompanySource, string> = {
  migration: "SQL投入",
  manual: "運営が作成",
  biz_self: "企業が登録",
  admin_seed: "初期投入",
  user: "求職者が作成",
};

/**
 * ⚠️ **NULL は「不明」であって、既定値ではない。**
 *    2026-09-05 時点で9社。`created_at` から推測して埋めないこと
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 */
export const COMPANY_SOURCE_UNKNOWN_LABEL = "不明";

export function companySourceLabel(source: string | null): string {
  if (!source) return COMPANY_SOURCE_UNKNOWN_LABEL;
  return (COMPANY_SOURCE_LABELS as Record<string, string>)[source] ?? source;
}
