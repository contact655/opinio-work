/**
 * ★企業ページの「公開に必要な項目」はここの1か所（2026-10-12 / 柴さんの指示）。**純粋関数。**
 *   画面（/biz/company の「公開まであと〇つ」）とサーバー（公開ゲート `publishable.ts`）が同じ関数を呼ぶ。
 *   求人の `lib/jobs/publishRequirements.ts` と同じ役割。
 *
 * ── 項目は2種類（scope）────────────────────────────────────────────────
 *   always  … 企業名・業種・事業領域。**公開に切り替える一手と「変更を公開する」の全部**で止める
 *   listing … 従業員数・本社所在地。**「掲載を依頼する」のときだけ**止める。
 *             ⚠️★掲載中の企業は止めない（運営の要対応として出すだけ）。2026-10-12 時点で掲載中22社に欠けは0社
 *
 * ⚠️ 業種と事業領域は**下書きの値で判定する**（呼び出し側が下書きを重ねてから渡す）。
 *    本番の値で判定すると、業種を変えた下書きを公開したときに古い業種で判定される。
 * ⚠️ 事業領域が必須かどうかは業種マスタの `requires_business_domain`。**slug で判定しない。**
 * ⚠️ 本社所在地は `headquarters_address`（運営が登記などから入れる）か `location`（企業が入れる）の
 *    どちらかがあればよい。求職者側も headquarters_address を優先し、無ければ location を出す
 *    （`components/companies/CompanyInfoBox.tsx`）。
 * ⚠️ 掲載規約の同意は**ここに入れない**（誰が操作するかで変わる条件。`publishable.ts` が足す）。
 * ⚠️ DB や server-only のものを import しないこと（ブラウザからも読む）。
 */

export type CompanyRequirementKey = "name" | "industry" | "business_domain" | "employee_count" | "headquarters";

export type CompanyRequirement = {
  key: CompanyRequirementKey;
  /** 「公開まであと〇つ」に出す項目名 */
  label: string;
  /** 画面のどの入力欄へ移動するか（要素の id） */
  anchor: string;
  scope: "always" | "listing";
};

export type CompanyRequirementInput = {
  name: string | null | undefined;
  industryId: string | null | undefined;
  /** この業種で事業領域が必須か（`ow_industries.requires_business_domain`） */
  requiresBusinessDomain: boolean;
  /** 主の事業領域が1件あるか */
  hasPrimaryDomain: boolean;
  employeeCountBand: string | null | undefined;
  /** `location`（企業が入れる本社所在地） */
  location: string | null | undefined;
  /** `headquarters_address`（運営が入れる本社の住所）。無ければ null */
  headquartersAddress?: string | null;
};

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim() !== "";

export const COMPANY_REQUIREMENTS: readonly (CompanyRequirement & { ok: (i: CompanyRequirementInput) => boolean })[] = [
  { key: "name", label: "企業名", anchor: "ce-name", scope: "always", ok: (i) => filled(i.name) },
  { key: "industry", label: "業種", anchor: "ce-industry", scope: "always", ok: (i) => filled(i.industryId) },
  {
    key: "business_domain", label: "事業領域", anchor: "ce-business-domain", scope: "always",
    ok: (i) => !i.requiresBusinessDomain || i.hasPrimaryDomain,
  },
  { key: "employee_count", label: "従業員数", anchor: "ce-employee-band", scope: "listing", ok: (i) => filled(i.employeeCountBand) },
  {
    key: "headquarters", label: "本社所在地", anchor: "ce-location", scope: "listing",
    ok: (i) => filled(i.location) || filled(i.headquartersAddress),
  },
];

/**
 * 足りない項目。`forListing` が false なら always の項目だけを見る。
 * ⚠️ 並びは画面の上からの順（「公開まであと〇つ」をこの順に出す）。
 */
export function missingCompanyRequirements(
  input: CompanyRequirementInput,
  opts: { forListing: boolean },
): CompanyRequirement[] {
  return COMPANY_REQUIREMENTS
    .filter((r) => opts.forListing || r.scope === "always")
    .filter((r) => !r.ok(input))
    .map(({ key, label, anchor, scope }) => ({ key, label, anchor, scope }));
}

/** サーバーが利用者に返す文。⚠️ 何が足りないかを具体的に書く */
export function requirementMessage(r: CompanyRequirement): string {
  if (r.key === "business_domain") return "事業領域の「主」が設定されていません（この業種では必須です）。";
  return `${r.label}が入力されていません。`;
}

/** 下書き（`draft_data`）に入れる事業領域のキー。⚠️ 形は `setCompanyBusinessDomains` の body と同じ */
export const DRAFT_BUSINESS_DOMAINS_KEY = "business_domains" as const;
export type DraftBusinessDomains = { domain_ids: string[]; primary_domain_id: string | null };

/** 下書きの事業領域を読む。キーが無ければ null（＝本番の値のまま） */
export function readDraftBusinessDomains(draft: unknown): DraftBusinessDomains | null {
  if (!draft || typeof draft !== "object") return null;
  const v = (draft as Record<string, unknown>)[DRAFT_BUSINESS_DOMAINS_KEY];
  if (!v || typeof v !== "object") return null;
  const ids = (v as Record<string, unknown>).domain_ids;
  const primary = (v as Record<string, unknown>).primary_domain_id;
  if (!Array.isArray(ids)) return null;
  return {
    domain_ids: ids.filter((x): x is string => typeof x === "string"),
    primary_domain_id: typeof primary === "string" && primary ? primary : null,
  };
}
