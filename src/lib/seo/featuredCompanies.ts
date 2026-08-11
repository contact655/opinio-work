import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * meta description に載せる代表企業名を、実データから引く。
 *
 * ── なぜ必要か（2026-08-03）────────────────────────────────────────────────
 * /jobs・/companies・/articles の description に企業名がベタ書きされており、
 * 先頭が「LayerX」だった。LayerX は Migration 239 で削除済みで DB に存在しない。
 * 検索結果に出る説明文が、掲載していない企業名で始まっている状態だった。
 *
 * ベタ書きである限り同じことが再発する（企業の入れ替わりに気づけない）ので、
 * 公開中の企業から引く。
 *
 * ── 並び順を固定する理由 ────────────────────────────────────────────────────
 * 毎回違う企業が出ると description が揺れ続け、クロールのたびに内容が変わる。
 * 「件数の多い順 → 名前順」で決定的に並べ、同じデータなら常に同じ結果になるようにする。
 *
 * ── 表示名 ──────────────────────────────────────────────────────────────────
 * brand_name があればそれを使い、無ければ name から法人格を落とす。
 * 「株式会社セールスフォース・ジャパン」より「Salesforce」のほうが説明文として読める。
 */

/** "株式会社LayerX" → "LayerX"。components/profile/MergedTimeline.tsx と同じ規則 */
function shortCompanyName(name: string): string {
  return (
    name
      .replace(/^株式会社\s*/, "")
      .replace(/\s*株式会社$/, "")
      .replace(/^合同会社\s*/, "")
      .replace(/\s*合同会社$/, "")
      .replace(/^有限会社\s*/, "")
      .replace(/\s*有限会社$/, "")
      .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
      .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
      .replace(/\s*,\s*Inc\.?$/i, "")
      .replace(/\s+Inc\.?$/i, "")
      .replace(/\s+Japan$/i, "")
      .trim() || name
  );
}

/**
 * 何を基準に代表を選ぶか。
 *   jobs     … 公開求人を持つ企業（/jobs 用）
 *   articles … 公開記事を持つ企業（/articles 用）
 *   content  … 求人 + 記事の合計（/companies 用）
 *
 * content を使うのは、単純な名前順だと「Asana・Box・CrowdStrike…」と
 * アルファベット順の先頭が並ぶだけで、ページの中身の厚さと無関係になるため。
 * 中身のある企業を先に出したほうが、説明文としても実態に合う。
 */
type Basis = "jobs" | "articles" | "content" | "any";

async function fetchFeatured(basis: Basis, limit: number): Promise<string[]> {
  const db = createPublicClient();

  // 公開企業だけを対象にする。非公開企業を説明文に出さない
  const { data: companies, error } = await db
    .from("ow_companies")
    .select("id, name, brand_name")
    .eq("is_published", true);
  if (error || !companies?.length) {
    if (error) console.error("[featuredCompanies]", error.message);
    return [];
  }

  // 件数の重みづけ。any のときは全社を同点にして名前順だけで決める
  const weight = new Map<string, number>();
  const add = (id: string | null) => {
    if (id) weight.set(id, (weight.get(id) ?? 0) + 1);
  };

  if (basis === "jobs" || basis === "content") {
    const { data } = await db
      .from("ow_jobs")
      .select("company_id")
      .eq("status", "published").eq("is_test", false);
    for (const r of data ?? []) add(r.company_id as string | null);
  }
  if (basis === "articles" || basis === "content") {
    const { data } = await db
      .from("ow_articles")
      .select("company_id")
      .eq("is_published", true);
    for (const r of data ?? []) add(r.company_id as string | null);
  }

  const ranked = companies
    // 件数基準のときは、実際に持っている企業だけを候補にする
    .filter((c) => basis === "any" || (weight.get(c.id as string) ?? 0) > 0)
    .map((c) => ({
      label: ((c.brand_name as string | null)?.trim() || shortCompanyName(c.name as string)),
      n: weight.get(c.id as string) ?? 0,
    }))
    .sort((a, b) => (b.n - a.n) || a.label.localeCompare(b.label, "ja"));

  // 同じ表示名が複数あっても1つに畳む
  return Array.from(new Set(ranked.map((r) => r.label))).slice(0, limit);
}

const cached = unstable_cache(
  async (basis: Basis, limit: number) => fetchFeatured(basis, limit),
  ["featured-companies"],
  { revalidate: 3600 }
);

/**
 * 「A・B・Cなど、」の形の接頭辞を返す。
 * 企業が足りないときは **空文字** を返し、呼び出し側は企業名に触れない説明文になる。
 * 掲載が薄いうちに数社だけ名指しするより、名前を出さないほうが実態に合う。
 */
export async function featuredCompanyPrefix(
  basis: Basis,
  { limit = 4, min = 3 }: { limit?: number; min?: number } = {}
): Promise<string> {
  const names = await cached(basis, limit);
  if (names.length < min) return "";
  return `${names.join("・")}など、`;
}
