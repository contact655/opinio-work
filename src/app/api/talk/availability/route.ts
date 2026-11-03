import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { talkProfiles } from "@/lib/talk/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 50;

/**
 * ★「話を聞く」ボタンを出すか（2026-11-03）。GET ?ids=a,b,…（50件まで）→ { availability: { [id]: { show, connected } } }
 *   show = 相互フォローでつながっている（ふつうに送れる）か、相手がいま話を受け付けている
 *   判定は lib/talk/server.ts の talkProfiles（最初の1通の送信の検証と同じ関数）。
 * ⚠️ 返すのはボタンを出すかどうかだけ。今月の依頼の件数・話せる量そのものは返さない。
 * ⚠️ 未ログインでも答える（ボタンの有無は公開の画面に出るものなので）。押すとログインへ進む。
 * ⚠️ 自分自身・非公開の人・存在しない人は show: false。
 */
export async function GET(req: NextRequest) {
  const ids = Array.from(new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ availability: {} });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let meId: string | null = null;
  if (user) {
    const { data: me, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
    if (error) console.error("[talk/availability] me:", error.message);
    meId = (me?.id as string | undefined) ?? null;
  }

  const [{ data: users, error: uErr }, profiles] = await Promise.all([
    admin.from("ow_users").select("id, visibility").in("id", ids),
    talkProfiles(ids),
  ]);
  if (uErr || !profiles) {
    console.error("[talk/availability]", uErr?.message ?? "profiles");
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  const visible = new Set((users ?? []).filter((u) => u.visibility !== "private").map((u) => u.id as string));

  /* 相互フォロー（見ている本人とのあいだだけ） */
  const connected = new Set<string>();
  if (meId) {
    const [out, inc] = await Promise.all([
      admin.from("ow_user_follows").select("target_user_id").eq("follower_user_id", meId).in("target_user_id", ids),
      admin.from("ow_user_follows").select("follower_user_id").eq("target_user_id", meId).in("follower_user_id", ids),
    ]);
    if (out.error || inc.error) {
      console.error("[talk/availability] follows:", out.error?.message ?? inc.error?.message);
    } else {
      const following = new Set((out.data ?? []).map((r) => r.target_user_id as string));
      for (const r of inc.data ?? []) if (following.has(r.follower_user_id as string)) connected.add(r.follower_user_id as string);
    }
  }

  const availability: Record<string, { show: boolean; connected: boolean }> = {};
  for (const id of ids) {
    if (id === meId || !visible.has(id)) { availability[id] = { show: false, connected: false }; continue; }
    const isConnected = connected.has(id);
    availability[id] = { show: isConnected || profiles.get(id)?.accepts === true, connected: isConnected };
  }
  return NextResponse.json({ availability }, { headers: { "Cache-Control": "private, no-store" } });
}
