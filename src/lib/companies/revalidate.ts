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
 * ── ★`unstable_cache` も一緒に落ちる（2026-09-08 に本番で実測）──────────────
 * ⚠️★**当初「`revalidatePath` は `unstable_cache` を消さない」と書いていたが、誤りだった。**
 *    本番 `/companies/opinio` を2秒間隔でポーリングして計測した結果:
 *
 *      tagline（`unstable_cache` を通らない）… 保存 13:38:38.051 → 反映 13:38:38.442（**391ms**）
 *      ツール追加（`getCompanyToolsCached` 300秒）… 追加 13:46:19.285 → 反映 13:46:19.473（**188ms**）
 *      ツール削除（同上）… 14:01:51.633 に反映（bytes 188,653 → 183,108）
 *
 *    TTL 切れでは説明できない。ツールのエントリは 13:45:11 の再生成で作り直されており、
 *    13:46:19 時点で**68秒＝期限内**だった。つまり `revalidatePath` が
 *    `unstable_cache` のエントリも落としている（Next はページ描画中に作られた
 *    キャッシュ実体にそのページのパスを暗黙のタグとして付ける）。
 *    → **`revalidateTag` を足す案は撤回した。** 7本にタグを付ける必要は無い。
 *
 * ⚠️ ただし確かめたのは**そのページの描画中に作られたエントリ**だけ。
 *    複数ページで共有されるエントリまで落ちるかは**未確認**。
 *
 * ⚠️★**判別軸: `x-vercel-cache: REVALIDATED` かつ `age=0` だけが本物のオンデマンド再検証。**
 *    同じ日に `REVALIDATED age=36` / `age=5` が出てサーバーアクションの発火と誤読しかけた
 *    （実体は Vercel のエッジ地域差）。**`age` を見ずに `REVALIDATED` だけで判断しない。**
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

/**
 * 求人を書き換えたあとに、求人ページ・求人一覧・**その企業の企業ページ**を作り直させる。
 *
 * ⚠️★**企業ページも一緒に落とす。** 企業詳細は公開求人と「募集中 N件」を出しているので、
 *    求人の公開・取り下げは企業ページの内容を変える。ここを繋がないと、
 *    ページの `revalidate` の秒数ぶん（3600 にするなら最大1時間）古いまま残る。
 *
 * ⚠️★**`revalidatePath(`/jobs/${jobId}`)` と書かないこと。** 求人詳細も企業と同じで
 *    **slug で配信される**（`/jobs/[id]` のリンクは `job.slug ?? job.id`。実測 2026-09-08:
 *    23件中20件・**公開中の2件は両方**が slug を持つ）。UUID を渡すと当たらない。
 *    2026-09-08 まで `updateJobRoles` がまさにその形だった。
 *
 * ⚠️ 求人が見つからないときも `/jobs`（一覧）だけは落とす。削除直後でも一覧は作り直したい。
 */
export async function revalidateJobPages(
  jobId: string,
  /** ⚠️★**削除のあとに呼ぶときは必ず渡す。** 行が消えていると引けないので、
   *  そのままだと企業ページも `/jobs/<slug>` も落とせず、**消した求人のページが
   *  キャッシュに残り続ける。** 削除前に控えた値をここへ。 */
  known?: { slug?: string | null; companyId?: string | null },
): Promise<void> {
  let jobSlug = known?.slug ?? null;
  let companyId = known?.companyId ?? null;

  if (!jobSlug || !companyId) {
    const { data, error } = await createNoStoreAdminClient()
      .from("ow_jobs")
      .select("slug, company_id")
      .eq("id", jobId)
      .maybeSingle();
    /* ⚠️ 握り潰さない。ここが黙って失敗すると「反映されない」だけが残る。 */
    if (error) console.error("[revalidateJobPages] 求人の解決に失敗", jobId, error.message);
    jobSlug = jobSlug ?? ((data?.slug as string | null) ?? null);
    companyId = companyId ?? ((data?.company_id as string | null) ?? null);
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobSlug ?? jobId}`);

  /* 企業ページ（＋企業一覧）。⚠️ slug 解決はあちらに任せる。 */
  if (companyId) await revalidateCompanyPages(companyId);
}
