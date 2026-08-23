/**
 * URL を表示用に短くする。
 *
 *   https://www.salesforce.com/jp/ → salesforce.com/jp
 *
 * 企業詳細のサイドバーは値カラムが 172px しかなく、URL をそのまま出すと
 * `https://www.salesforce.co` / `m/jp/` のようにドメインの途中で折り返す。
 *
 * ⚠️ 戻り値は**表示専用**。`href` には元の文字列をそのまま渡すこと。
 * ⚠️ 解析できない文字列は加工せずそのまま返す。
 *    「読めない」ことを、それらしい別の値に置き換えない。
 * ⚠️ 整形は元の文字列から前後を削るだけにしてある。
 *    `new URL().host` を使うと日本語ドメインが punycode（xn--…）に、
 *    パスが percent-encode に化けて、かえって読めなくなる。
 *    `new URL()` は**妥当性の判定にだけ**使う。
 */
export function formatUrlForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  try {
    // プロトコル無しで保存されている値に備える（href 側も同じ補い方をしている）
    new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return raw;
  }

  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/**
 * 表示用 URL を「/」の直後で折り返せる形に分ける。
 *
 *   qualcomm.com/company/locations/japan
 *   → ["qualcomm.com/", "company/", "locations/", "japan"]
 *
 * 呼び出し側で境目に `<wbr>` を置くと、ドメインを割らずにパスの区切りで折り返せる。
 *
 * ⚠️ 78社中2社（2026-08-23 実測）は短縮しても 172px の値カラムに収まらない。
 *    区切りを渡さないと、その2社が単語の途中で改行される。
 */
export function splitUrlForWrap(display: string): string[] {
  // 「/」を残したまま、その直後で切る
  const parts = display.split(/(?<=\/)/);
  return parts.length > 0 ? parts : [display];
}
