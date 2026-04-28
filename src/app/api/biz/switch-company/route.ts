import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let companyId: string;
  try {
    const body = await req.json();
    companyId = body.companyId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!companyId || typeof companyId !== "string") {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  // Verify active membership (no cookie override — always fetch fresh memberships)
  const ctx = await getCompanyContext(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "No company memberships" }, { status: 403 });

  const isMember = ctx.allMemberships.some((m) => m.companyId === companyId);
  if (!isMember) return NextResponse.json({ error: "Not a member of this company" }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("biz_current_company_id", companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
