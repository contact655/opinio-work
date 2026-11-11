import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConsultantSelfInput } from "@/lib/constants/careerRoutes";
import { getMyConsultantSetting, setMyConsultantSetting } from "@/lib/featuredConsultants/server";

export const dynamic = "force-dynamic";

/**
 * ★相談可能なユーザーとして載せるか（本人の設定。2026-11-12 / 柴さんの決定「誰でも」）。
 *   GET … 本人の設定 ／ PUT { listed, talkTags, message } … 保存（オンにすると同意を self で記録）
 * ⚠️ 表は anon / authenticated に権限が無いので、書くのは lib/featuredConsultants/server.ts（admin クライアント）。
 * ⚠️ 本人は auth のセッションから ow_users.id を引いて決める（body の id を信じない）。
 */
async function meId(): Promise<{ ok: true; owUserId: string } | { ok: false; res: NextResponse }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[consultant-setting] me:", error.message);
  if (!data) return { ok: false, res: NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 }) };
  return { ok: true, owUserId: data.id as string };
}

export async function GET() {
  const me = await meId();
  if (!me.ok) return me.res;
  const s = await getMyConsultantSetting(me.owUserId);
  if (!s) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  const me = await meId();
  if (!me.ok) return me.res;
  const p = parseConsultantSelfInput(await req.json().catch(() => null));
  if (!p.ok) return NextResponse.json({ error: p.message }, { status: 400 });
  const r = await setMyConsultantSetting(me.owUserId, p.value);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  /* ⚠️ ホームと /people は毎回描き直す（force-dynamic）ので、キャッシュの更新は要らない */
  const s = await getMyConsultantSetting(me.owUserId);
  return NextResponse.json(s ?? { ok: true });
}
