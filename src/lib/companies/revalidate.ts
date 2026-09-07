import { revalidatePath } from "next/cache";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";

/**
 * 企業データを書き換えたあとに、求職者側の企業ページを作り直させる。
 *
 * ── なぜ要るか（2026-09-07 に調査）────────────────────────────────────────────
 * ⚠️★**企業詳細ページを名指しで revalidate している経路が実質ゼロだった。**
 *    運営も企業も、編集しても反映は `export const revalidate` の秒数任せ。
 *    唯一 `admin/companies/[id]/toolActions.ts` が
 *    `revalidatePath("/companies/<companyId>")` を呼んでいたが、**渡しているのが UUID**。
 *    ページが配信されるのは `/companies/<slug>`（UUID は 308 リダイレクト）なので、
 *    そのタグを持つキャッシュ実体が存在せず**効いていなかった**。
 *
 *    Next の実装（`next/dist/server/web/spec-extension/revalidate.js:31-42`）は
 *    渡された **path 文字列をそのままソフトタグにする**。だから **slug で呼ぶ必要がある。**
 *
 * ── 使い方 ────────────────────────────────────────────────────────────────
 *   await revalidateCompanyPages(companyId);                      // 通常
 *   await revalidateCompanyPages(companyId, { slug });             // slug が手元にあるとき
 *   await revalidateCompanyPages(companyId, { previousSlug });     // slug が変わったとき
 *
 * ⚠️★**各所に `revalidatePath` をコピーしないこと。** slug 解決を忘れた1箇所が
 *    「直したのに反映されない」に化ける（それがまさに `toolActions.ts` だった）。
 *
 * ⚠️★**これだけでは `unstable_cache` は消えない。**
 *    企業詳細が読むもののうち、写真・採用担当者・ツール・顧客の業界（300秒）、
 *    記事・ストーリー（60秒）、社員（120秒）は**別レイヤー**で、
 *    `revalidatePath` では落ちない。しかも**この7本にはタグが付いていない**ので
 *    `revalidateTag` も打てない（タグがあるのは面談対応者と business-domains だけ）。
 *    → **`ow_companies` 本体（tagline / description / 従業員数 など）は即時になるが、
 *       ツールや写真は最大300秒古いまま。** 実測は下の「B-3」を参照。
 *
 * ⚠️ slug の解決に **no-store クライアントを使う**。`createAdminClient()` だと
 *    その問い合わせ自体が Data Cache に載り、**改名直後に古い slug を revalidate する。**
 */
export async function revalidateCompanyPages(
  companyId: string,
  opts?: { slug?: string | null; previousSlug?: string | null },
): Promise<void> {
  const paths: string[] = [];
  const add = (p: string) => { if (!paths.includes(p)) paths.push(p); };

  /* 一覧。⚠️ 既存の `revalidatePath("/companies")` を置き換える形なので、必ず含める。
     一覧は動的レンダリングなので実質 no-op だが、外すと「一覧も消していた」経路の
     意図が失われる（将来 ISR 化したときに戻し忘れる）。 */
  add("/companies");

  let slug = opts?.slug ?? null;
  if (!slug) {
    const { data, error } = await createNoStoreAdminClient()
      .from("ow_companies")
      .select("slug")
      .eq("id", companyId)
      .maybeSingle();
    /* ⚠️ 握り潰さない。ここが黙って失敗すると「反映されない」だけが残り、
          原因がキャッシュなのか保存なのか切り分けられなくなる。 */
    if (error) console.error("[revalidateCompanyPages] slug 解決に失敗", companyId, error.message);
    slug = (data?.slug as string | null) ?? null;
  }

  /* ⚠️ slug が無い企業は UUID のパスで配信されるので、そのときだけ UUID を使う。
        slug がある企業に UUID を渡しても**当たらない**（それが元の不具合）。 */
  add(`/companies/${slug ?? companyId}`);

  /* 改名（slug 変更）に追随する。⚠️ 古い方も落とさないと、旧 slug のキャッシュが
     `revalidate` の秒数ぶん生き残る。 */
  if (opts?.previousSlug && opts.previousSlug !== slug) {
    add(`/companies/${opts.previousSlug}`);
  }

  for (const p of paths) revalidatePath(p);
}
