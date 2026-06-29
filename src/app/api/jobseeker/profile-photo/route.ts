/**
 * PUT /api/jobseeker/profile-photo
 * カバー写真またはアバター写真のURLをow_usersに保存する。
 * 写真のアップロード自体はクライアントからStorageへ直接行う。
 *
 * Body: { type: "cover" | "avatar", url: string }
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type: "cover" | "avatar"; url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || !body.url) {
    return NextResponse.json({ error: "type and url are required" }, { status: 400 });
  }
  if (body.type !== "cover" && body.type !== "avatar") {
    return NextResponse.json({ error: "type must be cover or avatar" }, { status: 400 });
  }
  // URL検証: https のみ許可、長さ上限
  try {
    const parsed = new URL(body.url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "https URL only" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (body.url.length > 2048) {
    return NextResponse.json({ error: "URL too long" }, { status: 400 });
  }

  // ow_users.id を auth_id から解決
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const column = body.type === "cover" ? "cover_photo_url" : "avatar_url";

  const { error } = await supabase
    .from("ow_users")
    .update({ [column]: body.url })
    .eq("id", owUser.id);

  if (error) {
    console.error("[profile-photo PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/jobseeker/profile-photo
 * カバー写真またはアバター写真のURLをクリアする。
 *
 * Body: { type: "cover" | "avatar" }
 */
export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type: "cover" | "avatar" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const column = body.type === "cover" ? "cover_photo_url" : "avatar_url";

  const { error } = await supabase
    .from("ow_users")
    .update({ [column]: null })
    .eq("id", owUser.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
