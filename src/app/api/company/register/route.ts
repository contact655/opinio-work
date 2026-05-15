import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";

export async function POST(req: Request) {
  // --- 認証チェック（通常のサーバークライアントで） ---
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[company/register] no user found in session");
    return NextResponse.json(
      { error: "ログインが必要です。再度ログインしてからお試しください。" },
      { status: 401 }
    );
  }

  console.log("[company/register] authenticated user:", user.id, user.email);

  // --- DB操作は管理クライアント（RLSバイパス）で ---
  const admin = createAdminClient();
  const body = await req.json();

  // genres は ow_companies のカラムではないため分離（best-effort で ow_company_genres に INSERT）
  const genreSlugs: string[] = Array.isArray(body.genres) ? body.genres : [];

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json(
      { error: "会社名は必須です" },
      { status: 400 }
    );
  }

  // 1. ow_companies に INSERT
  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      name_en: body.name_en || null,
      founded_at: body.founded_at || null,
      employee_count: body.employee_count || null,
      location: body.location || null,
      industry: body.industry || null,
      phase: body.phase || null,
      url: body.url || null,
      mission: body.mission || null,
      description: body.description || null,
      logo_url: body.logo_url || null,
      plan: body.plan || "free",
      status: "active",
    })
    .select("id, name, created_at")
    .single();

  if (companyError) {
    console.error("[company/register] INSERT failed:", JSON.stringify(companyError));
    return NextResponse.json(
      { error: `企業登録に失敗: ${companyError.message}` },
      { status: 500 }
    );
  }

  console.log("[company/register] company created:", company.id, company.name);

  // 2. カルチャータグを INSERT
  const tags: { tag_category: string; tag_value: string }[] = body.tags || [];
  if (tags.length > 0) {
    const { error: tagError } = await admin
      .from("ow_company_culture_tags")
      .insert(
        tags.map((t) => ({
          company_id: company.id,
          tag_category: t.tag_category,
          tag_value: t.tag_value,
        }))
      );
    if (tagError) {
      console.error("[company/register] tags INSERT failed:", tagError.message);
    }
  }

  // 2.5 ow_company_genres INSERT（best-effort: 失敗しても company 作成成功として扱う）
  if (genreSlugs.length > 0) {
    try {
      // slug → genre_id の解決
      const { data: genreRecords } = await admin
        .from("ow_genres")
        .select("id, slug")
        .in("slug", genreSlugs);

      // 不正な slug の警告ログ
      const resolvedSlugs = new Set((genreRecords ?? []).map((r: { slug: string }) => r.slug));
      const missingSlugs = genreSlugs.filter((s) => !resolvedSlugs.has(s));
      if (missingSlugs.length > 0) {
        console.warn(`[company/register POST] Invalid genre slugs ignored: ${missingSlugs.join(", ")}`);
      }

      const genreIds = (genreRecords ?? []).map((r: { id: string }) => r.id);
      if (genreIds.length > 0) {
        const { error: genresError } = await admin
          .from("ow_company_genres")
          .insert(
            genreIds.map((genre_id: string) => ({
              company_id: company.id,
              genre_id,
              is_human_approved: true,
              is_ai_suggested: false,
            }))
          );

        if (genresError) {
          console.error(
            `[company/register POST] ow_company_genres INSERT failed for ${company.id}:`,
            genresError.message
          );
        }
      }
    } catch (genreErr) {
      console.error("[company/register POST] ow_company_genres sync error:", genreErr);
    }
  }

  // 3. ow_users.id を auth_id から取得して ow_company_admins に INSERT
  const { data: owUser, error: owUserError } = await admin
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", user.id)
    .single();

  if (owUserError || !owUser) {
    console.error("[company/register] ow_users not found for auth_id:", user.id, owUserError?.message);
    // ow_users トリガーが遅延した場合のフォールバック: warning のみ（company は作成済み）
  } else {
    const { error: adminError } = await admin
      .from("ow_company_admins")
      .insert({
        user_id: owUser.id,
        company_id: company.id,
        department: body.department || null,
        role_title: body.role_title || null,
        permission: "admin",
      });

    if (adminError && adminError.code !== "23505") {
      console.error("[company/register] ow_company_admins INSERT failed:", adminError.message);
    } else {
      console.log("[company/register] ow_company_admins created");
    }
  }

  console.log("[company/register] SUCCESS");

  // 運営への新規企業通知（best-effort: 失敗してもメインフローを止めない）
  await notify(
    newCompanyAdminTemplate({
      companyName: company.name,
      companyId: company.id,
      creatorName: owUser?.name ?? user.email ?? "不明",
      creatorEmail: user.email ?? "",
      createdAt: company.created_at ?? new Date().toISOString(),
      isDuplicate: false,
    })
  );

  const res = NextResponse.json({
    success: true,
    redirectTo: "/biz/dashboard",
    company_id: company.id,
    company: { id: company.id, name: company.name },
  });
  res.cookies.set("biz_current_company_id", company.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
