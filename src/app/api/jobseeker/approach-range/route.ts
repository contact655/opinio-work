import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getApproachRange, getApproachRangeFieldFlags, getApproachRangeOptions, loadApproachRangeState,
  parseApproachRange, saveApproachRange,
} from "@/lib/approaches/range";

export const dynamic = "force-dynamic";

/**
 * ★声かけを受け取る範囲（2026-10-10 / 段2）。本人だけが読み書きする。
 * ⚠️ 送れるかの判定はここに無い（DB 関数 `can_send_company_approach()`）。
 * ⚠️ 無効の項目（`ow_approach_range_fields`）は画面に出さない。PUT で送られても**保存済みの値を残す**
 *    （画面に無い項目を書き換えない。判定でも使われない）。
 */
async function me(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[approach-range] me:", error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function GET() {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const state = await loadApproachRangeState(owUserId);
  if (!state) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
  return NextResponse.json(state);
}

export async function PUT(req: NextRequest) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const [options, fields, current] = await Promise.all([getApproachRangeOptions(), getApproachRangeFieldFlags(), getApproachRange(owUserId)]);
  if (!options || !fields || !current) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  const parsed = parseApproachRange(await req.json().catch(() => null), options);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  /* ★無効の項目は保存済みの値を残す */
  const next = {
    jobCategories: fields.job_categories ? v.jobCategories : current.jobCategories,
    industries: fields.industries ? v.industries : current.industries,
    sizeGroups: fields.size_groups ? v.sizeGroups : current.sizeGroups,
    prefectures: fields.prefectures ? v.prefectures : current.prefectures,
    remoteOk: fields.remote_ok ? v.remoteOk : current.remoteOk,
  };
  if (!(await saveApproachRange(owUserId, next))) {
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
  const state = await loadApproachRangeState(owUserId);
  if (!state) return NextResponse.json({ error: "保存しましたが、最新の状態を取得できませんでした" }, { status: 500 });
  return NextResponse.json(state);
}
