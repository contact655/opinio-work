import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve app-level ow_users.id (FK target for ow_saved_companies.user_id)
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { company_id } = await request.json();

  // Check if already saved
  const { data: existing } = await supabase
    .from("ow_saved_companies")
    .select("id")
    .eq("user_id", owUser.id)
    .eq("company_id", company_id)
    .single();

  if (existing) {
    // Remove
    await supabase
      .from("ow_saved_companies")
      .delete()
      .eq("id", existing.id);
    return NextResponse.json({ saved: false });
  } else {
    // Add
    await supabase
      .from("ow_saved_companies")
      .insert({ user_id: owUser.id, company_id });
    return NextResponse.json({ saved: true });
  }
}
