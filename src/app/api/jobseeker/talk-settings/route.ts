import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyTalkSettings, saveTalkSettings } from "@/lib/talk/server";
import { parseTalkSettings } from "@/lib/constants/talk";

export const dynamic = "force-dynamic";

/**
 * ★本人の「話す立場」と「話せる量」（2026-11-03）。表は ow_talk_settings（読み書きは lib/talk/server.ts）。
 *   GET … いまの設定と、「採用担当」として選べる会社
 *   PUT … { stance, stanceCompanyId, capacity } を保存。⚠️ 不正値は 400。採用担当は所属企業で許された人だけ（403）
 */
async function resolveMe(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[talk-settings] me:", error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function GET() {
  const me = await resolveMe();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await getMyTalkSettings(me);
  if (!s) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(s, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  const me = await resolveMe();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = parseTalkSettings(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const r = await saveTalkSettings(me, parsed.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
