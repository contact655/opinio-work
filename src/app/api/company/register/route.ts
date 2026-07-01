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


  // --- DB操作は管理クライアント（RLSバイパス）で ---
  const admin = createAdminClient();
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // genres は ow_companies のカラムではないため分離（best-effort で ow_company_genres に INSERT）
  const genreSlugs: string[] = Array.isArray(body.genres) ? body.genres : [];

  if (!body.name || (typeof body.name === "string" && body.name.trim() === "")) {
    return NextResponse.json(
      { error: "会社名は必須です" },
      { status: 400 }
    );
  }

  // URL バリデーション（https:// のみ）
  function safeHttpsUrl(raw: unknown): string | null {
    if (typeof raw !== "string" || !raw) return null;
    try { const p = new URL(raw); return p.protocol === "https:" ? raw.slice(0, 2048) : null; } catch { return null; }
  }

  function strReg(v: unknown, max: number): string | null {
    return typeof v === "string" ? v.trim().slice(0, max) || null : null;
  }

  const VALID_PLANS = new Set(["free", "paid"]);
  const plan = (typeof body.plan === "string" && VALID_PLANS.has(body.plan)) ? body.plan : "free";

  const VALID_PHASES = new Set(["seed", "シード", "series_a", "シリーズA", "series_b", "シリーズB", "series_c", "シリーズC", "listed", "上場", "unicorn", "ユニコーン", "IPO準備中", "private"]);
  const phase = typeof body.phase === "string" && VALID_PHASES.has(body.phase) ? body.phase : null;

  const tags = ((body.tags as unknown[]) ?? []).slice(0, 50);

  // 1. ow_companies に INSERT
  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      user_id: user.id,
      name: typeof body.name === "string" ? body.name.trim().slice(0, 200) : body.name,
      name_en: strReg(body.name_en, 200),
      founded_at: body.founded_at || null,
      employee_count: body.employee_count || null,
      location: strReg(body.location, 200),
      industry: strReg(body.industry, 100),
      phase,
      url: safeHttpsUrl(body.url),
      mission: strReg(body.mission, 1000),
      description: strReg(body.description, 5000),
      logo_url: safeHttpsUrl(body.logo_url),
      plan,
      status: "active",
    })
    .select("id, name, created_at")
    .single();

  if (companyError) {
    console.error("[company/register] INSERT failed:", JSON.stringify(companyError));
    return NextResponse.json(
      { error: "企業登録に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }


  // 2. カルチャータグを INSERT
  if (tags.length > 0) {
    const { error: tagError } = await admin
      .from("ow_company_culture_tags")
      .insert(
        tags.map((t: unknown) => {
          const tag = t as Record<string, unknown>;
          return {
            company_id: company.id,
            tag_category: typeof tag.tag_category === "string" ? tag.tag_category.slice(0, 100) : null,
            tag_value: typeof tag.tag_value === "string" ? tag.tag_value.slice(0, 100) : null,
          };
        })
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
    }
  }


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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
