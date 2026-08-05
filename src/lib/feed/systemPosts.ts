/**
 * システム投稿（company_joined / job_posted / article_published）の生成。
 *
 * ⚠️ 本文のフォーマットと ref_* の埋め方はここだけに置く。
 *    公開APIと突合スクリプト（scripts/backfill-feed-posts.mjs）の両方がここを通る。
 *    文面を各所で書くと、同じ出来事の投稿が経路によって違う文になる。
 *
 * ── 生成経路は2つある ──────────────────────────────────────────────────────
 *   ① アプリの公開操作（/biz/company・/biz/jobs/[id]・/admin/articles）
 *   ② migration / SQL で直接公開したあとの突合スクリプト
 * ②が要るのは、SQL で `is_published = true` にしても①が走らないため。
 * 実運用は②が主で、2026-08-05 時点で①は本番実行実績ゼロ
 * （ow_companies.published_at が85社すべて NULL であることが根拠）。
 *
 * ⚠️ 重複防止は部分UNIQUEインデックス3本に任せている
 *    （idx_ow_posts_unique_company / _job / _article）。
 *    23505 は「既にある」なので握りつぶす。これで何度実行しても冪等。
 */

export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

/** 表示に使う社名。brand_name があればそちら（backfill もこの規則で本文を作っている） */
export function displayCompanyName(co: { name?: string | null; brand_name?: string | null }): string {
  return co.brand_name ?? co.name ?? "";
}

export function companyJoinedContent(co: { name?: string | null; brand_name?: string | null; tagline?: string | null }): string {
  const taglinePart = co.tagline ? ` ${co.tagline}` : "";
  return `${displayCompanyName(co)}がOPINIOに掲載されました。${taglinePart}`;
}

export function jobPostedContent(
  co: { name?: string | null; brand_name?: string | null },
  job: { title?: string | null },
): string {
  return `${displayCompanyName(co)}が「${job.title ?? "—"}」の募集を開始しました。`;
}

export function articlePublishedContent(article: { title?: string | null }): string {
  return `【取材記事】${article.title ?? ""}`;
}

/** ow_posts に渡す行。created_at は呼び出し側で決める（突合では公開日に合わせる） */
export type SystemPostRow = {
  user_id: string;
  post_type: "company_joined" | "job_posted" | "article_published";
  content: string;
  ref_company_id?: string;
  ref_job_id?: string;
  ref_article_id?: string;
  created_at?: string;
};

export function buildCompanyJoinedRow(
  companyId: string,
  co: { name?: string | null; brand_name?: string | null; tagline?: string | null },
  createdAt?: string,
): SystemPostRow {
  return {
    user_id: SYSTEM_USER_ID,
    post_type: "company_joined",
    ref_company_id: companyId,
    content: companyJoinedContent(co),
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

export function buildJobPostedRow(
  jobId: string,
  companyId: string,
  co: { name?: string | null; brand_name?: string | null },
  job: { title?: string | null },
  createdAt?: string,
): SystemPostRow {
  return {
    user_id: SYSTEM_USER_ID,
    post_type: "job_posted",
    ref_job_id: jobId,
    ref_company_id: companyId,
    content: jobPostedContent(co, job),
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

export function buildArticlePublishedRow(
  articleId: string,
  article: { title?: string | null },
  createdAt?: string,
): SystemPostRow {
  return {
    user_id: SYSTEM_USER_ID,
    post_type: "article_published",
    ref_article_id: articleId,
    content: articlePublishedContent(article),
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}
