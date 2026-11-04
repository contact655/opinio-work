import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ★ホームの「おすすめのユーザー」の×（2026-11-04）。押した人にだけ、その人を30日間出さない。
 *   params.id は ow_users.id（出さない相手）。記録は ow_user_suggestion_dismissals（admin クライアントだけが読み書きする）。
 * ⚠️ 何度押しても1行（押した日時を新しくする）。30日の判定は lib/people/suggest.ts
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[user suggestion dismiss] me:", meErr.message);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (me.id === params.id) return NextResponse.json({ error: "Cannot dismiss yourself" }, { status: 400 });

  const { data: target, error: tErr } = await admin.from("ow_users").select("id").eq("id", params.id).maybeSingle();
  if (tErr) console.error("[user suggestion dismiss] target:", tErr.message);
  if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });

  const { error } = await admin
    .from("ow_user_suggestion_dismissals")
    .upsert({ viewer_user_id: me.id, target_user_id: params.id, dismissed_at: new Date().toISOString() }, { onConflict: "viewer_user_id,target_user_id" })
    .select("target_user_id");
  if (error) {
    console.error("[user suggestion dismiss]", error.message);
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }
  return NextResponse.json({ dismissed: true }, { status: 200 });
}
