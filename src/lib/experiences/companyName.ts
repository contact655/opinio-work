import { companyDisplayName } from "@/lib/companies/displayName";
/**
 * ow_experiences の会社名を解決する共通ヘルパー。
 *
 * ── なぜ共通化したか ────────────────────────────────────────────────────────
 * 会社名の格納先は3経路の排他で、優先順位は必ず master > custom > anon。
 *
 *   company_id         … 企業マスタ（ow_companies）へのリンク。**社名は JOIN しないと取れない**
 *   company_text       … マスタに無い企業の自由入力
 *   company_anonymized … 匿名表示（「大手SaaS企業」など）
 *
 * 2026-08-03 時点で ow_experiences 18行中 13行（72%）が
 * 「company_id あり / company_text NULL」であり、
 * JOIN を張らずに company_text だけを読む実装は**その 13 行すべてで社名を出せない**。
 * 実際に /feed・/biz/candidates・投稿 API の6箇所がその状態だった。
 *
 * SELECT に `ow_companies(name)` を足し忘れると同じ壊れ方をするので、
 * 呼ぶ側が JOIN 済みかどうかを型で分かるようにしてある（ExperienceCompanyRow）。
 *
 * ── visibility_company との関係 ─────────────────────────────────────────────
 * この関数は**社名の解決だけ**を行い、公開可否は判定しない。
 * `visibility_company`（real / masked / hidden）の扱いは画面ごとに違うため
 * （CLAUDE.md「visibility_company の適用範囲」参照）、
 * 出し分けが要る画面では resolveExperienceCompanyLabel() を使うこと。
 */

/** JOIN 済みの ow_experiences 行。SELECT に `ow_companies(name)` が必要 */
export type ExperienceCompanyRow = {
  company_text?: string | null;
  company_anonymized?: string | null;
  /** `.select("... , ow_companies(name, name_en)")` の結果。エイリアスした場合は company も見る */
  ow_companies?: CompanyRel | CompanyRel[] | null;
  company?: CompanyRel | CompanyRel[] | null;
};

type CompanyRel = { name?: string | null; name_en?: string | null };

/** PostgREST は to-one でもクライアント設定次第で配列を返すことがあるため両方受ける */
function firstRel(rel: CompanyRel | CompanyRel[] | null | undefined): CompanyRel | null {
  if (!rel) return null;
  return (Array.isArray(rel) ? rel[0] : rel) ?? null;
}

/**
 * マスタと紐づいた経歴の社名。**企業ページ・企業一覧と同じ表示名にする。**
 *
 * ⚠️ 2026-08-15 まで `ow_companies.name`（正式名称）をそのまま返しており、
 *    同じ会社が企業一覧では「Salesforce」、ユーザー一覧の経歴では
 *    「株式会社セールスフォース・ジャパン」と出ていた。
 *    表示名の組み立ては `lib/companies/displayName.ts` に集約してあるので、
 *    **ここでもそれを通す。正規表現をコピーしない。**
 */
function masterDisplayName(rel: CompanyRel | CompanyRel[] | null | undefined): string | null {
  const c = firstRel(rel);
  if (!c?.name) return null;
  return companyDisplayName(c.name, c.name_en).displayName;
}

/**
 * 社名を master > custom > anon の順で解決する。
 * どれも無ければ null（「値が無い」ことを「ある値」に置き換えない）。
 */
export function resolveExperienceCompanyName(exp: ExperienceCompanyRow | null | undefined): string | null {
  if (!exp) return null;
  return (
    masterDisplayName(exp.ow_companies) ??
    masterDisplayName(exp.company) ??
    exp.company_text ??
    exp.company_anonymized ??
    null
  );
}

/**
 * visibility_company を反映した表示ラベル。
 *
 *   hidden … null（呼び出し側で行ごと落とす）
 *   masked … maskedLabel（既定「非公開」）
 *   real / 未設定 … 実際の社名
 *
 * ⚠️ visibility_company が NULL の行は「real 扱い」にしている。
 *    DB のデフォルトが 'masked' なので通常 NULL は入らないが、
 *    NULL を masked に倒すと既存の公開済み経歴が黙って消えるため real に寄せた。
 *    非公開希望を優先する原則は hidden / masked が明示されている場合に効く。
 */
export function resolveExperienceCompanyLabel(
  exp: (ExperienceCompanyRow & { visibility_company?: string | null }) | null | undefined,
  maskedLabel = "非公開"
): string | null {
  if (!exp) return null;
  const vis = exp.visibility_company ?? "real";
  if (vis === "hidden") return null;
  if (vis === "masked") return maskedLabel;
  return resolveExperienceCompanyName(exp);
}

/**
 * SELECT 句に足す JOIN の断片。文字列を各所にベタ書きすると
 * 「1箇所だけ書き忘れて社名が出ない」が再発するのでここに集約する。
 *
 *   .select(`user_id, role_title, ${EXPERIENCE_COMPANY_COLS}`)
 */
export const EXPERIENCE_COMPANY_COLS =
  /* ⚠️ `name_en` も取る。表示名は `companyDisplayName` が name_en 優先で作るため、
        取り忘れると経歴だけ正式名称（「株式会社セールスフォース・ジャパン」）に戻る。 */
  "company_id, company_text, company_anonymized, ow_companies(name, name_en)";
