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

  const { company_id } = await request.json();

  // Check if already saved
  const { data: existing } = await supabase
    .from("ow_saved_companies")
    .select("id")
    .eq("user_id", user.id)
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
      .insert({ user_id: user.id, company_id });
    return NextResponse.json({ saved: true });
  }
}
