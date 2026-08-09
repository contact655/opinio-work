/**
 * 死んでいると分かっているロゴ配信元。
 *
 * ⚠️ Clearbit の Logo API は終了しており、logo.clearbit.com は名前解決すらしない
 *    （2026-08-05 実測。同じ環境で example.com は 200）。
 *    それでも ow_companies.logo_url は 85社中76社がこの形式のまま入っている。
 *    DB は書き換えない方針なので、表示側で「値が無いのと同じ」として扱う。
 *
 * ⚠️ 判定はこの関数1つに集約すること。各コンポーネントで
 *    includes("clearbit") と書くと、次に別の配信元が死んだとき全部直すことになる。
 */
const DEAD_LOGO_HOSTS = ["logo.clearbit.com"];

/** その URL が「死んでいると分かっている」ものか。null / 空文字も true を返す */
export function isDeadLogoUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return DEAD_LOGO_HOSTS.some((h) => url.includes(h));
}

/** 表示に使えるロゴ URL。使えないものは null に潰す（呼び出し側は letter フォールバックへ） */
export function usableLogoUrl(url: string | null | undefined): string | null {
  return isDeadLogoUrl(url) ? null : (url as string);
}

const CORP_PREFIX_RE =
  /^(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|合名会社|合資会社|（株）|（有）)\s*/;
const CORP_SUFFIX_RE = /\s*(株式会社|有限会社|合同会社)$/;

/**
 * logo_letter フィールドから表示用の 1〜2 文字ロゴテキストを返す。
 * - rawLetter が 3 文字以内: 正常データとみなしてそのまま大文字化
 * - それ以外（フルネームが誤入力等）: 法人格プレフィックス/サフィックスを除去し、
 *   ASCII 2 文字 or 非 ASCII 1 文字を返す
 */
export function getLogoLetter(
  rawLetter: string | null | undefined,
  name: string
): string {
  const trimmed = rawLetter?.trim() ?? "";

  if (trimmed.length > 0 && trimmed.length <= 3) {
    return trimmed.toUpperCase();
  }

  const source = trimmed || name;
  const stripped = source
    .replace(CORP_PREFIX_RE, "")
    .replace(CORP_SUFFIX_RE, "")
    .trim();
  const base = stripped || source;

  const first2 = base.slice(0, 2);
  return /^[\x21-\x7E]{2}$/.test(first2)
    ? first2.toUpperCase()
    : base.slice(0, 1).toUpperCase();
}

/*
 * ⚠️ ここにあった `getCompanyLogoUrl()` と `getCompanyLogoSources()` は
 *    2026-08-09 に削除した。**呼び出し元が1件も無い死んだコード**だったうえ、
 *    中身が上の `isDeadLogoUrl` を通さずに `logo.clearbit.com` を
 *    組み立てて返していたため、**このファイルを読んだだけでは
 *    「clearbit へのリクエストが今も飛んでいる」と誤読する**状態だった
 *    （実際に同日、その誤読で調査結果を1度間違えて報告した）。
 *
 *    ロゴ URL の解決は `components/common/CompanyLogo.tsx` に1本化してある。
 *    表示可否の判定を足すときは、このファイルの `usableLogoUrl` に寄せること。
 */
