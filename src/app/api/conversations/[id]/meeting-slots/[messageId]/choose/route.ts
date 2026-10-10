import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chooseMeetingSlot } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** POST — 求職者が候補日を1つ選ぶ（2026-10-10 / 段4）。確定し、両方へ .ics つきのメール */
export async function POST(req: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { data: me, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[meeting choose] me:", error.message);
  if (!me) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await chooseMeetingSlot({ conversationId: params.id, messageId: params.messageId, index: b?.index, candidateOwUserId: me.id as string });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, meetingId: r.data.meetingId });
}
