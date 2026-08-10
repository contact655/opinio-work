import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

/*
 * GET /api/bookmarks?target_type=job — ブックマーク済み target_id の一覧
 *
 * ⚠️ `authenticated` も返す（2026-08-09 追加）。
 *    `ids: []` だけでは「未ログイン」と「ログイン済みだが0件」を区別できず、
 *    呼び出し側が「押したら /auth に飛ばすか」を判断できなかった。
 *    既存の利用者は `ids` しか見ていないので後方互換。
 */
export async function GET(req: Request) {
  const supabase = createClient();

  /* ⚠️ resolveOwUserId は内部で getUser() を呼ぶ。ここで別に呼ぶと往復が1本増えるので、
        auth ユーザーを先に取って ow_users の解決だけを続きでやる。 */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authenticated = !!user;

  if (!user) return NextResponse.json({ ids: [], authenticated: false });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  const owUserId = owUser?.id ?? null;

  // ログイン済みだが ow_users が無い（招待直後など）。ログイン状態は正しく返す
  if (!owUserId) return NextResponse.json({ ids: [], authenticated });

  const url = new URL(req.url);
  const target_type = url.searchParams.get("target_type");
  if (!target_type || !["article", "company", "job", "mentor"].includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ow_bookmarks")
    .select("target_id")
    .eq("user_id", owUserId)
    .eq("target_type", target_type);

  if (error) {
    console.error("[GET /api/bookmarks]", error.message);
    return NextResponse.json({ ids: [], authenticated });
  }
  return NextResponse.json({
    ids: (data ?? []).map((b) => b.target_id as string),
    authenticated,
  });
}

// POST /api/bookmarks — add bookmark (idempotent via upsert)
export async function POST(req: Request) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { target_type?: string; target_id?: string } | null = null;
  try { body = await req.json(); } catch { /* empty */ }

  const { target_type, target_id } = body ?? {};
  if (!target_type || !target_id) {
    return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
  }
  if (!["article", "company", "job", "mentor"].includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(target_id)) {
    return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_bookmarks")
    .upsert(
      { user_id: owUserId, target_type, target_id },
      { onConflict: "user_id,target_type,target_id" }
    );

  if (error) {
    console.error("[POST /api/bookmarks]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ bookmarked: true });
}

// DELETE /api/bookmarks — remove bookmark (idempotent)
export async function DELETE(req: Request) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { target_type?: string; target_id?: string } | null = null;
  try { body = await req.json(); } catch { /* empty */ }

  const { target_type, target_id } = body ?? {};
  if (!target_type || !target_id) {
    return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
  }
  if (!["article", "company", "job", "mentor"].includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(target_id)) {
    return NextResponse.json({ error: "Invalid target_id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_bookmarks")
    .delete()
    .eq("user_id", owUserId)
    .eq("target_type", target_type)
    .eq("target_id", target_id);

  if (error) {
    console.error("[DELETE /api/bookmarks]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ bookmarked: false });
}
