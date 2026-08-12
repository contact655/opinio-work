import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { getRoleAliases, getRoleTree } from "@/lib/supabase/queries";
import { filterListedCompanies } from "@/lib/companies/visibility";

export const dynamic = "force-dynamic";

/**
 * 検索の入口。LP のヒーロー検索はここに投げ、ここが企業一覧か求人一覧かを決めて
 * リダイレクトする。
 *
 * ── なぜ中継を挟むか ────────────────────────────────────────────────────────
 * 以前は LP で「企業を調べる / 求人を探す」の Intent Modes を先に選ばせていたが、
 * 検索前にスコープを決めさせるのは利用者に判断を押し付ける形だった。
 * 入力語からこちらで判定する。
 *
 * ここを1箇所に集約しておくと、言い換え（「エンタープライズ企業」→「大企業」等）の
 * 解決層を後から差し込むときに、触る場所がここだけで済む。
 *
 * ── 判定の順序 ──────────────────────────────────────────────────────────────
 * 職種語を先に見る。「営業」「エンジニア」のような語は求人を探している合図であり、
 * 企業名と衝突しにくい。逆に企業名を先に見ると、社名に業種語が入っている企業
 * （例: 「〜エンジニアリング」）が職種検索を横取りしてしまう。
 *
 * どちらとも判定できないときは企業一覧に送る。LP の既定が「企業を調べる」だった
 * のと揃えている。企業一覧は業種・フェーズなどの絞り込みが揃っており、
 * 空振りしたときに次の一手を出しやすい。
 */

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // 全角英数を半角へ（「ＳａａＳ」→「saas」）
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 全角スペース・連続スペースを1つに
    .replace(/[\s　]+/g, " ");
}

async function resolveDestination(raw: string): Promise<string> {
  const q = normalize(raw);
  if (!q) return "/companies";

  const encoded = encodeURIComponent(raw.trim());
  const words = q.split(" ").filter(Boolean);

  const [aliases, roleTree] = await Promise.all([getRoleAliases(), getRoleTree()]);

  // ── ① 職種語（ow_roles の名前 + ow_role_aliases）に当たるか ────────────────
  //    部分一致で見る。「エンタープライズ営業」のような複合語でも
  //    「営業」を含んでいれば職種の意図と取れる。
  const roleTerms: string[] = [
    ...Array.from(roleTree.byId.values()).map((r) => r.name),
    ...aliases.map((a) => a.alias),
  ].map((t) => t.toLowerCase()).filter((t) => t.length >= 2);

  const hitsRole = roleTerms.some((t) => q.includes(t) || words.some((w) => w.includes(t)));
  if (hitsRole) return `/jobs?q=${encoded}`;

  // ── ② 企業名・ブランド名・slug に当たるか ─────────────────────────────────
  const supabase = createPublicClient();
  const safe = q.replace(/[(),%*]/g, "");
  if (safe) {
    const pattern = `%${safe}%`;
    // ⚠️ 検索のルーティングもディレクトリの軸。非掲載企業に飛ばさない
    const { data } = await filterListedCompanies(
      supabase.from("ow_companies").select("id", { head: false })
    )
      .or(`name.ilike.${pattern},brand_name.ilike.${pattern},slug.ilike.${pattern}`)
      .limit(1);
    if ((data?.length ?? 0) > 0) return `/companies?q=${encoded}`;
  }

  // ── ③ どちらとも決まらない → 企業一覧 ────────────────────────────────────
  return `/companies?q=${encoded}`;
}

export default async function SearchRouterPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const raw = (searchParams.q ?? "").slice(0, 200);
  redirect(await resolveDestination(raw));
}
