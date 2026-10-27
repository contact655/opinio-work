/**
 * ★フィードの続きの読み込みの手がかり（カーソル）。（時刻, id）の組で比べる（2026-10-28 / 柴さんの指示）。
 *
 * ⚠️ それまでは `created_at < before` の1段だけで、**同じ時刻の投稿がページの境目をまたぐと飛ばされていた**
 *    （「参加しました」は数十件が同じ時刻 2026-06-04 06:16:01.976232 で入っている）。
 *    並び順も `created_at` だけで、同じ時刻の中の順が定まっていなかった。
 * ⚠️ もう1つの読み飛ばし: 画面は「返ってきた件数が上限より少なければ終わり」と見ていたが、API は上限で読んだあとに
 *    見せない投稿を落とすので、途中のページでも件数が減る。→ 続きがあるかは**読んだ行数**で決め、カーソルも
 *    **読んだ最後の行**から作る（見せた最後の投稿ではない）。
 *
 * 純粋な関数だけ（何も import しない。node のテストから読む）。
 *   並び順:   created_at の新しい順 → id の大きい順
 *   次の条件: created_at < c.t、または created_at = c.t かつ id < c.id
 */

export type FeedCursor = { createdAt: string; id: string | null };

const SEP = "~";

/** 読んだ最後の行からカーソルを作る。⚠️ created_at は DB が返した文字列のまま使う（Date に通すとマイクロ秒が落ちる） */
export function encodeFeedCursor(row: { created_at: string; id: string }): string {
  return `${row.created_at}${SEP}${row.id}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * カーソルを読む。`時刻~id` のほか、古い画面が送る時刻だけの `before` も受ける（id なし＝従来の1段の比較）。
 * 形が違えば null（＝カーソルなし。先頭から）。⚠️ PostgREST の条件に入れるので、形を厳しく見る
 */
export function decodeFeedCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) return null;
  const [t, id] = raw.split(SEP);
  if (!t || !TS_RE.test(t)) return null;
  if (id !== undefined && !UUID_RE.test(id)) return null;
  return { createdAt: t, id: id ?? null };
}

/** PostgREST の `.or()` に渡す条件（次のページ）。id が無ければ従来どおり時刻だけで比べる */
export function feedCursorOrFilter(c: FeedCursor): string {
  const t = `"${c.createdAt}"`;
  return c.id
    ? `created_at.lt.${t},and(created_at.eq.${t},id.lt.${c.id})`
    : `created_at.lt.${t}`;
}

/** 読んだ行（並び順どおり）から、次のカーソルと続きの有無を出す。続きの有無は**読んだ行数**で決める */
export function nextFeedPage(rows: { created_at: string; id: string }[], limit: number): { nextCursor: string | null; hasMore: boolean } {
  const last = rows[rows.length - 1];
  return { nextCursor: last ? encodeFeedCursor(last) : null, hasMore: rows.length >= limit };
}

/** ページを並び順で比べる（テスト・確認用）。a が b より前（新しい）なら負 */
export function compareFeedOrder(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** カーソルより後ろ（古い）か。テストで PostgREST の条件と同じ意味を確かめるため */
export function isAfterCursor(row: { created_at: string; id: string }, c: FeedCursor): boolean {
  if (row.created_at < c.createdAt) return true;
  if (row.created_at > c.createdAt) return false;
  return c.id ? row.id < c.id : false;
}
