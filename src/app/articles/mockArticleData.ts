// ─── Types ────────────────────────────────────────────────────────────────────

export type ArticleType = "employee" | "mentor" | "ceo" | "report";

export type ArticleSubject = {
  initial: string;
  gradient: string;
  name: string;
  role_at_interview: string;
  current_status: string;
  is_mentor: boolean;
  mentor_id?: string;
};

export type QA = { q: string; a: string[] };

export type ThemeItem = {
  icon: string;
  title: string;
  desc: string;
};

export type Chapter = {
  num: string;
  title: string;
  body: string[];
  list?: { key: string; value: string }[];
};

export type Article = {
  slug: string;
  type: ArticleType;
  title: string;
  subtitle: string;
  date: string;
  /* ⚠️★**`number | null`。既定値で埋めないこと**（2026-08-28）。
        直す前は `mapDbArticle` が `?? 5` で埋めており、**読了時間を測っていない記事に
        「5分で読める」と出していた**。表示側は `{article.read_min && …}` で
        ちゃんとガードしているのに、**そのガードが永久に発火しない**状態だった。
     ⚠️ `ow_articles.read_min` の DB 既定 `5` も同日に外してある。片方だけ直すと DB が埋める。 */
  read_min: number | null;
  company_id: string;
  company_name: string;
  company_initial: string;
  company_gradient: string;
  eyecatch_gradient: string;
  subject?: ArticleSubject;
  subjects?: ArticleSubject[];
  editor_note?: string;
  body?: string[];
  quote?: string;
  qa?: QA[];
  editor_outro?: string;
  themes?: ThemeItem[];
  chapters?: Chapter[];
  related_job_ids: string[];
  related_article_slugs: string[];
};

/* ⚠️ `MOCK_ARTICLES`（8件・約700行）は 2026-08-13 に削除した。
 *
 *    `ow_articles` テーブルが未作成だった頃のフォールバックで、
 *    `queries.ts` が DB エラー時にこの配列を返していた。
 *    **テーブルは既にあり（記事16件）、フォールバックは一度も正しく働かない。**
 *    働いたとしても、実在しない記事8件を本物として表示することになる。
 *
 * ⚠️ 型（Article / Chapter / QA など）と表示用の定数
 *    （ARTICLE_TYPES / TYPE_BADGE / TYPE_EYECATCH_ICON）は現役なので残している。
 *    ここに新しくダミーデータを足さないこと。
 */

export const ARTICLE_TYPES: { value: ArticleType | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "employee", label: "社員インタビュー" },
  { value: "mentor", label: "キャリアの軌跡" },
  { value: "ceo", label: "CEO・経営陣" },
  { value: "report", label: "組織レポート" },
];

/**
 * ⚠️ **記事タイプを色で出し分けない（2026-08-23）。**
 *    以前は青／紫／黄／灰の4色だった。凡例が無いので色の意味が伝わらず、
 *    紫と黄色は「使わない」と決めた色でもある（→ lib/utils/chipVariant.ts）。
 *    種別はラベルの文字で伝わる。
 */
export const TYPE_BADGE: Record<ArticleType, { label: string; bg: string; color: string }> = {
  employee: { label: "社員インタビュー", bg: "var(--royal-50)", color: "var(--royal)" },
  mentor:   { label: "キャリアの軌跡",   bg: "var(--royal-50)", color: "var(--royal)" },
  ceo:      { label: "CEO・経営陣",      bg: "var(--royal-50)", color: "var(--royal)" },
  report:   { label: "組織レポート",     bg: "var(--royal-50)", color: "var(--royal)" },
};

export const TYPE_EYECATCH_ICON: Record<ArticleType, string> = {
  employee: "💬",
  mentor:   "🌟",
  ceo:      "👔",
  report:   "📊",
};
