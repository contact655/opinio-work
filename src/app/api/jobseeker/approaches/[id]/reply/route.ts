import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyToApproach } from "@/lib/approaches/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobseeker/approaches/[id]/reply — 企業からのメッセージリクエストに返信する（2026-10-11）。
 * body: { body: string }（1〜2000字）
 *
 * ⚠️ 返信した時点でやり取りが始まる（会話が開き、企業の理由と本文が1通目、返信が2通目）。
 * ⚠️ 書き込みは DB 関数 `reply_to_company_approach` の1トランザクション（`replyToApproach`）。ここに条件を書かない。
 * ⚠️ 返す status: 404（見つからない・30日を過ぎた）／409（すでに返信・見送り済み）／403（いま開けない）／400（本文）。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const body = typeof payload?.body === "string" ? payload.body : "";

  const admin = createAdminClient();
  const { data: me, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[approaches/reply] ow_users:", error.message);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const r = await replyToApproach({ approachId: params.id, candidateOwUserId: me.id as string, body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, conversationId: r.conversationId });
}
