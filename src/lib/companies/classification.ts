/**
 * ★会社の分類（4つの質問）の語彙と純粋な関数（2026-10-12 / 柴さんの判断）。
 *   ① 業種（大分類 › 小分類）② 事業（最大3つ・★が主）③ 資本（日系／外資系＋本社の国）・事業ステージ ④ お客さまの業界
 *   docs/classification-step0-20261012.md §3-5。
 *
 * ⚠️ DB や server-only のものを import しないこと（ブラウザからも読む）。
 * ⚠️ ステージの値は DB の CHECK（`ow_companies.company_stage`）と同じ7つ。足すときは3層（UI・API・CHECK）を揃える。
 */

// ── 事業ステージ（③）────────────────────────────────────────────────────
export const COMPANY_STAGES = [
  { value: "startup_early", label: "スタートアップ（創業期）", desc: "シード〜シリーズA" },
  { value: "startup_growth", label: "スタートアップ（成長期）", desc: "シリーズB以降" },
  { value: "ipo_prep", label: "IPO準備中", desc: "上場の準備を進めている" },
  { value: "listed", label: "上場企業", desc: "自社または親会社が上場している" },
  { value: "mega_venture", label: "メガベンチャー", desc: "規模が大きく、名前が広く知られた非上場の会社" },
  { value: "sme", label: "中堅・中小企業", desc: "従業員1,000名未満" },
  { value: "large", label: "大企業", desc: "従業員1,000名以上" },
] as const;
export type CompanyStage = (typeof COMPANY_STAGES)[number]["value"];
export const isCompanyStage = (v: unknown): v is CompanyStage =>
  typeof v === "string" && COMPANY_STAGES.some((s) => s.value === v);
export const companyStageLabel = (v: string | null | undefined): string | null =>
  COMPANY_STAGES.find((s) => s.value === v)?.label ?? null;

/** ★大企業と中堅・中小の境目（判断 #2）。候補を出すだけで、保存は人が押す */
export const LARGE_COMPANY_MIN_EMPLOYEES = 1000;

// ── 本社の国（③・外資系のときだけ）─────────────────────────────────────
/** 画面に先に出す国（判断どおり）。⚠️ 中身は ISO 3166-1 alpha-2。あとから増やせる */
export const HQ_COUNTRIES_MAIN = [
  { code: "US", label: "アメリカ" }, { code: "GB", label: "イギリス" }, { code: "DE", label: "ドイツ" },
  { code: "FR", label: "フランス" }, { code: "CH", label: "スイス" }, { code: "SG", label: "シンガポール" },
  { code: "CN", label: "中国" }, { code: "KR", label: "韓国" }, { code: "IN", label: "インド" },
] as const;
/** 「その他」から選ぶ国 */
export const HQ_COUNTRIES_OTHER = [
  { code: "IE", label: "アイルランド" }, { code: "NL", label: "オランダ" }, { code: "SE", label: "スウェーデン" },
  { code: "FI", label: "フィンランド" }, { code: "DK", label: "デンマーク" }, { code: "NO", label: "ノルウェー" },
  { code: "BE", label: "ベルギー" }, { code: "ES", label: "スペイン" }, { code: "IT", label: "イタリア" },
  { code: "AT", label: "オーストリア" }, { code: "LU", label: "ルクセンブルク" }, { code: "IL", label: "イスラエル" },
  { code: "CA", label: "カナダ" }, { code: "AU", label: "オーストラリア" }, { code: "NZ", label: "ニュージーランド" },
  { code: "TW", label: "台湾" }, { code: "HK", label: "香港" }, { code: "AE", label: "アラブ首長国連邦" },
] as const;
const ALL_COUNTRIES: readonly { code: string; label: string }[] = [...HQ_COUNTRIES_MAIN, ...HQ_COUNTRIES_OTHER];
export const isHqCountry = (v: unknown): v is string => typeof v === "string" && ALL_COUNTRIES.some((c) => c.code === v);
export const hqCountryLabel = (code: string | null | undefined): string | null =>
  ALL_COUNTRIES.find((c) => c.code === code)?.label ?? (code ? code : null);
export const isMainHqCountry = (code: string | null | undefined) => HQ_COUNTRIES_MAIN.some((c) => c.code === code);

