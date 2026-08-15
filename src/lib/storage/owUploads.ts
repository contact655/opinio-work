/**
 * `ow-uploads` の publicUrl ↔ パスの相互変換。
 *
 * ⚠️ **URL から素朴に文字列を切り出さない。** バケット名が別の場所に現れる URL
 *    （例: クエリに `ow-uploads` を含む外部URL）を掴むと、他人のパスを組み立てられる。
 *    ここでは「自分のオリジンの `/storage/v1/object/public/ow-uploads/` で始まる」ことまで見る。
 */

const PREFIX = "/storage/v1/object/public/ow-uploads/";

/**
 * `ow-uploads` の公開URLからバケット内パスを取り出す。
 * 形が違うものは `null`（外部URL・別バケット・相対パスなど）。
 */
export function pathFromOwUploadsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!parsed.pathname.startsWith(PREFIX)) return null;

  const path = decodeURIComponent(parsed.pathname.slice(PREFIX.length));
  if (!path) return null;
  /* ⚠️ `..` を含むパスは扱わない。Storage 側で解決されることは無いが、
        ログや突き合わせで別のファイルに見えるものを通さない。 */
  if (path.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return null;
  return path;
}
