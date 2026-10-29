/**
 * ★求人の本文（企業が素のテキスト欄に書いた文）を、markdown として描く前に整える（2026-10-29 / 柴さんの指示）。
 *
 * 何も import しない純粋な関数（`npm test` が直接読む）。呼ぶのは components/common/Markdown の `jobBody` だけ。
 * ⚠️ 文の中身は変えない。見せ方のための印（見出し・箇条書き・強制改行）を足すだけ。
 *
 * 1. 見出し: 行の頭が「■ ◆ □ ● ◇」か、行全体が「【…】」で、20字以内の行を見出し（`##`）にする。
 *    COIN の求人は「■ このポジションについて」「■ 業務内容」などの大項目で書かれているのに、
 *    本文と同じ大きさ・太さに埋もれていた。
 *    ⚠️ 記号のあとに長い文が続く行（「■受託案件の運用に関する…」）は見出しにしない。記号を箇条書きの印に使う書き方もあるため。
 * 2. 箇条書き: 「・」で始まる行を markdown の箇条書き（`- `）にする。描く側が印を「・」にして字下げをそろえる
 *    （折り返した2行目が行頭まで戻っていた）。頭に字下げ（全角スペース）がある次の行は同じ項目の続きとし、
 *    字下げは落とす。字下げの無い次の行は箇条書きを終える。
 * 3. 改行: 残りの改行1つを強制改行（行末の半角スペース2つ）にする。空行（段落の区切り）はそのまま。
 */

const HEADING_MAX_CHARS = 20;
const HEADING_MARK = /^[■◆□●◇]/;
const BRACKET_LINE = /^【[^】]+】$/;

export function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > HEADING_MAX_CHARS) return false;
  if (BRACKET_LINE.test(t)) return true;
  // 記号だけの行は見出しにしない
  return HEADING_MARK.test(t) && t.replace(HEADING_MARK, "").trim().length > 0;
}

export function formatJobBody(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      out.push("");
      inList = false;
      continue;
    }
    if (isHeadingLine(line)) {
      // 見出しの前後は空行で区切る（前の段落や箇条書きに続けて読まれないように）
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(`## ${line.trim()}`);
      out.push("");
      inList = false;
      continue;
    }
    if (/^\s*・/.test(line)) {
      out.push(`- ${line.trim().replace(/^・\s*/, "")}`);
      inList = true;
      continue;
    }
    if (inList && /^[　 ]/.test(line)) {
      // 箇条書きの続きの行（頭に字下げがある）。字下げは落として、同じ項目の中で改行する
      out.push(line.replace(/^[　 ]+/, ""));
      continue;
    }
    if (inList) {
      // 字下げの無い普通の文は箇条書きを終える（空行を挟まないと最後の項目に取り込まれる）
      out.push("");
      inList = false;
    }
    out.push(line);
  }
  // 改行1つを強制改行に（空行・見出しの行はそのまま）
  return out
    .map((l, i) => {
      const next = out[i + 1];
      if (l === "" || l.startsWith("## ") || next === undefined || next === "") return l;
      return `${l}  `;
    })
    .join("\n");
}
