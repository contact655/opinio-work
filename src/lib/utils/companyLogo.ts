const CORP_PREFIX_RE =
  /^(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|合名会社|合資会社|（株）|（有）)\s*/;
const CORP_SUFFIX_RE = /\s*(株式会社|有限会社|合同会社)$/;

/**
 * logo_letter フィールドから表示用の 1〜2 文字ロゴテキストを返す。
 * - rawLetter が 3 文字以内: 正常データとみなしてそのまま大文字化
 * - それ以外（フルネームが誤入力等）: 法人格プレフィックス/サフィックスを除去し、
 *   ASCII 2 文字 or 非 ASCII 1 文字を返す
 */
export function getLogoLetter(
  rawLetter: string | null | undefined,
  name: string
): string {
  const trimmed = rawLetter?.trim() ?? "";

  if (trimmed.length > 0 && trimmed.length <= 3) {
    return trimmed.toUpperCase();
  }

  const source = trimmed || name;
  const stripped = source
    .replace(CORP_PREFIX_RE, "")
    .replace(CORP_SUFFIX_RE, "")
    .trim();
  const base = stripped || source;

  const first2 = base.slice(0, 2);
  return /^[\x21-\x7E]{2}$/.test(first2)
    ? first2.toUpperCase()
    : base.slice(0, 1).toUpperCase();
}

/**
 * Resolve the best logo URL for a company.
 *
 * Priority:
 * 1. logo_url  (Supabase Storage / direct URL)
 * 2. Clearbit via website_url (bare domain, e.g. "salesforce.com")
 * 3. Clearbit via url (full URL, e.g. "https://salesforce.com")
 * 4. null → caller should render an initial-letter fallback
 */
export function getCompanyLogoUrl(company: {
  logo_url?: string | null;
  website_url?: string | null;
  url?: string | null;
  name?: string | null;
}): string | null {
  if (!company) return null;

  // 1. Direct logo_url
  if (company.logo_url) return company.logo_url;

  // 2. website_url (bare domain — no protocol needed)
  if (company.website_url) {
    return `https://logo.clearbit.com/${company.website_url}`;
  }

  // 3. Full URL → extract domain
  if (company.url) {
    try {
      const domain = new URL(company.url).hostname;
      return `https://logo.clearbit.com/${domain}`;
    } catch {
      // invalid URL
    }
  }

  return null;
}

/**
 * Build a chain of fallback sources for progressive image loading.
 * Used by components that try multiple sources on error.
 */
export function getCompanyLogoSources(company: {
  logo_url?: string | null;
  website_url?: string | null;
  url?: string | null;
}): string[] {
  const sources: string[] = [];

  if (company.logo_url) sources.push(company.logo_url);

  // Clearbit via website_url
  if (company.website_url) {
    sources.push(`https://logo.clearbit.com/${company.website_url}`);
  }

  // Clearbit + Google favicon via url
  if (company.url) {
    try {
      const domain = new URL(company.url).hostname;
      if (!company.website_url) {
        sources.push(`https://logo.clearbit.com/${domain}`);
      }
      sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    } catch {}
  } else if (company.website_url) {
    // Google favicon via website_url
    sources.push(`https://www.google.com/s2/favicons?domain=${company.website_url}&sz=128`);
  }

  return sources;
}
