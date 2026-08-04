import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ユーザーのフォロー / 解除。
 * 企業フォロー（/api/jobseeker/companies/[id]/follow）と同じ形にしてある。
 *
 * params.id は ow_users.id（auth.users.id ではない）。
 * /u/[id] の URL がそうなっているのに合わせる。
 */
async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string,
): Promise<string | null> {
  const { data } = await supabase.from("ow_users").select("id").eq("auth_id", authUid).maybeSingle();
  return data?.id ?? null;
}

// POST /api/jobseeker/users/[id]/follow — フォロー
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 自分自身はフォローできない。DB 側にも CHECK 制約があるが、
  // 400 で返したいのでここで先に弾く（CHECK 違反だと 500 になる）。
  if (owUserId === params.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // 対象が実在し、非公開でないこと。存在しない ID を黙って受け付けない。
  const { data: target } = await adminSupabase
    .from("ow_users")
    .select("id, visibility")
    .eq("id", params.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });
  if (target.visibility === "private") {
    return NextResponse.json({ error: "Target is private" }, { status: 403 });
  }

  const { error } = await adminSupabase
    .from("ow_user_follows")
    .insert({ follower_user_id: owUserId, target_user_id: params.id })
    .select("id");
  // 23505 = unique violation → 既にフォロー済み。成功扱いにする
  if (error && error.code !== "23505") {
    console.error("[user follow POST]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ followed: true }, { status: 200 });
}

// DELETE /api/jobseeker/users/[id]/follow — フォロー解除
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("ow_user_follows")
    .delete()
    .eq("follower_user_id", owUserId)
    .eq("target_user_id", params.id);

  if (error) {
    console.error("[user follow DELETE]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ followed: false }, { status: 200 });
}
