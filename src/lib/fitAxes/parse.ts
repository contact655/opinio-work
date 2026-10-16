/**
 * ★自分の AI の答え（貼り付けた文章）から、軸ごとの数字を読み取る。**LLM は使わない。正規表現だけ。**
 *
 * ⚠️★**この関数はブラウザの中だけで呼ぶ。** 貼り付けた文章はサーバーに送らない（送るのは本人が確認した数字だけ）。
 *    ＝ 文章はデータベースにもサーバーのログにも残りようがない。
 * ⚠️ このファイルは import を持たない（node --test から直接読むため）。軸の key は引数で受ける。
 *
 * 読み取りの規則:
 *   - 行の中に `[key]`（全角の［］【】も可。key の大文字小文字は問わない）があれば、その軸の行
 *   - その後ろの最初の 1〜5 の数字（全角も可）を値にする
 *   - 「わからない」「分からない」「不明」「unknown」が数字より先に出れば「わからない」（値なし）
 *   - 数字のあとの区切り（: ：）の後ろを理由として返す（画面に出すだけ。保存しない）
 *   - 同じ軸が2回出たら最初の1回を使う
 *   - 読み取れなかった軸は結果に入れない（呼び出し側が「未入力」として本人に選ばせる）
 */

export type ParsedAxis = { value: 1 | 2 | 3 | 4 | 5 | null; reason: string | null };

const BRACKET_RE = /[\[［【]\s*([a-z_]+)\s*[\]］】]/i;
const UNKNOWN_RE = /(わからない|分からない|わかりません|分かりません|不明|unknown)/i;

function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function parseFitAxesAnswer(text: string, axisKeys: readonly string[]): Record<string, ParsedAxis> {
  const out: Record<string, ParsedAxis> = {};
  const keys = new Set(axisKeys.map((k) => k.toLowerCase()));
  for (const rawLine of text.split(/\r?\n/)) {
    const line = toHalfWidthDigits(rawLine);
    const m = line.match(BRACKET_RE);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!keys.has(key) || key in out) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length);
    const num = rest.match(/(?<![0-9])([1-5])(?![0-9])/);
    const unk = rest.match(UNKNOWN_RE);
    /* 「わからない」が数字より先に出たら「わからない」。⚠️ 理由の中の数字（「3年」など）を拾わないため、前にある方を採る */
    if (unk && (!num || (unk.index ?? 0) < (num.index ?? 0))) {
      out[key] = { value: null, reason: reasonAfter(rest, (unk.index ?? 0) + unk[0].length) };
      continue;
    }
    if (num) {
      out[key] = { value: Number(num[1]) as 1 | 2 | 3 | 4 | 5, reason: reasonAfter(rest, (num.index ?? 0) + num[0].length) };
    }
  }
  return out;
}

function reasonAfter(rest: string, from: number): string | null {
  const r = rest.slice(from).replace(/^[\s:：\-ー–—、。.）)]+/, "").trim();
  return r ? r.slice(0, 200) : null;
}
