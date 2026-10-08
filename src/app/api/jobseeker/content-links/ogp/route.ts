import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { safeFetchText } from "@/lib/net/safeFetch";
import { checkRateLimit } from "@/lib/rateLimit";
import { OGP_RATE_LIMIT } from "@/lib/net/ogpRateLimit";

export const dynamic = "force-dynamic";

function extractMeta(html: string, property: string): string | null {
  // og:xxx or name="xxx"
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

// GET /api/jobseeker/content-links/ogp?url=https://...
/**
 * ★取得は `safeFetchText`（2026-10-09 に差し替え。SSRF 対策）。DNS で解決した IP を検査し、
 *   検査した IP に接続を固定し、リダイレクトは1段ずつ検査する。上限は8秒・512KB。
 * ★回数制限: 利用者ごとに1分あたり20回（超えたら 429。`OGP_RATE_LIMIT`）。
 * ★取得の拒否・失敗はすべて 200 + null（理由は返さない。サーバーのログにだけ残る）。
 *   ⚠️ 2026-10-09 まで内部向けのホストは 400、時間切れは `error: "Timeout"` を返していた。
 *      拒否と失敗で応答を分けると内部の様子を探る手がかりになるので、200 + null に揃えた。
 * ⚠️ URL の形が不正（解釈できない・http/https 以外）は従来どおり 400。
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkRateLimit(req, { ...OGP_RATE_LIMIT, prefix: "content-links-ogp", id: user.id }))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const empty = () => NextResponse.json({ title: null, thumbnail_url: null, description: null });

  try {
    const fetched = await safeFetchText(url);
    if (!fetched.ok) return empty();
    const html = fetched.html;

    const ogTitle = extractMeta(html, "og:title");
    const ogImage = extractMeta(html, "og:image");
    const ogDesc = extractMeta(html, "og:description");
    const twitterTitle = extractMeta(html, "twitter:title");
    const twitterImage = extractMeta(html, "twitter:image");
    const pageTitle = extractTitle(html);

    const title = ogTitle ?? twitterTitle ?? pageTitle ?? null;
    const thumbnail_url = ogImage ?? twitterImage ?? null;
    const description = ogDesc ?? null;

    return NextResponse.json({ title, thumbnail_url, description });
  } catch (err: unknown) {
    /* ⚠️ URL はログに出さない */
    console.error("[content-links/ogp] unexpected:", err instanceof Error ? err.name : "error");
    return empty();
  }
}
