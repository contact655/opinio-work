import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToApproach } from "@/lib/approaches/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobseeker/approaches/[id]/respond — 企業からの声かけに答える（2026-10-09）。
 * body: { action: "accept" | "decline" }
 *
 * ⚠️ 本人宛てか・未回答か・期限内か・いま見せてよい企業かは `respondToApproach` が見る。
 * ⚠️★見送ったことは企業に伝えない（通知を出さない・企業の画面は「承認待ち」のまま）。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action は accept か decline で指定してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[approaches/respond] ow_users:", error.message);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const r = await respondToApproach({ approachId: params.id, candidateOwUserId: me.id as string, action });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, conversationId: r.conversationId });
}
