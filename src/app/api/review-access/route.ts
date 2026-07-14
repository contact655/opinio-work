import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ hasAccess: false, expiresAt: null, gateEnabled: false });
  }

  const admin = createAdminClient();

  const { data: owUser } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) {
    return NextResponse.json({ hasAccess: false, expiresAt: null, gateEnabled: false });
  }

  const [{ data: settingRow }, { data: accessRow }] = await Promise.all([
    admin.from("ow_settings").select("value").eq("key", "review_gate_enabled").maybeSingle(),
    admin
      .from("ow_review_access")
      .select("expires_at")
      .eq("user_id", owUser.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
  ]);

  return NextResponse.json({
    hasAccess: !!accessRow,
    expiresAt: accessRow?.expires_at ?? null,
    gateEnabled: settingRow?.value === "true",
  });
}
