import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMypageNavBadges } from "@/lib/mypage/navBadges";

/* ⚠️ GET のルートハンドラは既定でキャッシュされる（CLAUDE.md）。数字が古いまま固まるので外さない */
export const dynamic = "force-dynamic";

/** ★マイページのナビの数字（2026-10-09）。数え方は `lib/mypage/navBadges.ts` の1か所 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: me, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[mypage-badges] ow_users:", error.message);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(await getMypageNavBadges(me.id as string));
}
