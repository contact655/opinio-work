import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ companies: [] }, { status: 401 });

  const admin = createAdminClient();

  const { data: owUser } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ companies: [] });

  // company_id あり・なし両方取得
  const { data: experiences } = await admin
    .from("ow_experiences")
    .select("company_id, company_text, is_current, ow_companies(id, name)")
    .eq("user_id", owUser.id);

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const companies: { id: string | null; name: string; isCurrent: boolean; isRegistered: boolean }[] = [];

  for (const exp of experiences ?? []) {
    if (exp.company_id && !seenIds.has(exp.company_id)) {
      seenIds.add(exp.company_id);
      const c = (Array.isArray(exp.ow_companies) ? exp.ow_companies[0] : exp.ow_companies) as { id: string; name: string } | null;
      if (c) {
        companies.push({ id: c.id, name: c.name, isCurrent: exp.is_current ?? false, isRegistered: true });
        seenNames.add(c.name);
      }
    } else if (!exp.company_id && exp.company_text && !seenNames.has(exp.company_text)) {
      seenNames.add(exp.company_text);
      companies.push({ id: null, name: exp.company_text, isCurrent: exp.is_current ?? false, isRegistered: false });
    }
  }

  return NextResponse.json({ companies });
}
