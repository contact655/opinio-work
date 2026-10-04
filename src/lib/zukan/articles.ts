import fs from "fs";
import path from "path";
import { cache } from "react";
import matter from "gray-matter";
import { isZukanAuthorKey, type ZukanAuthorKey } from "./authors";

/**
 * 社長図鑑（/zukan）の記事を `content/zukan/*.md` から読む。**DB は使わない。**
 *
 * ★**「公開してよいか」の判定はこのファイルの `isPublished()` 1箇所だけ。**
 *   一覧・詳細・sitemap・企業ページの「社長図鑑に掲載されています」はすべて
 *   `getPublishedZukanArticles()` を通る。**呼び出し側で `status` を見ないこと**
 *   （割れると「一覧には無いのに企業ページからは辿れる」になる）。
 *
 * ⚠️★**本番で実行時にもこのフォルダを読む**（企業ページは ISR、sitemap は1時間ごと）。
 *    Vercel に同梱されるよう `next.config.mjs` の `outputFileTracingIncludes` に
 *    `content/zukan/**` を入れてある。**外すと企業ページのカードが静かに消える。**
 *
 * ⚠️ 不正な記事は**ログを出して読み飛ばす**（例外にしない）。例外にすると、
 *    1本の書き間違いで企業ページ（ISR）が 500 になる。ビルドのログに必ず出るので見ること。
 */

export const ZUKAN_DIR = path.join(process.cwd(), "content/zukan");

export type ZukanStatus = "draft" | "published";

export interface ZukanArticle {
  slug: string;
  title: string;
  /** 120字程度。meta description と OGP に使う */
  description: string;
  ceoName: string;
  companyName: string;
  /** OPINIO の企業 ID（`ow_companies.id`＝uuid）。紐づく場合だけ */
  companyId: string | null;
  /** 事業を1行で */
  business: string | null;
  foundedYear: number | null;
  /** 社員数（「約50名」のような自由記述でよい） */
  employees: string | null;
  /** この社長を一言で */
  oneLiner: string | null;
  author: ZukanAuthorKey;
  /** YYYY-MM-DD */
  publishedAt: string;
  /** YYYY-MM-DD。無ければ publishedAt と同じ */
  updatedAt: string;
  /** `/zukan/...` の相対パス（public/ 配下）か絶対URL */
  heroImage: string | null;
  /** SNS 用。無ければ heroImage を使う */
  ogImage: string | null;
  status: ZukanStatus;
  /** 本文（Markdown。見出しは h2 から） */
  body: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** YAML は `2026-10-01` を Date に変えるので、文字列に戻す */
function toDateString(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return null;
}

/** 空文字・空白だけ・null は「値が無い」。既定値で埋めない */
function optString(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseFile(fileName: string): ZukanArticle | null {
  const fileSlug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(ZUKAN_DIR, fileName), "utf-8");
  const { data, content } = matter(raw);
  const errors: string[] = [];

  const slug = optString(data.slug);
  if (!slug) errors.push("slug が無い");
  else if (slug !== fileSlug) errors.push(`slug（${slug}）がファイル名（${fileSlug}）と違う`);
  else if (!SLUG_RE.test(slug)) errors.push(`slug は半角英小文字・数字・ハイフンだけ（${slug}）`);

  const title = optString(data.title);
  const description = optString(data.description);
  const ceoName = optString(data.ceoName);
  const companyName = optString(data.companyName);
  if (!title) errors.push("title が無い");
  if (!description) errors.push("description が無い");
  if (!ceoName) errors.push("ceoName が無い");
  if (!companyName) errors.push("companyName が無い");

  const status = data.status;
  if (status !== "draft" && status !== "published") errors.push(`status は draft か published（${String(status)}）`);

  if (!isZukanAuthorKey(data.author)) errors.push(`author が lib/zukan/authors.ts に無い（${String(data.author)}）`);

  const publishedAt = toDateString(data.publishedAt);
  if (!publishedAt) errors.push("publishedAt は YYYY-MM-DD");
  const updatedAtRaw = data.updatedAt == null || data.updatedAt === "" ? null : toDateString(data.updatedAt);
  if (data.updatedAt != null && data.updatedAt !== "" && !updatedAtRaw) errors.push("updatedAt は YYYY-MM-DD");

  const companyId = optString(data.companyId);
  if (companyId && !UUID_RE.test(companyId)) errors.push(`companyId は ow_companies.id（uuid）を入れる（${companyId}）`);

  let foundedYear: number | null = null;
  if (data.foundedYear != null && data.foundedYear !== "") {
    const n = Number(data.foundedYear);
    if (Number.isInteger(n) && n >= 1800 && n <= 2100) foundedYear = n;
    else errors.push(`foundedYear は西暦の数字（${String(data.foundedYear)}）`);
  }

  if (errors.length > 0) {
    console.error(`[zukan] content/zukan/${fileName} を読み飛ばした: ${errors.join(" / ")}`);
    return null;
  }

  return {
    slug: slug!,
    title: title!,
    description: description!,
    ceoName: ceoName!,
    companyName: companyName!,
    companyId,
    business: optString(data.business),
    foundedYear,
    employees: optString(data.employees),
    oneLiner: optString(data.oneLiner),
    author: data.author as ZukanAuthorKey,
    publishedAt: publishedAt!,
    updatedAt: updatedAtRaw ?? publishedAt!,
    heroImage: optString(data.heroImage),
    ogImage: optString(data.ogImage),
    status: status as ZukanStatus,
    body: content.trim(),
  };
}

/** draft も含む全件。⚠️ 公開面からは呼ばないこと（`/dev/preview` 用） */
export const getAllZukanArticles = cache((): ZukanArticle[] => {
  let files: string[];
  try {
    files = fs.readdirSync(ZUKAN_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch (e) {
    /* ⚠️ フォルダが同梱されていないとここに来る（outputFileTracingIncludes を確認）。
          0件に倒すが、ログは必ず出す */
    console.error("[zukan] content/zukan を読めなかった:", (e as Error).message);
    return [];
  }
  const articles = files.map(parseFile).filter((a): a is ZukanArticle => a !== null);
  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
});

function isPublished(a: ZukanArticle): boolean {
  return a.status === "published";
}

/** 公開記事だけ。新しい順 */
export function getPublishedZukanArticles(): ZukanArticle[] {
  return getAllZukanArticles().filter(isPublished);
}

/** 公開記事を1件。draft や存在しない slug は null（→ 404） */
export function getPublishedZukanArticle(slug: string): ZukanArticle | null {
  return getPublishedZukanArticles().find((a) => a.slug === slug) ?? null;
}

/** その企業（`ow_companies.id`）に紐づく公開記事。新しい順 */
export function getPublishedZukanArticlesByCompanyId(companyId: string): ZukanArticle[] {
  return getPublishedZukanArticles().filter((a) => a.companyId === companyId);
}

/** 画面に出す日付（2026年10月1日） */
export function formatZukanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** og:image に使う画像。ogImage → heroImage の順 */
export function zukanOgImage(a: ZukanArticle): string | null {
  return a.ogImage ?? a.heroImage;
}
