import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { buildCompanyJoinedRow } from "@/lib/feed/systemPosts";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { transformFormToDb, getCompanyContext } from "@/lib/business/company";
import { publishedAtPatch } from "@/lib/companies/publishedAt";
import { insertActivity } from "@/lib/business/activities";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { isValidIndustry } from "@/lib/search/industryGroups";
import type { BizCompany } from "@/lib/business/mockCompany";


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

  /* ⚠️ **0行更新を成功として扱わない。** 2026-08-23 まで `.select()` が無く、
        RLS が `auth.uid() = user_id`（87社中2社にしか入っていない列）を
        要求していたため、**85社で保存されないまま「保存しました」と出ていた。** */
  const draftRes = await mutateOne(
    supabase
      .from("ow_companies")
      .update({
        draft_data: record,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId),
    "company PATCH draft_data",
  );
  if (!draftRes.ok) {
    return NextResponse.json({ error: draftRes.error }, { status: draftRes.status });
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
    const numRes = await mutateOne(
      supabase
        .from("ow_companies")
        .update({ numbers_updated_at: now, updated_at: now })
        .eq("id", companyId),
      "company PATCH update_numbers_timestamp",
    );
    if (!numRes.ok) {
      return NextResponse.json({ error: numRes.error }, { status: numRes.status });
    }
    return NextResponse.json({ ok: true, numbersUpdatedAt: now });
  }

  const now = new Date().toISOString();

  // draft_data + is_approved を取得
  const { data: currentRow, error: fetchError } = await supabase
    .from("ow_companies")
    .select("draft_data, is_approved, published_at")
    .eq("id", companyId)
    .single();

  if (fetchError) {
    console.error("[company PATCH fetch]", fetchError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 未承認の企業は公開不可
  if (body.isPublished && !currentRow?.is_approved) {
    return NextResponse.json({ error: "Not approved by admin yet" }, { status: 403 });
  }

  // draft_data.genres を取り出して ow_company_genres 反映用に保持
  const draftData = currentRow?.draft_data as Record<string, unknown> | null;
  const genreSlugs: string[] = Array.isArray(draftData?.genres)
    ? (draftData!.genres as string[])
    : [];

  // draft_data があれば本番カラムに展開。なければ is_published のみ更新
  // ※ genres は ow_companies カラムに存在しない（関係テーブル管理）ため除外
  const d = (draftData ?? {}) as Record<string, unknown>;

  /* 業種は選択肢の外の値を受け取らない。
     ⚠️ 旧表記（`LEGACY_INDUSTRY_VALUES`）は通す。弾くと、その値を持つ既存企業が
        業種と無関係な項目を保存しただけで 400 になる。 */
  if (typeof d.industry === "string" && d.industry.trim() && !isValidIndustry(d.industry.trim())) {
    return NextResponse.json(
      { error: "INVALID_INDUSTRY", message: "業種の値が不正です。" },
      { status: 400 }
    );
  }
  const s = (v: unknown): string | null => typeof v === "string" ? v : null;
  const n = (v: unknown): number | null => typeof v === "number" ? v : null;
  const sa = (v: unknown): string[] | null => Array.isArray(v) ? v as string[] : null;

  const mainRes = await mutateOne(
    supabase
    .from("ow_companies")
    .update({
      tagline:                  s(d.tagline),
      description:              s(d.description),
      mission:                  s(d.mission),
      benefits:                 sa(d.benefits),
      avg_salary:               s(d.avg_salary),
      avg_age:                  n(d.avg_age),
      female_ratio:             s(d.female_ratio),
      fit_positives:            sa(d.fit_positives),
      fit_negatives:            sa(d.fit_negatives),
      why_join:                 s(d.why_join),
      remote_work_status:       s(d.remote_work_status),
      flex_time:                typeof d.flex_time === "boolean" ? d.flex_time : undefined,
      side_job_ok:              typeof d.side_job_ok === "boolean" ? d.side_job_ok : undefined,
      accepting_casual_meetings: typeof d.accepting_casual_meetings === "boolean" ? d.accepting_casual_meetings : undefined,
      location:                 s(d.location),
      url:                      s(d.url),
      founded_year:             n(d.founded_year),
      employee_count:           s(d.employee_count),
      industry:                 s(d.industry),
      industry_id:              s(d.industry_id),
      saas_category_id:         s(d.saas_category_id),
      phase:                    s(d.phase),
      logo_url:                 s(d.logo_url),
      logo_gradient:            s(d.logo_gradient),
      logo_letter:              s(d.logo_letter),
      is_published:             body.isPublished ?? false,
      /* ⚠️ 企業側の「公開する」は**2軸を同時に**動かす。
            2026-08-12 に is_published（詳細ページ）と listing_status（ディレクトリ）を
            分離したが、**企業側の体験と意味は変えない**。
            ディレクトリだけ下ろすのは運営の操作（/admin/companies）に限る。 */
      listing_status:           body.isPublished ? "listed" : "draft",
      /* ⚠️ published_at の規則は lib/companies/publishedAt.ts に集約している。
            2026-08-12 まで `body.isPublished ? now : null` と書いており、
            **公開中に再保存するたび初回公開日を上書きし、非公開に戻すと消していた。**
            運営側（updateIsPublished）の「最初に公開した日時」という意味と食い違っていた。 */
      ...publishedAtPatch(currentRow?.published_at, !!body.isPublished, now),
      updated_at:               now,
      draft_data:               null,
    })
    .eq("id", companyId),
    "company PATCH 本体",
  );

  /* ⚠️ **0行更新を成功として扱わない。** ここが 2026-08-23 まで
        85社で黙って保存されていなかった箇所（RLS の条件が `ow_companies.user_id`
        依存で、その列は2社にしか入っていなかった）。 */
  if (!mainRes.ok) {
    return NextResponse.json({ error: mainRes.error }, { status: mainRes.status });
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

  /* Feed: company_joined（**ディレクトリ掲載時のみ**, best-effort, 重複は 23505 で無視）
     ⚠️ 2026-08-13 に条件を is_published から listing_status に移した。
        ページは作られた時点で存在するようになったので、「参加しました」の
        お知らせはディレクトリに迎え入れたことに対して出す。
        この経路は2軸を同時に動かすため body.isPublished が listed と一致する。 */
  if (body.isPublished) {
    try {
      const adminSupabase = createAdminClient();
      const { data: co } = await adminSupabase.from("ow_companies").select("name, brand_name, tagline").eq("id", companyId).maybeSingle();
      if (co) {
        // ⚠️ 本文と ref_* の埋め方は lib/feed/systemPosts に集約している。ここで組み立てない。
        const { error: feedErr } = await adminSupabase.from("ow_posts").insert(
          buildCompanyJoinedRow(companyId, co),
        );
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
