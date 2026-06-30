import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ogs from "open-graph-scraper";

export const dynamic = "force-dynamic";

/**
 * SSRF 対策: プライベート IP / 危険スキーマを拒否する
 *
 * - http: / https: のみ許可
 * - localhost, 127.0.0.1, プライベート IP レンジ等を拒否
 * - file://, data:, javascript: 等の危険スキーマを拒否
 */
function isUrlSafe(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  // スキーマ制限: http / https のみ
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  // ホスト名による SSRF 対策
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return false;
  }

  return true;
}

/**
 * POST /api/jobseeker/ogp-fetch
 *
 * URL を受け取り OGP 情報（og_image_url / og_title）を返す。
 *
 * - 認証必須（未認証の場合は 401）
 * - URL バリデーション失敗は 400
 * - OGP 取得失敗・タイムアウト等はすべて 200 + null で返す（段階6-5 判断点 2: 案 α）
 * - 画像は URL のみ返却、Storage 保存なし（段階6-5 判断点 3: 案 i）
 */
export async function POST(req: NextRequest) {
  // 1. 認証チェック（SSRF 悪用防止: スクレイピング API を未認証公開しない）
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. リクエスト body 取得
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body?.url;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // 3. URL バリデーション（SSRF 対策含む）
  if (!isUrlSafe(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // 4. OGP 取得（失敗はすべて null で返す: 判断点 2 整合）
  try {
    const ogsResult = await ogs({
      url,
      timeout: 5, // 5 秒（open-graph-scraper v6 は秒単位）
      fetchOptions: {
        redirect: "manual" as RequestRedirect,
        headers: {
          "User-Agent": "OPINIOBot/1.0",
        },
      },
    });

    if (ogsResult.error) {
      return NextResponse.json(
        { og_image_url: null, og_title: null },
        { status: 200 },
      );
    }

    const { result } = ogsResult;

    // ogImage は ImageObject[]（各要素に url: string が存在する）
    let ogImageUrl: string | null = null;
    if (Array.isArray(result.ogImage) && result.ogImage.length > 0) {
      ogImageUrl = result.ogImage[0].url ?? null;
    }

    // twitterImage を og:image のフォールバックとして使用
    if (!ogImageUrl && Array.isArray(result.twitterImage) && result.twitterImage.length > 0) {
      ogImageUrl = result.twitterImage[0].url ?? null;
    }

    // OGP メタデータ内の画像 URL も安全性を確認（javascript: 等を排除）
    if (ogImageUrl && !isUrlSafe(ogImageUrl)) ogImageUrl = null;

    return NextResponse.json(
      {
        og_image_url: ogImageUrl,
        og_title: result.ogTitle ?? result.twitterTitle ?? null,
      },
      { status: 200 },
    );
  } catch {
    // 想定外エラー（ネットワーク断・パース失敗等）も null で返す（判断点 2）
    return NextResponse.json(
      { og_image_url: null, og_title: null },
      { status: 200 },
    );
  }
}
