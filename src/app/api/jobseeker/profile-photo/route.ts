/**
 * PUT /api/jobseeker/profile-photo
 * カバー写真またはアバター写真のURLをow_usersに保存する。
 * 写真のアップロード自体はクライアントからStorageへ直接行う。
 *
 * Body: { type: "cover" | "avatar", url: string }
 */

import { createClient } from "@/lib/supabase/server";
import { pathFromOwUploadsUrl } from "@/lib/storage/owUploads";
import { NextResponse } from "next/server";

/**
 * 差し替え・削除で不要になった実ファイルを Storage から消す。
 *
 * ⚠️ **session クライアントで消す。** ポリシー（ow_uploads_delete_own_paths）が効くので、
 *    他人のパスは消せない。admin クライアントに寄せると、この関門が無くなる。
 * ⚠️ best-effort。消せなくても本体（DB の URL 更新）は成功させる。ただし**握り潰さない**
 *    （console.error に出す）。ここで 500 を返すと「削除できない」ように見える。
 */
async function removeOldObject(
  supabase: ReturnType<typeof createClient>,
  url: string | null | undefined
): Promise<void> {
  const path = pathFromOwUploadsUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from("ow-uploads").remove([path]);
  if (error) console.error("[profile-photo] storage remove failed:", path, error.message);
}

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
  /* ⚠️ 差し替え前の URL を先に取る。あとで消すため。
        取らないと、差し替えるたびに古いファイルが Storage に残り続ける
        （2026-08-15 時点で孤児 102件 / 13.2MB の一因）。 */
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, avatar_url, cover_photo_url")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const previousUrl = body.type === "cover" ? owUser.cover_photo_url : owUser.avatar_url;

  const { error } = await supabase
    .from("ow_users")
    .update(body.type === "cover" ? { cover_photo_url: body.url } : { avatar_url: body.url })
    .eq("id", owUser.id);

  if (error) {
    console.error("[profile-photo PUT]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 同じファイルを上書き（upsert）した場合は消さない
  if (previousUrl && previousUrl !== body.url) await removeOldObject(supabase, previousUrl);

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

  if (body.type !== "cover" && body.type !== "avatar") {
    return NextResponse.json({ error: "typeはcoverまたはavatarである必要があります" }, { status: 400 });
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, avatar_url, cover_photo_url")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const currentUrl = body.type === "cover" ? owUser.cover_photo_url : owUser.avatar_url;

  const { error } = await supabase
    .from("ow_users")
    .update(body.type === "cover" ? { cover_photo_url: null } : { avatar_url: null })
    .eq("id", owUser.id);

  if (error) {
    console.error("[profile-photo DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ★実ファイルも消す。DB の URL を null にするだけでは、
        **URL を知っている人は未ログインのまま開き続けられる**（バケットが public）。
        2026-08-15 に実測して確認した。 */
  await removeOldObject(supabase, currentUrl);

  return NextResponse.json({ ok: true });
}
