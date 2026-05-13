import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";

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
      url: body.website || null,
      logo_url: body.logo_url || null,
      status: "draft",
      plan: "free",
    })
    .select("id, name, status, created_at, industry, url, logo_url")
    .single();

  if (companyError || !company) {
    console.error("[POST /api/biz/companies] INSERT failed:", companyError?.message);
    return NextResponse.json(
      { error: `企業登録に失敗しました: ${companyError?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // 5. ow_company_admins INSERT（作成者を最初の admin として登録）
  const { data: owUser, error: owUserError } = await admin
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (owUserError || !owUser) {
    console.error("[POST /api/biz/companies] ow_users not found:", user.id);
    // ow_users が見つからない場合も company は作成済みなのでエラーにしない
    // ただし admin 登録はできないためログに記録
  } else {
    const { error: adminError } = await admin
      .from("ow_company_admins")
      .insert({
        user_id: owUser.id,
        company_id: company.id,
        permission: "admin",
        is_active: true,
      });

    if (adminError && adminError.code !== "23505") {
      console.error("[POST /api/biz/companies] ow_company_admins INSERT failed:", adminError.message);
    }
  }

  console.log("[POST /api/biz/companies] SUCCESS:", company.id, name);

  // 5.5 運営への新規企業通知（best-effort）
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
  });

  return res;
}
