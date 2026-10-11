/**
 * ★メッセージ一覧に出す「最後のメッセージの冒頭1行」（2026-10-11）。企業側（/biz/messages）と求職者側
 *   （/mypage/conversations）が同じ関数を使う。
 * ⚠️ 空行と「【…】」だけの見出し行は飛ばす（企業からの最初のメッセージは「【送る理由】」のような見出しで始まるため、
 *    そのままだと見出しだけが並ぶ）。
 */
export function messagePreviewLine(body: string | null | undefined): string | null {
  if (!body) return null;
  const line = body.split("\n").map((l) => l.trim()).find((l) => l && !/^【[^】]*】$/.test(l));
  return line ?? null;
}
