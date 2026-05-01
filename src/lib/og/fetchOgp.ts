"use server";

import ogs from "open-graph-scraper";

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type OgpResult =
  | {
      success: true;
      url: string;
      title: string;
      description?: string;
      thumbnailUrl?: string;
      siteName?: string;
      publishedAt?: string; // ISO 8601 or undefined
    }
  | {
      success: false;
      errorCode:
        | "INVALID_URL"
        | "TIMEOUT"
        | "NOT_FOUND"
        | "NO_TITLE"
        | "NETWORK_ERROR"
        | "UNKNOWN";
      message: string;
    };

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractThumbnail(result: Awaited<ReturnType<typeof ogs>>["result"]): string | undefined {
  // ogImage は配列 or undefined
  const ogImg = result.ogImage;
  if (Array.isArray(ogImg) && ogImg.length > 0) {
    return ogImg[0]?.url ?? undefined;
  }
  if (ogImg && typeof ogImg === "object" && !Array.isArray(ogImg)) {
    return (ogImg as { url?: string }).url ?? undefined;
  }

  // Twitter fallback
  const twImg = result.twitterImage;
  if (Array.isArray(twImg) && twImg.length > 0) {
    return twImg[0]?.url ?? undefined;
  }
  if (twImg && typeof twImg === "object" && !Array.isArray(twImg)) {
    return (twImg as { url?: string }).url ?? undefined;
  }

  return undefined;
}

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * 指定 URL の OGP メタデータを取得する Server Action。
 * 外部 HTTP リクエストが発生するため必ず Server 側で実行される。
 */
export async function fetchOgp(url: string): Promise<OgpResult> {
  // 1. URL バリデーション
  if (!url || !isValidUrl(url)) {
    return {
      success: false,
      errorCode: "INVALID_URL",
      message: "有効な URL（http/https）を入力してください。",
    };
  }

  let errorCode: "INVALID_URL" | "TIMEOUT" | "NOT_FOUND" | "NO_TITLE" | "NETWORK_ERROR" | "UNKNOWN" = "UNKNOWN";

  try {
    const { error, result } = await ogs({
      url,
      timeout: 10000, // 10 秒
      fetchOptions: {
        headers: {
          // 一部サイトが bot を拒否するため User-Agent を偽装
          "User-Agent":
            "Mozilla/5.0 (compatible; Opinio-OGP-Bot/1.0; +https://opinio.co.jp)",
        },
      },
    });

    if (error) {
      // ogs のエラーオブジェクトを解析してエラーコードを分類
      const errMsg = (result as { error?: string }).error ?? "";

      if (errMsg.includes("timed out") || errMsg.includes("timeout")) {
        errorCode = "TIMEOUT";
      } else if (
        errMsg.includes("404") ||
        errMsg.includes("not found") ||
        errMsg.includes("ENOTFOUND")
      ) {
        errorCode = "NOT_FOUND";
      } else if (
        errMsg.includes("ECONNREFUSED") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("network")
      ) {
        errorCode = "NETWORK_ERROR";
      }

      return {
        success: false,
        errorCode,
        message: `OGP の取得に失敗しました（${errorCode}）。`,
      };
    }

    // title は必須
    const title = result.ogTitle ?? result.twitterTitle ?? "";
    if (!title) {
      return {
        success: false,
        errorCode: "NO_TITLE",
        message: "ページタイトルを取得できませんでした。手動で入力してください。",
      };
    }

    const description =
      result.ogDescription ?? result.twitterDescription ?? undefined;
    const thumbnailUrl = extractThumbnail(result);
    const siteName = result.ogSiteName ?? undefined;
    const publishedAt = result.articlePublishedTime ?? undefined;
    const canonicalUrl = result.ogUrl ?? url;

    return {
      success: true,
      url: canonicalUrl,
      title,
      description: description || undefined,
      thumbnailUrl: thumbnailUrl || undefined,
      siteName: siteName || undefined,
      publishedAt: publishedAt || undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("timed out") || msg.includes("timeout")) {
      errorCode = "TIMEOUT";
    } else if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      errorCode = "NETWORK_ERROR";
    }

    return {
      success: false,
      errorCode,
      message: `予期しないエラーが発生しました: ${msg}`,
    };
  }
}
