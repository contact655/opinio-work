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

  // Check duplicate
  const { data: existing } = await supabase
    .from("ow_applications")
    .select("id")
    .eq("candidate_id", user.id)
    .eq("job_id", job_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already applied" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("ow_applications")
    .insert({
      candidate_id: user.id,
      job_id,
      status: "applied",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data });
}
