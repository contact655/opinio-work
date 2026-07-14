import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { transformFormToDb, getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import type { BizCompany } from "@/lib/business/mockCompany";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

// PUT /api/biz/company — 自動保存（draft_data に書き込み。本番カラムは触らない）
export async function PUT(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<BizCompany>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId, owUserId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  // フォーム値を DB カラム形式に変換して draft_data に保存
  // 本番カラム（name, mission など）は一切変更しない
  const record = transformFormToDb(body as BizCompany);

  const { error } = await supabase
    .from("ow_companies")
    .update({
      draft_data: record,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) {
    console.error("[company PUT]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  await insertActivity(supabase, {
    company_id: companyId,
    actor_user_id: owUserId,
    type: "company_info_updated",
    description: "企業情報を下書き保存しました",
    target_type: "company",
    target_id: companyId,
  });

  return NextResponse.json({ ok: true });
}

// PATCH /api/biz/company — 「変更を公開する」（draft_data → 本番カラム展開 + is_published=true）
// または { action: "update_numbers_timestamp" } で numbers_updated_at を now() に更新
export async function PATCH(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { isPublished?: boolean; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  // ── 数値アンケート登録タイムスタンプ更新 ─────────────────────────────────
  if (body.action === "update_numbers_timestamp") {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("ow_companies")
      .update({ numbers_updated_at: now, updated_at: now })
      .eq("id", companyId);
    if (error) {
      console.error("[company PATCH update_numbers_timestamp]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, numbersUpdatedAt: now });
  }

  const now = new Date().toISOString();

  // draft_data を取得
  const { data: currentRow, error: fetchError } = await supabase
    .from("ow_companies")
    .select("draft_data")
    .eq("id", companyId)
    .single();

  if (fetchError) {
    console.error("[company PATCH fetch]", fetchError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // draft_data.genres を取り出して ow_company_genres 反映用に保持
  const draftData = currentRow?.draft_data as Record<string, unknown> | null;
  const genreSlugs: string[] = Array.isArray(draftData?.genres)
    ? (draftData!.genres as string[])
    : [];

  // draft_data があれば本番カラムに展開。なければ is_published のみ更新
  // ※ spread 後に is_published / published_at / updated_at / draft_data を上書きする順序に注意
  // ※ genres は ow_companies カラムに存在しない（関係テーブル管理）ため、spread 前に除去
  const draft = (draftData ?? {}) as Record<string, unknown>;
  const ALLOWED_COMPANY_COLS = [
    "tagline", "description", "mission", "culture", "benefits",
    "avg_salary", "avg_age", "female_ratio", "fit_positives", "fit_negatives", "why_join",
    "remote_work_status", "flex_time", "side_job_ok", "accepting_casual_meetings",
    "location", "url", "founded_year", "employee_count", "industry", "industry_id", "saas_category_id", "phase",
    "logo_url", "logo_gradient", "logo_letter",
  ];
  const allowedPayload: Record<string, unknown> = {};
  for (const key of ALLOWED_COMPANY_COLS) {
    if (key in draft) allowedPayload[key] = draft[key];
  }
  const updatePayload: Record<string, unknown> = {
    ...allowedPayload,
    is_published: body.isPublished,
    published_at: body.isPublished ? now : undefined,
    updated_at: now,
    draft_data: null,
  };

  const { error } = await supabase
    .from("ow_companies")
    .update(updatePayload)
    .eq("id", companyId);

  if (error) {
    console.error("[company PATCH]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── ow_company_genres の反映（パターンX: 全置換）─────────────────────────
  try {
    // 1. slug → genre_id の解決
    const { data: genreRecords, error: genreQueryErr } = await supabase
      .from("ow_genres")
      .select("id, slug")
      .in("slug", genreSlugs.length > 0 ? genreSlugs : ["__no_match__"]);

    if (genreQueryErr) throw genreQueryErr;

    // 不正な slug が混じっていた場合はログに出して無視
    const resolvedSlugs = new Set((genreRecords ?? []).map((r) => r.slug));
    const missingSlugs = genreSlugs.filter((s) => !resolvedSlugs.has(s));
    if (missingSlugs.length > 0) {
      console.warn(`[biz/company PATCH] Invalid genre slugs ignored: ${missingSlugs.join(", ")}`);
    }

    const genreIds = (genreRecords ?? []).map((r) => r.id);

    // 2. 既存レコードを全 DELETE
    const { error: deleteErr } = await supabase
      .from("ow_company_genres")
      .delete()
      .eq("company_id", companyId);

    if (deleteErr) throw deleteErr;

    // 3. 新しい配列を全 INSERT（slug 配列が空の場合は INSERT スキップ → 全解除）
    if (genreIds.length > 0) {
      const { error: insertErr } = await supabase
        .from("ow_company_genres")
        .insert(
          genreIds.map((genre_id) => ({
            company_id: companyId,
            genre_id,
            is_human_approved: true,
            is_ai_suggested: false,
          }))
        );

      if (insertErr) throw insertErr;
    }
  } catch (genreErr) {
    // ジャンル同期失敗はログに記録するが、公開処理自体は成功扱い（best-effort）
    // 本番カラムへの展開は完了しているため、ユーザー操作はブロックしない
    console.error("[company PATCH] ow_company_genres sync failed:", genreErr);
  }

  // Feed: company_joined (公開時のみ, best-effort, 重複は 23505 で無視)
  if (body.isPublished) {
    try {
      const adminSupabase = createAdminClient();
      const { data: co } = await adminSupabase.from("ow_companies").select("name, brand_name, tagline").eq("id", companyId).maybeSingle();
      if (co) {
        const coName = co.brand_name ?? co.name ?? "";
        const taglinePart = co.tagline ? ` ${co.tagline}` : "";
        const { error: feedErr } = await adminSupabase.from("ow_posts").insert({
          user_id: SYSTEM_USER_ID,
          post_type: "company_joined",
          ref_company_id: companyId,
          content: `${coName}がOPINIOに掲載されました。${taglinePart}`,
        });
        if (feedErr && feedErr.code !== "23505") {
          console.error("[feed company_joined]", feedErr.message);
        }
      }
    } catch (feedErr) {
      console.error("[feed company_joined]", feedErr);
    }
  }

  return NextResponse.json({ ok: true, publishedAt: body.isPublished ? now : null });
}
