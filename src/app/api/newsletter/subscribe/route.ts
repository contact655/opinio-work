import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
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

  const supabase = createClient();
  const { error } = await supabase
    .from("ow_newsletter_subscribers")
    .insert({ email, source: body?.source || "home_inline" });

  // Treat duplicate as success (idempotent subscribe)
  if (error && !error.message?.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
