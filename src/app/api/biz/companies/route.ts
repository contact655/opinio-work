import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";
import { resolveOrLinkOwUser } from "@/lib/auth/linkOwUser";

/**
 * POST /api/biz/companies
 *
 * 新規企業を作成し、作成者を最初の admin として登録する。
 * Phase 2 Sprint 1 — 動線B（企業新規作成）バックエンド
 *
 * フロー:
 *   1. 認証チェック
 *   2. name 必須チェック
 *   3. 重複チェック（厳密一致）
 *      - 既存 → 409 + { error: "company_name_exists", existing_company }
 *      - force_create: true の場合はスキップ
 *   4. ow_companies INSERT（status: 'draft'）
 *   5. ow_company_admins INSERT（permission: 'admin'）
 *   6. biz_current_company_id Cookie をセット
 *   7. 作成結果を返す
 */
export async function POST(req: Request) {
  // 1. 認証チェック
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 }
    );
  }

  // 2. リクエストボディ
  let body: {
    name?: string;
    description?: string;
    industry?: string;
    size?: string;
    website?: string;
    logo_url?: string;
    force_create?: boolean;
    genres?: string[];
    agreedTermsBusiness?: boolean;
    agreedFeePct15?: boolean;
    agreedTermsVersion?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "会社名は必須です" },
      { status: 400 }
    );
  }
  if (name.length > 200) {
    return NextResponse.json(
      { error: "会社名は200字以内で入力してください" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 3. 重複チェック（force_create: true のときはスキップ）
  if (!body.force_create) {
    const { data: existing } = await admin
      .from("ow_companies")
      .select("id, name")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      // admin_count を取得
      const { count: adminCount } = await admin
        .from("ow_company_admins")
        .select("id", { count: "exact", head: true })
        .eq("company_id", existing.id)
        .not("user_id", "is", null);

      return NextResponse.json(
        {
          error: "company_name_exists",
          message: "同名の企業が既に存在します",
          existing_company: {
            id: existing.id,
            name: existing.name,
            admin_count: adminCount ?? 0,
          },
        },
        { status: 409 }
      );
    }
  }

  // 4. ow_companies INSERT
  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      name,
      description: body.description || null,
      industry: body.industry || null,
      employee_count: body.size ? parseInt(body.size, 10) : null,
      url: (typeof body.website === "string" && /^https:\/\//i.test(body.website)) ? body.website.slice(0, 2048) : null,
      logo_url: (typeof body.logo_url === "string" && /^https:\/\//i.test(body.logo_url)) ? body.logo_url.slice(0, 2048) : null,
      status: "draft",
      is_published: false,
      plan: "free",
    })
    .select("id, name, status, created_at, industry, url, logo_url")
    .single();

  if (companyError || !company) {
    console.error("[POST /api/biz/companies] INSERT failed:", companyError?.message);
    return NextResponse.json(
      { error: "企業登録に失敗しました" },
      { status: 500 }
    );
  }

  // 5. ow_company_admins INSERT（作成者を最初の admin として登録）
  // 以前はここで email 一致だけを根拠に auth_id を無条件で補完していたが、
  // それだと他人のメールアドレスで登録した人が既存プロフィールを引き継げてしまう。
  // 共通ヘルパーに寄せ、所有証明（メール確認済み）があるときだけ引き継ぐようにする。
  const resolution = await resolveOrLinkOwUser({
    authId: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.user_metadata?.full_name || null,
    emailVerified: !!user.email_confirmed_at,
  });

  const owUser = resolution.status === "error" || resolution.status === "needs_verification"
    ? null
    : resolution.owUser;

  if (!owUser) {
    console.error(
      "[POST /api/biz/companies] ow_users not resolved for current user:",
      resolution.status === "error" ? resolution.message : resolution.status
    );
    // ow_users が見つからない場合も company は作成済みなのでエラーにしない
  } else {
    const { error: adminError } = await admin
      .from("ow_company_admins")
      .insert({
        user_id: owUser.id,
        company_id: company.id,
        permission: "admin",
        is_active: true,
        ...(body.agreedTermsBusiness != null && {
          agreed_terms_business: body.agreedTermsBusiness,
          agreed_fee_15pct: body.agreedFeePct15 ?? false,
          agreed_terms_version: body.agreedTermsVersion ?? null,
          agreed_at: new Date().toISOString(),
        }),
      });

    if (adminError && adminError.code !== "23505") {
      console.error("[POST /api/biz/companies] ow_company_admins INSERT failed:", adminError.message);
    }
  }

  // 5.5 ow_company_genres INSERT（best-effort）
  // genres が指定されている場合のみ実行。ow_companies INSERT 成功済みなので失敗しても 201 を返す。
  const genreSlugs: string[] = Array.isArray(body.genres) ? body.genres.slice(0, 50) : [];
  if (genreSlugs.length > 0) {
    try {
      // slug → genre_id の解決
      const { data: genreRecords } = await admin
        .from("ow_genres")
        .select("id, slug")
        .in("slug", genreSlugs);

      // 不正な slug の警告ログ
      const resolvedSlugs = new Set((genreRecords ?? []).map((r) => r.slug));
      const missingSlugs = genreSlugs.filter((s) => !resolvedSlugs.has(s));
      if (missingSlugs.length > 0) {
        console.warn(`[biz/companies POST] Invalid genre slugs ignored: ${missingSlugs.join(", ")}`);
      }

      const genreIds = (genreRecords ?? []).map((r) => r.id);
      if (genreIds.length > 0) {
        const { error: genresError } = await admin
          .from("ow_company_genres")
          .insert(
            genreIds.map((genre_id) => ({
              company_id: company.id,
              genre_id,
              is_human_approved: true,
              is_ai_suggested: false,
            }))
          );

        if (genresError) {
          console.error(
            `[biz/companies POST] ow_company_genres INSERT failed for ${company.id}:`,
            genresError.message
          );
        }
      }
    } catch (genreErr) {
      console.error("[biz/companies POST] ow_company_genres sync error:", genreErr);
    }
  }

  // 5.6 運営への新規企業通知（best-effort）
  try {
    await sendEmail(
      newCompanyAdminTemplate({
        companyName: company.name,
        companyId: company.id,
        creatorName: owUser?.name ?? user.email ?? "不明",
        creatorEmail: user.email ?? "",
        createdAt: company.created_at,
        isDuplicate: body.force_create ?? false,
      })
    );
  } catch (err) {
    console.error("[POST /api/biz/companies] admin notify failed:", err);
  }

  // 6. Cookie + Response
  const res = NextResponse.json(
    {
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        created_at: company.created_at,
        industry: company.industry,
        url: company.url,
        logo_url: company.logo_url,
      },
      redirect_to: `/biz/company?id=${company.id}`,
    },
    { status: 201 }
  );

  res.cookies.set("biz_current_company_id", company.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
