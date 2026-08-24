import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseLanguageBody, LANGUAGE_COLS } from "@/lib/api/languageInput";

export const dynamic = "force-dynamic";

/**
 * 言語の更新・削除（2026-08-24）。
 * ⚠️ 検証は POST と**同じ関数**を通す（`lib/api/languageInput.ts`）。
 */

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /api/jobseeker/languages/[id]
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseLanguageBody(body);
  if (input instanceof NextResponse) return input;

  /* ⚠️ `.eq("user_id", owUserId)` を必ず付ける。RLS も同じ条件で守っているが、
        アプリ側でも絞る（0行更新を成功として扱わないため、下で単一行を要求する）。 */
  const { data: updated, error } = await supabase
    .from("ow_user_languages")
    .update(input)
    .eq("id", params.id)
    .eq("user_id", owUserId)
    .select(LANGUAGE_COLS)
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/languages/[id]]", error.code, error.message);
    /* ⚠️ 0行だと `.single()` が PGRST116 を返す。**他人の行か存在しない id** なので
          500 ではなく 404。 */
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/languages/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_languages")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/languages/[id]]", error.code, error.message);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
