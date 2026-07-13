import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inferPageType(path: string): { page_type: string; target_id: string | null } {
  const seg = path.split("/").filter(Boolean);

  if (seg.length === 0) return { page_type: "home", target_id: null };

  const [s0, s1] = seg;

  if (s0 === "jobs" && !s1)       return { page_type: "jobs",        target_id: null };
  if (s0 === "jobs" && s1)        return { page_type: "job",         target_id: UUID_RE.test(s1) ? s1 : null };
  if (s0 === "companies" && !s1)  return { page_type: "companies",   target_id: null };
  if (s0 === "companies" && s1)   return { page_type: "company",     target_id: UUID_RE.test(s1) ? s1 : null };
  if (s0 === "u" && s1)           return { page_type: "profile",     target_id: UUID_RE.test(s1) ? s1 : null };
  if (s0 === "people" && !s1)     return { page_type: "people",      target_id: null };
  if (s0 === "feed" && !s1)       return { page_type: "feed",        target_id: null };
  if (s0 === "business" && !s1)   return { page_type: "business_lp", target_id: null };

  return { page_type: "other", target_id: null };
}

function extractReferrerHost(referrer: string | null, siteHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    const siteHostClean = siteHost.split(":")[0].replace(/^www\./, "");
    return host === siteHostClean ? null : host;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path: rawPath, referrer } = body as { path: unknown; referrer: unknown };

    if (typeof rawPath !== "string" || !rawPath.startsWith("/")) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }

    // クエリ・ハッシュ除去
    const path = rawPath.split("?")[0].split("#")[0].slice(0, 300);

    const siteHost = req.headers.get("host") ?? "";
    const referrerHost = extractReferrerHost(
      typeof referrer === "string" ? referrer : null,
      siteHost
    );

    const { page_type, target_id } = inferPageType(path);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    await supabase.from("ow_page_views").insert({ path, referrer_host: referrerHost, page_type, target_id });
  } catch {
    // 計測失敗でユーザー体験を壊さない
  }

  return NextResponse.json({ ok: true });
}
