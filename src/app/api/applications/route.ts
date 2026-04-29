import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/applications — 求人応募
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { job_id, phone, message } = body as {
    job_id?: string;
    phone?: string;
    message?: string;
  };

  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }

  // 重複応募チェック（race condition 軽減: UI 側でも button disable）
  const { data: existing } = await supabase
    .from("ow_job_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", job_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_applied", id: existing.id }, { status: 409 });
  }

  // name + email を auth.users から取得
  const name: string = (user.user_metadata?.name as string | undefined) ?? user.email ?? "名前未設定";
  const email: string = user.email ?? "";

  const { data: inserted, error } = await supabase
    .from("ow_job_applications")
    .insert({
      job_id,
      user_id: user.id,
      name,
      email,
      phone: phone ?? null,
      message: message ?? null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    // 23505 = unique_violation: race condition が UNIQUE 制約を突き抜けた場合
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_applied" }, { status: 409 });
    }
    console.error("[POST /api/applications]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, status: inserted.status }, { status: 201 });
}
