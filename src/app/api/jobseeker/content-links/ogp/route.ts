import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // SSRF guard: only allow http/https to public hosts
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    const h = parsed.hostname.toLowerCase();
    if (
      h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "[::1]" ||
      h.startsWith("192.168.") || h.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) ||
      h.endsWith(".local") || h.endsWith(".internal") ||
      h === "169.254.169.254"
    ) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OPINIOBot/1.0; +https://opinio.jp)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });
    clearTimeout(timeout);

    // リダイレクトは追わない（SSRF via open redirect 防止）
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json({ title: null, thumbnail_url: null, description: null });
    }
    if (!res.ok) {
      return NextResponse.json({ title: null, thumbnail_url: null, description: null });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ title: null, thumbnail_url: null, description: null });
    }

    // Read only first 50KB to keep it fast
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ title: null, thumbnail_url: null, description: null });

    let html = "";
    let totalBytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: !done });
      totalBytes += value?.length ?? 0;
      if (totalBytes > 50_000) break;
    }
    reader.cancel().catch(() => {});

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
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Timeout", title: null, thumbnail_url: null, description: null });
    }
    console.error("[OGP fetch error]", err);
    return NextResponse.json({ title: null, thumbnail_url: null, description: null });
  }
}
