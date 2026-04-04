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

  const { job_id } = await request.json();

  const { data: existing } = await supabase
    .from("ow_saved_jobs")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", job_id)
    .single();

  if (existing) {
    await supabase.from("ow_saved_jobs").delete().eq("id", existing.id);
    return NextResponse.json({ saved: false });
  } else {
    await supabase
      .from("ow_saved_jobs")
      .insert({ user_id: user.id, job_id });
    return NextResponse.json({ saved: true });
  }
}
