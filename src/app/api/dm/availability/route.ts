import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageButtonVisible } from "@/lib/constants/messageButton";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 50;

/**
 * ★「メッセージ」ボタンを出すか（2026-11-05。2026-11-03〜11-05 は /api/talk/availability だった）。
 *   GET ?ids=a,b,…（50件まで）→ { availability: { [id]: { show, connected } } }
 *   判定は lib/constants/messageButton.ts の messageButtonVisible（自分・非公開・検証用との組み合わせ・自分がブロックした相手は出さない）。
 *   connected = 相互フォローでつながっている（書く画面の案内が変わる）
 * ⚠️ 相手が自分をブロックしているかは返さない（ボタンの有無で分かってしまう。送る段で止める）
 * ⚠️ 未ログインでも答える（ボタンの有無は公開の画面に出るものなので）。押すとログインへ進む。
 */
export async function GET(req: NextRequest) {
  const ids = Array.from(new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ availability: {} });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let meId: string | null = null;
  /* 未ログインは null（実在の人として扱う） */
  let meIsTest: boolean | null = null;
  if (user) {
    const { data: me, error } = await admin.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
    if (error) {
      /* ⚠️ 自分が検証用か分からないと組み合わせを判定できない。出さない向きに倒す */
      console.error("[dm/availability] me:", error.message);
      return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
    }
    meId = (me?.id as string | undefined) ?? null;
    meIsTest = me ? me.is_test === true : null;
  }

  const { data: users, error: uErr } = await admin.from("ow_users").select("id, visibility, is_test").in("id", ids);
  if (uErr) {
    console.error("[dm/availability]", uErr.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  const visible = new Set((users ?? []).filter((u) => u.visibility !== "private").map((u) => u.id as string));
  const testIds = new Set((users ?? []).filter((u) => u.is_test === true).map((u) => u.id as string));

  /* 相互フォロー・自分がブロックした相手（見ている本人とのあいだだけ） */
  const connected = new Set<string>();
  const blockedByMe = new Set<string>();
  if (meId) {
    const [out, inc, blocks] = await Promise.all([
      admin.from("ow_user_follows").select("target_user_id").eq("follower_user_id", meId).in("target_user_id", ids),
      admin.from("ow_user_follows").select("follower_user_id").eq("target_user_id", meId).in("follower_user_id", ids),
      admin.from("ow_user_blocks").select("blocked_user_id").eq("blocker_user_id", meId).in("blocked_user_id", ids),
    ]);
    if (out.error || inc.error) {
      console.error("[dm/availability] follows:", out.error?.message ?? inc.error?.message);
    } else {
      const following = new Set((out.data ?? []).map((r) => r.target_user_id as string));
      for (const r of inc.data ?? []) if (following.has(r.follower_user_id as string)) connected.add(r.follower_user_id as string);
    }
    if (blocks.error) {
      /* ⚠️ 分からなければ出さない向きに倒す（ブロックした相手にボタンを出さない） */
      console.error("[dm/availability] blocks:", blocks.error.message);
      return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
    }
    for (const b of blocks.data ?? []) blockedByMe.add(b.blocked_user_id as string);
  }

  const availability: Record<string, { show: boolean; connected: boolean }> = {};
  for (const id of ids) {
    const show = messageButtonVisible({
      isSelf: id === meId,
      targetVisible: visible.has(id),
      viewerIsTest: meIsTest,
      targetIsTest: testIds.has(id),
      blockedByViewer: blockedByMe.has(id),
    });
    availability[id] = { show, connected: show && connected.has(id) };
  }
  return NextResponse.json({ availability }, { headers: { "Cache-Control": "private, no-store" } });
}
