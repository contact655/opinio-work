/**
 * ★企業ストーリーの種類・ひな形・一覧の表示（2026-10-12）。ブラウザとサーバーの両方から読む。
 *
 * ⚠️ ここに DB の読み書きを置かないこと（クライアントの部品が import する）。サーバーは `./server.ts`。
 * ⚠️ 種類の値（value）は ow_company_posts.category に入る値そのもの。**改名しない**（既存の行が読めなくなる）。
 */

export type StoryCategory = "interview" | "culture" | "product" | "event" | "hiring" | "other";

export type StoryCategoryDef = {
  value: StoryCategory;
  label: string;
  /** 表紙写真が無いときのカードの背景。⚠️ 色に意味を持たせない（種類名を必ず一緒に出す）。青灰の濃淡だけで分ける */
  coverBg: string;
  /** 本文が空のときに入れる見出し。null は入れない */
  sections: string[] | null;
};

/** ⚠️ 並びは選択肢の並び。社員インタビューを先頭に置く（いちばん書かれる種類） */
export const STORY_CATEGORIES: readonly StoryCategoryDef[] = [
  { value: "interview", label: "社員インタビュー", coverBg: "#DCE5F2", sections: ["入社のきっかけ", "今の仕事", "この会社の好きなところ", "これから一緒に働く人へ"] },
  { value: "culture", label: "カルチャー", coverBg: "#E4E9F0", sections: ["大切にしていること", "ふだんの働き方", "それが表れた出来事", "こんな人と働きたい"] },
  { value: "product", label: "プロダクト", coverBg: "#D8E0EA", sections: ["何を作っているか", "誰のどんな課題を解いているか", "作っている人たち", "これから"] },
  { value: "event", label: "イベント", coverBg: "#E9ECF1", sections: ["どんな集まりか", "当日の様子", "参加した人の声", "次の予定"] },
  { value: "hiring", label: "採用情報", coverBg: "#E1E7EF", sections: ["募集の背景", "入社後にお任せしたいこと", "チームの様子", "応募を考えている方へ"] },
  { value: "other", label: "その他", coverBg: "#EEF0F3", sections: null },
];

export const DEFAULT_STORY_CATEGORY: StoryCategory = "interview";

export function storyCategoryDef(value: string | null | undefined): StoryCategoryDef {
  return STORY_CATEGORIES.find((c) => c.value === value) ?? STORY_CATEGORIES[STORY_CATEGORIES.length - 1];
}

/** 画面に出す種類名。⚠️ 知らない値は「その他」（英語の値をそのまま出さない） */
export function storyCategoryLabel(value: string | null | undefined): string {
  return storyCategoryDef(value).label;
}

export function isStoryCategory(v: unknown): v is StoryCategory {
  return typeof v === "string" && STORY_CATEGORIES.some((c) => c.value === v);
}

/** 種類のひな形（見出しだけ。本文は書かない）。無ければ "" */
export function storyTemplate(category: string): string {
  const s = storyCategoryDef(category).sections;
  return s ? s.map((h) => `## ${h}\n\n`).join("").trimEnd() + "\n" : "";
}

/**
 * ★種類を選んだときにひな形を入れてよいか。
 *   本文が空のときだけ。⚠️ ひな形に手を付けていない（どれかの種類のひな形そのまま）ときも入れ替える
 *   ——種類を選び直したら見出しも変わるほうが自然で、書いた内容は消えない。
 */
export function canReplaceWithTemplate(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  return STORY_CATEGORIES.some((c) => c.sections && storyTemplate(c.value).trim() === t);
}

/** 本文の最初の1行（記号を落とす）。一覧のカード用 */
export function storyExcerpt(body: string | null | undefined, max = 80): string {
  if (!body) return "";
  for (const raw of body.split("\n")) {
    const line = raw
      .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)/, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (!line) continue;
    /* ⚠️ ひな形の見出しだけの行は飛ばす（「入社のきっかけ」が本文の1行目に見えないように） */
    if (/^\s{0,3}#{1,6}\s/.test(raw)) continue;
    return line.length > max ? line.slice(0, max) + "…" : line;
  }
  return "";
}

/** 「7月27日」。⚠️ 日本時間で出す（サーバーとブラウザで日付がずれないように） */
export function formatStoryDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/**
 * ★一覧のカードの1行（灰色）。
 *   公開中 … 「公開中・7月27日・閲覧 120」（閲覧数が取れないときは閲覧を出さない）
 *   下書き … 「下書き・10月12日更新」
 *   公開中で書きかけがある … 末尾に「・未公開の変更あり」
 */
export function storyMetaLine(s: {
  isPublished: boolean; publishedAt: string | null; updatedAt: string; views: number | null; hasDraft: boolean;
}): string {
  if (!s.isPublished) return `下書き・${formatStoryDate(s.updatedAt)}更新`;
  const parts = ["公開中"];
  const d = formatStoryDate(s.publishedAt);
  if (d) parts.push(d);
  if (s.views !== null) parts.push(`閲覧 ${s.views.toLocaleString("ja-JP")}`);
  if (s.hasDraft) parts.push("未公開の変更あり");
  return parts.join("・");
}

/** 公開に必要な入力。⚠️ 公開の処理（サーバー）と画面のボタンが同じ関数を見る */
export const STORY_TITLE_MAX = 200;
export const STORY_BODY_MAX = 100_000;
export function storyPublishProblems(s: { title: string; body: string }): string[] {
  const out: string[] = [];
  if (!s.title.trim()) out.push("タイトルを入れてください。");
  else if (s.title.trim().length > STORY_TITLE_MAX) out.push(`タイトルは${STORY_TITLE_MAX}字以内にしてください。`);
  const body = s.body.trim();
  if (!body || canReplaceWithTemplate(body)) out.push("本文を書いてください。");
  else if (body.length > STORY_BODY_MAX) out.push("本文が長すぎます。");
  return out;
}

/** 表紙写真に使える形式。⚠️ 大きさの上限はバケットと揃える */
export const STORY_COVER_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const STORY_COVER_MAX_BYTES = 5 * 1024 * 1024;
