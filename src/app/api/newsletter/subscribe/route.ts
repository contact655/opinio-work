import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit: max 3 requests per IP per 10 minutes
const ipMap = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const email = (body?.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "メールアドレスが正しくありません" }, { status: 400 });
  }

  const VALID_SOURCES = new Set(["home_inline", "footer", "popup", "career_trajectories", "lp"]);
  const source = VALID_SOURCES.has(body?.source) ? (body.source as string) : "home_inline";

  const supabase = createClient();
  const { error } = await supabase
    .from("ow_newsletter_subscribers")
    .insert({ email, source });

  // Treat duplicate as success (idempotent subscribe)
  if (error && !error.message?.includes("duplicate")) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
