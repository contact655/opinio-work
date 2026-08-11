/**
 * フィード投稿が「この閲覧者に見えるか」の判定。
 *
 * ⚠️ 判定はこの関数1つに集約する。以前は同じ if 文が
 *    feed/(list)/page.tsx ・ api/jobseeker/posts ・ feed/[postId] に3つあり、
 *    is_system の例外がパーマリンクだけ抜けていて170件が404になっていた（f34ba43d）。
 *
 * ── 軸が2つあることに注意 ──────────────────────────────────────────────────
 *   ow_posts.visibility   … 投稿ごとの公開範囲（'public' | 'login_only'）
 *   ow_users.visibility   … 投稿者のプロフィール公開範囲（'public' | 'login_only' | 'private'）
 *
 * 別物として扱う。プロフィール（経歴・年収）を隠す意思と、投稿を読まれたい意思は違う。
 *
 * ── 優先順位 ────────────────────────────────────────────────────────────────
 *   1. 投稿者が is_system            → 常に表示（OPINIO 名義のシステム投稿）
 *   2. 投稿者が private              → 常に非表示（投稿が public でも出さない）
 *   3. 投稿が public                 → 未ログインにも表示（投稿者の login_only より優先）
 *   4. それ以外（投稿が login_only） → 投稿者の visibility に従う
 */

/**
 * 「求人を公開しました」の投稿が、まだ有効か。
 *
 * ⚠️ **求人の掲載を下ろしたら、その告知も一緒に消えること。**
 *    残すと「公開しました」と書かれたカードから 404 に落ちる
 *    （`getJobById` は published / active しか返さない）。
 *
 * ⚠️ 判定を各画面に散らかさないこと。フィード一覧・追い読み API・
 *    パーマリンク・企業ページの活動欄の4箇所が同じ埋め込みを使っている。
 *
 * 2026-08-11: 出典の無い求人13件を draft に落とした際、この判定が無いと
 * 13枚の死にカードがフィードに残る状態だった。
 */
export function isJobPostAlive(post: {
  post_type?: string | null;
  ref_job?: { status?: string | null } | null;
}): boolean {
  if (post.post_type !== "job_posted") return true;
  const status = post.ref_job?.status;
  return status === "published" || status === "active";
}

export type PostVisibilityInput = {
  /** ow_posts.visibility */
  postVisibility: string | null | undefined;
  /** 投稿者の ow_users */
  author: { visibility?: string | null; is_system?: boolean | null } | null | undefined;
};

export function isPostVisibleTo(
  { postVisibility, author }: PostVisibilityInput,
  isLoggedIn: boolean,
): boolean {
  // 1. システム投稿は素通し。システムユーザーは visibility='private' なので、
  //    この例外が無いと170件すべてが消える。
  if (author?.is_system) return true;

  // 2. 投稿者が private なら投稿の設定に関わらず出さない。
  //    「本人を出さない」意思のほうが強い。
  if (author?.visibility === "private") return false;

  // 3. 投稿を全体公開にしている場合は、投稿者が login_only でも未ログインに出す。
  //    本人が投稿単位で明示的に開いた範囲なので、プロフィールの設定より優先する。
  if (postVisibility === "public") return true;

  // 4. 投稿が login_only。従来どおり投稿者のプロフィール設定に従う。
  if (author?.visibility === "login_only" && !isLoggedIn) return false;

  return true;
}
