export type ContentType = "article" | "video" | "audio" | "social" | "event" | "other";

/**
 * URL のドメインからコンテンツ種別を推測する。
 * ユーザーが上書き可能なサジェスト値として使う。
 */
export function inferTypeFromUrl(url: string): ContentType {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }

  // 動画プラットフォーム
  if (
    hostname.includes("youtube.com") ||
    hostname.includes("youtu.be") ||
    hostname.includes("vimeo.com") ||
    hostname.includes("nicovideo.jp")
  ) return "video";

  // 音声プラットフォーム
  if (
    hostname.includes("voicy.jp") ||
    hostname.includes("spotify.com") ||
    hostname.includes("anchor.fm") ||
    hostname.includes("podcast")
  ) return "audio";

  // SNS
  if (
    hostname.includes("twitter.com") ||
    hostname === "x.com" ||
    hostname.endsWith(".x.com") ||
    hostname.includes("linkedin.com") ||
    hostname.includes("instagram.com") ||
    hostname.includes("facebook.com") ||
    hostname.includes("threads.net")
  ) return "social";

  // イベントプラットフォーム
  if (
    hostname.includes("connpass.com") ||
    hostname.includes("techplay.jp") ||
    hostname.includes("doorkeeper.jp") ||
    hostname.includes("peatix.com") ||
    hostname.includes("eventbrite.com")
  ) return "event";

  // デフォルト: 記事
  // note.com, prtimes.jp, hatena, qiita, zenn, medium 等はすべて article
  return "article";
}
