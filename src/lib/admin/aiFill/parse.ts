/**
 * ★運営の「AIで埋める」: 貼り付けた AI の答えから `[key] 値 | 出典URL` を読み取る。**LLM は使わない。**
 *
 * ⚠️★ブラウザの中だけで呼ぶ。貼り付けた文章はサーバーに送らない（送るのは運営が反映を選んだ値と URL だけ）。
 * ⚠️ import を持たない（node --test から直接読むため）。項目の key は引数で受ける。
 *
 * 結果:
 *   found   … 読み取れた項目（unknown: 「不明」と答えた）
 *   missing … 答えの中に行が無かった項目（確認画面で「読み取れませんでした」と出す。黙って捨てない）
 */
export type ParsedFill = { raw: string; url: string | null; unknown: boolean };

const BRACKET_RE = /[\[［【]\s*([a-z_]+)\s*[\]］】]/i;
const URL_RE = /https?:\/\/[^\s|｜)）<>"]+/i;
const UNKNOWN_RE = /^(不明|わからない|分からない|unknown|n\/a|該当情報なし)$/i;

export function parseAiFillAnswer(text: string, keys: readonly string[]): { found: Record<string, ParsedFill>; missing: string[] } {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  const found: Record<string, ParsedFill> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(BRACKET_RE);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!want.has(key) || key in found) continue;
    let rest = line.slice((m.index ?? 0) + m[0].length).replace(/^[\s:：\-–—]+/, "");
    /* 出典 URL。⚠️ 区切りの「|」が崩れていても、行の中の最初の URL を拾う */
    const u = rest.match(URL_RE);
    const url = u ? u[0].replace(/[。、.,]+$/, "") : null;
    if (u) rest = rest.slice(0, u.index).trim();
    rest = rest.replace(/[|｜\s]+$/, "").replace(/^\*+|\*+$/g, "").trim();
    const unknown = rest === "" || UNKNOWN_RE.test(rest);
    found[key] = { raw: unknown ? "" : rest, url, unknown };
  }
  const missing = keys.filter((k) => !(k.toLowerCase() in found));
  return { found, missing };
}

/** 「、」「,」「;」で区切った一覧を分ける。各要素の末尾の（補足）は detail に分ける */
export function splitList(raw: string): { name: string; detail?: string }[] {
  return raw
    .split(/[、,，;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+?)[（(]([^（）()]+)[）)]$/);
      return m ? { name: m[1].trim(), detail: m[2].trim() } : { name: s };
    });
}

/** 事業領域の「該当なし」 */
export function isNoneAnswer(raw: string): boolean {
  return /^(該当なし|なし|無し|none)$/i.test(raw.trim());
}
