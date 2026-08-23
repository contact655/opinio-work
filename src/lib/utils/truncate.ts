/**
 * 上限の手前にある区切りまで戻して切り詰める。
 *
 *   truncateAtBoundary("ネスレ日本・JR東日本・HP…", 80)
 *   → 「ネスレ日本・JR東日本・…」（固有名詞の途中では切らない）
 *
 * 単純な `slice(0, n)` は固有名詞やアルファベット語の途中で切れる
 * （「ネスレ日本・JR東日本・H…」）ので、直近の区切りまで戻して切る。
 *
 * ⚠️ 戻りすぎると本文が短くなりすぎるので、上限の 70% より手前までしか
 *    戻れないときは上限の位置でそのまま切る。
 * ⚠️ 区切りは「その直後」で切る。「・」や「、」を残したまま次の語に入らない。
 */
const BOUNDARIES = ["。", "、", "・", "，", "．", "　", " ", "\n"];

export function truncateAtBoundary(text: string, limit: number, ellipsis = "…"): string {
  if (limit <= 0) return ellipsis;
  if (text.length <= limit) return text;

  const head = text.slice(0, limit);

  // 区切りの「直後」を切り位置の候補にする
  let cut = 0;
  for (const d of BOUNDARIES) {
    const i = head.lastIndexOf(d);
    if (i >= 0 && i + d.length > cut) cut = i + d.length;
  }

  const floor = Math.floor(limit * 0.7);
  const end = cut >= floor ? cut : limit;

  // 区切りが空白だったときに末尾へ空白＋… が並ばないようにする
  return text.slice(0, end).replace(/\s+$/, "") + ellipsis;
}
