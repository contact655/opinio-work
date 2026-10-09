import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countCompaniesInRange, getApproachRange, getApproachRangeOptions, listApproachBlockedCompanies,
  parseApproachRange, saveApproachRange,
} from "@/lib/approaches/range";

export const dynamic = "force-dynamic";

/**
 * ★声かけを受け取る範囲（2026-10-10 / 段2）。本人だけが読み書きする。
 * ⚠️ 送れるかの判定はここに無い（DB 関数 `can_send_company_approach()`）。
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
  const [range, blocks, count] = await Promise.all([
    getApproachRange(owUserId), listApproachBlockedCompanies(owUserId), countCompaniesInRange(owUserId),
  ]);
  if (!range || !blocks) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
  /* ⚠️ count は失敗しても null のまま返す（画面は「—」。0 と出さない） */
  return NextResponse.json({ range, blocks, count });
}

export async function PUT(req: NextRequest) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const options = await getApproachRangeOptions();
  if (!options) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  const parsed = parseApproachRange(await req.json().catch(() => null), options);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!(await saveApproachRange(owUserId, parsed.value))) {
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ range: parsed.value, count: await countCompaniesInRange(owUserId) });
}
