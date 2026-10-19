/**
 * ★件数が増えても黙って切れない読み方（2026-10-19 / 柴さんの指示。営業で利用者・企業が一気に増える前に）。
 *
 * ⚠️★Supabase（PostgREST）は **1回の問い合わせで最大 1,000 行**しか返さない。超えたぶんは**エラーにならずに消える。**
 *    全件を引く問い合わせは `fetchAllRows` で 1,000 行ずつ最後まで引くこと。
 * ⚠️★`.in("id", ids)` に何百もの id を渡すと URL が長くなりすぎて失敗する（400 / 414）。
 *    `inChunks` で分けて引くこと。
 *
 * どちらも**失敗したら止める**（途中までの結果を「全部」として返さない）。呼び出し側はエラーを見ること。
 */

export const PAGE_ROWS = 1000;
/** `.in()` に一度に渡す id の数。uuid 36字 × 150 ≒ 6KB で URL の上限に余裕がある */
export const IN_CHUNK = 150;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * 1,000 行ずつ最後まで引く。`build(from, to)` は毎回**新しい問い合わせ**を組んで `.range(from, to)` を付けて返すこと。
 * ⚠️ 並び順を必ず付けること（付けないとページの境目で行が重複・欠落しうる）。一意の列（id）で最後に並べる
 */
export async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, label: string, maxRows = 50_000): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_ROWS) {
    const { data, error } = await build(from, from + PAGE_ROWS - 1);
    if (error) {
      console.error(`[paging:${label}]`, error.message);
      return { data: out, error: error.message };
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) return { data: out, error: null };
  }
  console.error(`[paging:${label}] ${maxRows} 行で打ち切った`);
  return { data: out, error: `${maxRows} 行を超えた` };
}

/**
 * id の配列を IN_CHUNK 個ずつに分けて引き、結果をつなげる。各かたまりの中も 1,000 行を超えれば続きを引く。
 * `build(ids, from, to)` は毎回新しい問い合わせを組み、`.in(列, ids)` と `.range(from, to)` を付けて返すこと。
 */
export async function inChunks<T>(ids: readonly string[], build: (ids: string[], from: number, to: number) => PromiseLike<Page<T>>, label: string): Promise<{ data: T[]; error: string | null }> {
  const uniq = Array.from(new Set(ids));
  const out: T[] = [];
  for (let i = 0; i < uniq.length; i += IN_CHUNK) {
    const part = uniq.slice(i, i + IN_CHUNK);
    const r = await fetchAllRows((from, to) => build(part, from, to), label);
    if (r.error) return { data: out, error: r.error };
    out.push(...r.data);
  }
  return { data: out, error: null };
}
