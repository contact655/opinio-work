import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * ★「最後に利用した日」を記録する（2026-10-12 / 柴さんの指示）。**1日1回まで**書く。
 *   ログインしたまま使っている人も、求職者側のページを開けば記録される（`ActivityPing` が呼ぶ）。
 *
 * ⚠️ 書くのはここだけ（admin クライアント）。ow_users.last_active_at は anon / authenticated に GRANT していない。
 * ⚠️★「今日の0時（日本時間）より前、または NULL」の行だけ UPDATE する条件付き更新。タブを何枚開いても1日1回。
 * ⚠️ 本人の行だけ（auth.uid() に対応する ow_users）。失敗しても画面には何も出さない（ログは出す）。
 */
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const todayStartJst = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date())}T00:00:00+09:00`).toISOString();
  const { data, error } = await createAdminClient().from("ow_users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("auth_id", user.id)
    .or(`last_active_at.is.null,last_active_at.lt.${todayStartJst}`)
    .select("id");
  if (error) {
    console.error("[jobseeker/activity]", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  /* ⚠️ 0行は正常（今日は記録済み） */
  return NextResponse.json({ ok: true, updated: (data ?? []).length });
}
