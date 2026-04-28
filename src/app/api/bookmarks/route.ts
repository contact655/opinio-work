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

  const { error } = await supabase
    .from("ow_bookmarks")
    .upsert(
      { user_id: owUserId, target_type, target_id },
      { onConflict: "user_id,target_type,target_id" }
    );

  if (error) {
    console.error("[POST /api/bookmarks]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { error } = await supabase
    .from("ow_bookmarks")
    .delete()
    .eq("user_id", owUserId)
    .eq("target_type", target_type)
    .eq("target_id", target_id);

  if (error) {
    console.error("[DELETE /api/bookmarks]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ bookmarked: false });
}
