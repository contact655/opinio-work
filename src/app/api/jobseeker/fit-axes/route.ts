import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FIT_AXES_VERSION,
  fitAxesEnabledFor,
  isFitAxisKey,
  isFitAxisSource,
  isFitAxisValue,
} from "@/lib/fitAxes/axes";

export const dynamic = "force-dynamic";

/**
 * 「相性のものさし」の保存（POST）と削除（DELETE）。2026-10-15。
 *
 * ⚠️★受け取るのは**本人が確認した数字だけ**（`{ answers: { key: 1〜5 | null }, source }`）。
 *    貼り付けた AI の文章は画面（ブラウザ）の中で読み取って捨てるので、ここには来ない。
 *    ⚠️ リクエストの中身をログに出さないこと（数字であっても本人の価値観）。
 * ⚠️ 書き込みは service_role だけ（ow_fit_axis_answers はクライアントに INSERT/UPDATE/DELETE を配っていない）。
 * ⚠️ 公開前（FIT_AXES_PUBLIC = false）は検証用アカウントだけが使える。それ以外は 404（存在を知らせない）。
 */
async function viewer() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient()
    .from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[fit-axes] ow_users:", error.message);
  if (!data) return null;
  return { id: data.id as string, isTest: data.is_test === true };
}

export async function POST(req: NextRequest) {
  const me = await viewer();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!fitAxesEnabledFor(me)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { answers?: unknown; source?: unknown };
  if (!isFitAxisSource(body.source)) return NextResponse.json({ error: "入力元が正しくありません" }, { status: 400 });
  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return NextResponse.json({ error: "回答の形式が正しくありません" }, { status: 400 });
  }
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.length === 0) return NextResponse.json({ error: "回答がありません" }, { status: 400 });
  for (const [k, v] of entries) {
    /* ⚠️ 黙って捨てない。知らない軸・範囲外の値は 400 */
    if (!isFitAxisKey(k)) return NextResponse.json({ error: "知らない軸が含まれています" }, { status: 400 });
    if (!isFitAxisValue(v)) return NextResponse.json({ error: "値は 1〜5 か「わからない」です" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await createAdminClient().from("ow_fit_axis_answers").upsert(
    entries.map(([axis_key, value]) => ({
      user_id: me.id, axis_key, value: value as number | null, source: body.source as string,
      axes_version: FIT_AXES_VERSION, updated_at: now,
    })),
    { onConflict: "user_id,axis_key" },
  ).select("axis_key");
  if (error || !data || data.length !== entries.length) {
    console.error("[fit-axes] 保存:", error?.message ?? `${data?.length ?? 0}/${entries.length} 行`);
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: data.length });
}

/** ★ものさしを削除する（本人の全行）。プライバシーポリシーの文案の「削除の方法」はこれ */
export async function DELETE() {
  const me = await viewer();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!fitAxesEnabledFor(me)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await createAdminClient().from("ow_fit_axis_answers").delete().eq("user_id", me.id);
  if (error) {
    console.error("[fit-axes] 削除:", error.message);
    return NextResponse.json({ error: "削除できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
