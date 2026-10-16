import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * ★「つながり」として表示してよいか（`ow_profiles.show_as_connection`。2026-10-16 / フェーズ3）。
 * ⚠️ `ow_profiles.user_id` は **auth 空間**。`user.id` をそのまま使う（ow_users.id ではない）。
 * ⚠️ 行が無い人は DB の既定（false）を返す。⚠️ 不正値は 400（黙って false に倒さない）。
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("ow_profiles").select("show_as_connection").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("[GET /api/jobseeker/connection-setting]", error.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ show_as_connection: data?.show_as_connection === true });
}

export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.show_as_connection !== "boolean") {
    return NextResponse.json({ error: "show_as_connection は true / false のみ" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: existing, error: exErr } = await admin.from("ow_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (exErr) {
    console.error("[PUT /api/jobseeker/connection-setting] lookup", exErr.message);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  /* ⚠️ `.select()` を付けない（ow_profiles の返却列の権限で 403 になりうるため。email-settings と同じ） */
  const { error } = existing
    ? await admin.from("ow_profiles").update({ show_as_connection: body.show_as_connection, updated_at: new Date().toISOString() }).eq("user_id", user.id)
    : await admin.from("ow_profiles").insert({ user_id: user.id, show_as_connection: body.show_as_connection });
  if (error) {
    console.error("[PUT /api/jobseeker/connection-setting]", error.message);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, show_as_connection: body.show_as_connection });
}
