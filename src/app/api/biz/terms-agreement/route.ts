import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const { companyId, termsType, termsVersion } = body as {
      companyId?: string;
      termsType: string;
      termsVersion: string;
    };

    const admin = createAdminClient();
    await admin.from("ow_terms_agreements").insert({
      user_id: user.id,
      company_id: companyId ?? null,
      terms_type: termsType,
      terms_version: termsVersion,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
