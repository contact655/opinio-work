/**
 * Resolve Opinio Agent perspective for a company.
 *
 * New structured format (Fix 14):
 *   opinio_fit_points: [{ title, detail }]
 *   opinio_caution_points: [{ title, detail }]
 *   opinio_source: string
 *   opinio_updated_at: timestamp
 *
 * Legacy fallback:
 *   opinio_perspective JSONB: { fit_positives: string[], fit_negatives: string[] }
 *   company_pros / company_cons: string[]
 *   fit_positives / fit_negatives: string[]
 */

export type PerspectivePoint = {
  title: string;
  detail?: string;
};

export type OpinioPerspective = {
  fit_points: PerspectivePoint[];
  caution_points: PerspectivePoint[];
  source?: string;
  updated_at?: string | null;
};

function normalizeLegacyToPoints(items: any[]): PerspectivePoint[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") return { title: item };
    if (item && typeof item === "object") {
      return {
        title: item.title || item.text || "",
        detail: item.detail || item.description || undefined,
      };
    }
    return { title: String(item) };
  }).filter((p) => p.title);
}

export function getCompanyPerspective(company: any): OpinioPerspective | null {
  if (!company) return null;

  // 1. Structured opinio_fit_points / opinio_caution_points (Fix 14, preferred)
  if (
    Array.isArray(company.opinio_fit_points) ||
    Array.isArray(company.opinio_caution_points)
  ) {
    const fit = normalizeLegacyToPoints(company.opinio_fit_points || []);
    const caution = normalizeLegacyToPoints(company.opinio_caution_points || []);
    if (fit.length > 0 || caution.length > 0) {
      return {
        fit_points: fit,
        caution_points: caution,
        source: company.opinio_source || "Opinio取材ベース",
        updated_at: company.opinio_updated_at || null,
      };
    }
  }

  // 2. Legacy opinio_perspective JSONB
  if (company.opinio_perspective && typeof company.opinio_perspective === "object") {
    const p = company.opinio_perspective;
    const fit = normalizeLegacyToPoints(p.fit_positives || []);
    const caution = normalizeLegacyToPoints(p.fit_negatives || []);
    if (fit.length > 0 || caution.length > 0) {
      return {
        fit_points: fit,
        caution_points: caution,
        source: p.source || "Opinio取材ベース",
        updated_at: null,
      };
    }
  }

  // 3. Legacy company_pros/cons or fit_positives/fit_negatives
  const prosRaw =
    Array.isArray(company.company_pros) && company.company_pros.length > 0
      ? company.company_pros
      : Array.isArray(company.fit_positives)
      ? company.fit_positives
      : [];
  const consRaw =
    Array.isArray(company.company_cons) && company.company_cons.length > 0
      ? company.company_cons
      : Array.isArray(company.fit_negatives)
      ? company.fit_negatives
      : [];

  const fit = normalizeLegacyToPoints(prosRaw);
  const caution = normalizeLegacyToPoints(consRaw);

  if (fit.length === 0 && caution.length === 0) return null;

  return {
    fit_points: fit,
    caution_points: caution,
    source: "Opinioによる分析",
    updated_at: null,
  };
}

export function formatUpdatedAt(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月時点`;
}