// ── 資本（③）。正は `ow_companies.capital_type`（判断 #20・提案C）────────────
/** 画面の2択。⚠️ DB の capital_type は4値（japanese_independent / japanese_group / foreign_subsidiary / other） */
export type CapitalOrigin = "domestic" | "foreign";
export function capitalOriginOf(capitalType: string | null | undefined): CapitalOrigin | null {
  if (capitalType === "foreign_subsidiary") return "foreign";
  if (capitalType === "japanese_independent" || capitalType === "japanese_group") return "domestic";
  return null;
}
/** 2択から capital_type を決める。⚠️ 日系のときは今の細かい区分（独立／グループ）を保つ */
export function capitalTypeFor(origin: CapitalOrigin, current: string | null | undefined): string {
  if (origin === "foreign") return "foreign_subsidiary";
  return current === "japanese_group" || current === "japanese_independent" ? current : "japanese_independent";
}
export const CAPITAL_TYPES = ["japanese_independent", "japanese_group", "foreign_subsidiary", "other"] as const;
export const isCapitalType = (v: unknown): v is string => typeof v === "string" && (CAPITAL_TYPES as readonly string[]).includes(v);

// ── マスタの形（サーバーが組んで渡す）───────────────────────────────────
export type ClassIndustry = { id: string; name: string; slug: string; parent_id: string | null; display_order: number };
export type ClassDomain = {
  id: string; name: string; slug: string;
  /** 属する業種（大分類） */
  industry_id: string | null;
  display_kind: "main" | "search";
  aliases: string[];
  /** pending＝この会社が追加して運営の確認待ち（選んだ会社にだけ出る） */
  status: "active" | "pending";
  display_order: number;
};
export type ClassMasters = { industries: ClassIndustry[]; domains: ClassDomain[] };

export function topIndustries(industries: ClassIndustry[]): ClassIndustry[] {
  return industries.filter((i) => !i.parent_id).sort((a, b) => a.display_order - b.display_order);
}
export function childIndustries(industries: ClassIndustry[], parentId: string): ClassIndustry[] {
  return industries.filter((i) => i.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);
}
/** 選んでいる業種の大分類（小分類を選んでいれば親）。見つからなければ null */
export function topOf(industries: ClassIndustry[], industryId: string | null | undefined): ClassIndustry | null {
  const i = industries.find((x) => x.id === industryId);
  if (!i) return null;
  return i.parent_id ? industries.find((x) => x.id === i.parent_id) ?? null : i;
}
/** 業種の表示（大分類 › 小分類） */
export function industryPath(industries: ClassIndustry[], industryId: string | null | undefined): string | null {
  const i = industries.find((x) => x.id === industryId);
  if (!i) return null;
  const p = i.parent_id ? industries.find((x) => x.id === i.parent_id) : null;
  return p ? `${p.name} › ${i.name}` : i.name;
}
/** 大分類だけを選んでいて、その大分類に小分類があるか（＝小分類を選ぶ必要がある） */
export function industryNeedsSub(industries: ClassIndustry[], industryId: string | null | undefined): boolean {
  const i = industries.find((x) => x.id === industryId);
  if (!i || i.parent_id) return false;
  return industries.some((x) => x.parent_id === i.id);
}

