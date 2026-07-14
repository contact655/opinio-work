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

  const { data: experiences } = await admin
    .from("ow_experiences")
    .select("company_id, is_current, ow_companies(id, name)")
    .eq("user_id", owUser.id)
    .not("company_id", "is", null);

  const seen = new Set<string>();
  const companies: { id: string; name: string; isCurrent: boolean }[] = [];
  for (const exp of experiences ?? []) {
    if (exp.company_id && !seen.has(exp.company_id)) {
      seen.add(exp.company_id);
      const c = (Array.isArray(exp.ow_companies) ? exp.ow_companies[0] : exp.ow_companies) as { id: string; name: string } | null;
      if (c) companies.push({ id: c.id, name: c.name, isCurrent: exp.is_current ?? false });
    }
  }

  return NextResponse.json({ companies });
}
