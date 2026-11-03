/**
 * ★職歴の「同じ会社か」の規則（2026-11-04 に reasonAnswers.ts から切り出した。中身は変えていない）。
 * ⚠️ 何も import しない（`npm test` が直接読む）。規則を書き写さず、ここを使うこと。
 */
export type CompanyIdentity = {
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
};

/** 同じ会社かを決めるキー。⚠️ 匿名企業は名前で束ねる（入力欄は 2026-09-12 に削除済み・本番0件） */
export function companyKey(r: CompanyIdentity): string {
  if (r.company_id) return `id:${r.company_id}`;
  if (r.company_text) return `text:${r.company_text.trim()}`;
  return `anon:${(r.company_anonymized ?? "").trim()}`;
}

/** 2つの職歴（または更新の前後）が同じ会社か */
export function isSameCompany(a: CompanyIdentity, b: CompanyIdentity): boolean {
  return companyKey(a) === companyKey(b);
}
