import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { notify } from "@/lib/notify/email";
import { ambassadorInviteTemplate } from "@/lib/notify/templates";
import { NextRequest, NextResponse } from "next/server";
import { canUse } from "@/lib/constants/plans";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/invite
// Body: { user_id?: string; email?: string; role_title: string }
// user_id OR email のどちらかを指定する
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  /* ⚠️ **ゲートはここ（API側）。** /biz/members の画面でもボタンを無効化しているが、
        あれは見た目だけで、この判定を通らなければ意味がない。
        画面の分岐を消しても、ここが残っていれば守られる。逆は成り立たない。
     ⚠️ 金額は書かない（有料プランは未実装）。 */
  if (!canUse(ctx.planType, "ambassadorInvite")) {
    return NextResponse.json(
      { error: "「話せる人」の招待は有料プランの機能です。ご相談は contact@opinio.co.jp までご連絡ください。" },
      { status: 403 }
    );
  }

  let body: { user_id?: string; email?: string; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role_title = (body.role_title ?? "").trim() || "現場担当";

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // user_id または email からユーザーを特定
  type OwUserRow = { id: string; name: string | null; email: string | null; auth_id: string | null };
  let user_id = body.user_id;
  let owUser: OwUserRow | null = null;

  if (user_id) {
    const { data } = await adminSupabase
      .from("ow_users")
      .select("id, name, email, auth_id")
      .eq("id", user_id)
      .maybeSingle();
    owUser = data as OwUserRow | null;
  } else if (body.email) {
    const email = body.email.trim().toLowerCase();
    // ow_users.email で検索
    const { data: byEmail } = await adminSupabase
      .from("ow_users")
      .select("id, name, email, auth_id")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail) {
      owUser = byEmail as OwUserRow | null;
      user_id = owUser!.id;
    } else {
      // auth.users で検索（Supabase admin）
      const { data: authList } = await adminSupabase.auth.admin.listUsers();
      const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === email);
      if (authUser) {
        // ow_users が存在するか確認
        const { data: byAuthId } = await adminSupabase
          .from("ow_users")
          .select("id, name, email, auth_id")
          .eq("auth_id", authUser.id)
          .maybeSingle();
        if (byAuthId) {
          owUser = byAuthId as OwUserRow | null;
          user_id = owUser!.id;
        }
      }
    }

    if (!user_id) {
      return NextResponse.json(
        { error: "このメールアドレスのユーザーはOPINIOに登録されていません" },
        { status: 404 }
      );
    }
  } else {
    return NextResponse.json({ error: "user_id または email が必要です" }, { status: 400 });
  }

  // user_id 直接指定（管理者がOPINIO登録済みユーザーをトグルした場合）は即時公開
  const isDirectAdd = !!body.user_id;

  // 既に登録済みかチェック
  const { data: existing } = await adminSupabase
    .from("ow_company_members")
    .select("id, display_consent")
    .eq("company_id", ctx.tenantId)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    // user_id 直接指定で display_consent=false のまま残っている場合は即時公開に更新
    if (isDirectAdd && !existing.display_consent) {
      await adminSupabase
        .from("ow_company_members")
        .update({ display_consent: true, is_public: true })
        .eq("id", existing.id);
      revalidateCompanyAmbassadors(ctx.tenantId);
      return NextResponse.json({ id: existing.id, updated: true });
    }
    return NextResponse.json(
      { error: "この社員はすでに面談対応者に登録されています", id: existing.id },
      { status: 409 }
    );
  }

  // auth.users.id を取得（invited_by 用）
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // INSERT
  const { data: member, error } = await adminSupabase
    .from("ow_company_members")
    .insert({
      company_id: ctx.tenantId,
      user_id,
      display_consent: isDirectAdd,
      is_public: isDirectAdd,
      role_title: role_title.trim(),
      invited_at: new Date().toISOString(),
      invited_by: authUser?.id ?? null,
    })
    .select("id, invite_token")
    .single();

  if (error) {
    console.error("[ambassador invite] insert error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // email 招待の場合のみメール送信
  if (!isDirectAdd) {
    let email: string | null = owUser?.email ?? null;
    if (!email && owUser?.auth_id) {
      const { data: authData } = await adminSupabase.auth.admin.getUserById(owUser.auth_id);
      email = authData?.user?.email ?? null;
    }
    if (email) {
      await notify(
        ambassadorInviteTemplate({
          to: email,
          userName: owUser?.name ?? "ユーザー",
          companyName: ctx.tenantName ?? "",
          roleTitle: role_title.trim(),
          token: member.invite_token,
        })
      );
    }
  }

  revalidateCompanyAmbassadors(ctx.tenantId);
  return NextResponse.json({ id: member.id, invite_token: member.invite_token });
}