// ── 事業の検索（AI を使わない。部分一致と別名だけ）──────────────────────
/** 比べる前に揃える（全角半角・大小・空白・中黒・括弧） */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s・･\-_/（）()「」]/g, "");
}
/** 事業を探す。名前と別名の部分一致。並び: 名前の前方一致 → 名前の部分一致 → 別名 */
export function searchDomains(domains: ClassDomain[], query: string, limit = 30): ClassDomain[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const scored: { d: ClassDomain; score: number }[] = [];
  for (const d of domains) {
    const n = normalizeForSearch(d.name);
    let score = -1;
    if (n.startsWith(q)) score = 0;
    else if (n.includes(q)) score = 1;
    else if (d.aliases.some((a) => normalizeForSearch(a).includes(q))) score = 2;
    if (score >= 0) scored.push({ d, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.d.display_order - b.d.display_order || a.d.name.localeCompare(b.d.name, "ja"))
    .slice(0, limit)
    .map((x) => x.d);
}
/** 同じ名前（別名を含む）が既にあるか。追加の重複を止める */
export function findDomainByExactName(domains: ClassDomain[], name: string): ClassDomain | null {
  const q = normalizeForSearch(name);
  return domains.find((d) => normalizeForSearch(d.name) === q || d.aliases.some((a) => normalizeForSearch(a) === q)) ?? null;
}
export const MAX_NEW_DOMAIN_NAME = 40;

// ── 入力の値（下書き・運営の編集で共通）─────────────────────────────────
export type ClassificationValue = {
  industryId: string;
  domainIds: string[];
  primaryDomainId: string | null;
  capitalType: string;
  hqCountry: string;
  companyStage: string;
  customerIndustryIds: string[];
  servesConsumers: boolean;
  customerAllIndustries: boolean;
};

/** 下書き（`draft_data`）に入れるお客さまのキー。⚠️ 形は setCompanyCustomerIndustries の引数と同じ */
export const DRAFT_CUSTOMERS_KEY = "customer_industries" as const;
export type DraftCustomers = { industry_ids: string[]; serves_consumers: boolean; all_industries: boolean };
export function readDraftCustomers(draft: unknown): DraftCustomers | null {
  if (!draft || typeof draft !== "object") return null;
  const v = (draft as Record<string, unknown>)[DRAFT_CUSTOMERS_KEY];
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (!Array.isArray(r.industry_ids)) return null;
  return {
    industry_ids: r.industry_ids.filter((x): x is string => typeof x === "string"),
    serves_consumers: r.serves_consumers === true,
    all_industries: r.all_industries === true,
  };
}

/** 「業界を問わない」を選んだら「個人のお客さま」は外す。
 *  ★業界は残す（2026-10-18 / 柴さんの判断 A）。業界を問わない会社でも「とくに多い業界」を持てるようにした
 *   （それまでは業界も外していたので、製造業・小売に多く売っている会社が候補者の「合うところ」に業界を出せなかった）。
 *   ⚠️ 「個人のお客さま」と「業界を問わない（企業向け）」は両立させない（判断 #19 のまま） */
export function normalizeCustomers(v: { industryIds: string[]; servesConsumers: boolean; allIndustries: boolean }) {
  return v.allIndustries ? { industryIds: v.industryIds, servesConsumers: false, allIndustries: true } : v;
}

/** ★お客さまの1行（企業ページのサイドバー・プレビュー）。業界を問わない会社は「業界を問わない（主に A・B）」。値が無ければ空文字 */
export function customersText(v: { allIndustries: boolean; industryNames: string[]; servesConsumers: boolean }): string {
  /* ⚠️ 区切りは「、」。業界名そのものに「・」が入る（商社・小売・流通）ので、「・」でつなぐと切れ目が分からない */
  if (v.allIndustries) return v.industryNames.length > 0 ? `業界を問わない（主に${v.industryNames.join("、")}）` : "業界を問わない";
  return [...v.industryNames, ...(v.servesConsumers ? ["個人のお客さま"] : [])].join("、");
}

/** 求職者に見せるタイプの1行（日系・外資系（国）・ステージ）。値が無いところは出さない */
export function companyTypeText(capitalType: string | null | undefined, hqCountry: string | null | undefined, stage: string | null | undefined): string | null {
  const origin = capitalOriginOf(capitalType);
  const parts: string[] = [];
  if (origin === "foreign") parts.push(hqCountry ? `外資系（${hqCountryLabel(hqCountry)}）` : "外資系");
  if (origin === "domestic") parts.push("日系");
  const s = companyStageLabel(stage);
  if (s) parts.push(s);
  return parts.length > 0 ? parts.join("・") : null;
}

/** ★従業員数の候補（判断 #2）。数字が読めなければ null。⚠️ 候補を出すだけで書かない */
export function stageCandidateFromEmployees(employeeCount: string | null | undefined): CompanyStage | null {
  if (!employeeCount || /グローバル/.test(employeeCount)) return null;
  const single = employeeCount.match(/単体\s*([\d,]+)/);
  const raw = single ? single[1] : (employeeCount.split(/[（/]/)[0].match(/[\d,]+/)?.[0] ?? null);
  if (!raw) return null;
  const n = parseInt(raw.replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  return n >= LARGE_COMPANY_MIN_EMPLOYEES ? "large" : "sme";
}
