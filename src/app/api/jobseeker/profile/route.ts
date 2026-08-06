import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/profile — 求職者プロフィール基本情報の更新
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_VISIBILITY = new Set(["public", "login_only", "private"]);
  const BIRTH_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  const patch: {
    name?: string;
    avatar_color?: string | null;
    cover_color?: string | null;
    about_me?: string | null;
    birth_date?: string | null;
    location?: string | null;
    future_aspirations?: string | null;
    social_links?: Json | null;
    visibility?: string;
    is_open_to_work?: boolean;
    profile_setup_at?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if ("name" in body && typeof body.name === "string") {
    if (body.name.length > 100) return NextResponse.json({ error: "name は100字以内で入力してください" }, { status: 400 });
    patch.name = body.name;
  }
  if ("avatar_color" in body) patch.avatar_color = typeof body.avatar_color === "string" && body.avatar_color.length <= 100 ? body.avatar_color : null;
  if ("cover_color" in body) patch.cover_color = typeof body.cover_color === "string" && body.cover_color.length <= 100 ? body.cover_color : null;
  if ("about_me" in body) {
    if (typeof body.about_me === "string" && body.about_me.length > 2000) return NextResponse.json({ error: "about_me は2000字以内で入力してください" }, { status: 400 });
    patch.about_me = typeof body.about_me === "string" ? body.about_me : null;
  }
  /* ⚠️ 不正値は 400。黙って null にすると「入力したのに消えた」になる（学歴で実際に1ヶ月起きた） */
  if ("birth_date" in body) {
    const bd = body.birth_date;
    if (bd === null || bd === "") patch.birth_date = null;
    else if (typeof bd === "string" && BIRTH_RE.test(bd)) patch.birth_date = bd;
    else return NextResponse.json({ error: "INVALID_BIRTH_DATE", message: "生年月日の形式が正しくありません。" }, { status: 400 });
  }
  if ("location" in body) {
    if (typeof body.location === "string" && body.location.length > 100) return NextResponse.json({ error: "location は100字以内で入力してください" }, { status: 400 });
    patch.location = typeof body.location === "string" ? body.location : null;
  }
  if ("future_aspirations" in body) {
    if (typeof body.future_aspirations === "string" && body.future_aspirations.length > 2000) return NextResponse.json({ error: "future_aspirations は2000字以内で入力してください" }, { status: 400 });
    patch.future_aspirations = typeof body.future_aspirations === "string" ? body.future_aspirations : null;
  }
  if ("social_links" in body) {
    if (JSON.stringify(body.social_links).length > 2000) return NextResponse.json({ error: "social_links が大きすぎます" }, { status: 400 });
    patch.social_links = body.social_links as Json | null;
  }
  /* ⚠️ 公開設定は黙って捨てない。捨てると「非公開にしたのに公開のまま」になる */
  if ("visibility" in body) {
    if (typeof body.visibility !== "string" || !VALID_VISIBILITY.has(body.visibility)) {
      return NextResponse.json({ error: "INVALID_VISIBILITY", message: "公開範囲の値が不正です。" }, { status: 400 });
    }
    patch.visibility = body.visibility;
  }
  if ("is_open_to_work" in body) patch.is_open_to_work = body.is_open_to_work === true;
  if ("profile_setup_at" in body) patch.profile_setup_at = typeof body.profile_setup_at === "string" ? body.profile_setup_at : null;

  const { updated_at: _, ...rest } = patch;
  if (Object.keys(rest).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_users")
    .update(patch)
    .eq("auth_id", user.id);

  if (error) {
    console.error("[PUT /api/jobseeker/profile]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
