import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { notify } from "@/lib/notify/email";
import { ambassadorInviteTemplate } from "@/lib/notify/templates";
import { NextRequest, NextResponse } from "next/server";
import { canUse } from "@/lib/constants/plans";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { newInviteRow } from "@/lib/companyMembers/invite";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/invite
// Body: { user_id?: string; email?: string; role_title: string }
// user_id OR email のどちらかを指定する
// ★どちらの指定でも「本人への依頼」を作るだけ。公開は本人の承諾後（lib/companyMembers/invite.ts）
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "employees.manage")) {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  /* ⚠️ **ゲートはここ（API側）。** /biz/members の画面でもボタンを無効化しているが、
        あれは見た目だけで、この判定を通らなければ意味がない。
        画面の分岐を消しても、ここが残っていれば守られる。逆は成り立たない。
     ⚠️ 金額は書かない（有料プランは未実装）。 */
  if (!canUse(ctx.planType, "ambassadorInvite")) {
    return NextResponse.json(
      { error: "面談対応者の招待は有料プランの機能です。ご相談は contact@opinio.co.jp までご連絡ください。" },
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

  /* ★★user_id で指定されても、メールで指定されても、**作るのは「本人への依頼」だけ**（2026-10-15）。
        公開（display_consent=true）は本人が `/mypage/ambassador-invite/[token]` で承諾したときだけ。
        値は `lib/companyMembers/invite.ts` の `newInviteRow` に置いてある。**ここで書き換えないこと。**
     ⚠️ 2026-10-15 まで、user_id 指定は `display_consent=true / is_public=true` で即時公開し、
        メールも送っていなかった（画面のトーストは「招待メールを送信しました」だった）。 */

  /* ★user_id 指定は、この会社に在籍中（is_current）の人に限る。
        画面（/biz/members）の候補も同じ条件で出しているが、そちらは見た目だけ。
        ここを外すと、id を知っている任意の利用者に招待メールを送れてしまう。 */
  if (body.user_id) {
    const { data: currentExp, error: expErr } = await adminSupabase
      .from("ow_experiences")
      .select("id")
      .eq("user_id", user_id)
      .eq("company_id", ctx.tenantId)
      .eq("is_current", true)
      .limit(1);
    if (expErr) {
      console.error("[ambassador invite] ow_experiences:", expErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if ((currentExp ?? []).length === 0) {
      return NextResponse.json(
        { error: "この会社に在籍中の職歴がある方だけ招待できます" },
        { status: 409 },
      );
    }
  }

  // 既に行があるかチェック
  const { data: existing, error: existingErr } = await adminSupabase
    .from("ow_company_members")
    .select("id, display_consent")
    .eq("company_id", ctx.tenantId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (existingErr) {
    console.error("[ambassador invite] existing:", existingErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ★既に行があれば、状態に関わらず**何も書き換えない**。
        本人がまだ承諾していない（招待中）／自分でOFFにした（paused）行を、
        企業の操作で公開に戻すことはしない。 */
  if (existing) {
    return NextResponse.json(
      {
        error: existing.display_consent
          ? "この社員はすでに面談対応者に登録されています"
          : "すでに招待しています。本人の承諾をお待ちください",
        id: existing.id,
      },
      { status: 409 }
    );
  }

  // auth.users.id を取得（invited_by 用）
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // INSERT（本人への依頼だけ。公開はしない）
  const { data: member, error } = await adminSupabase
    .from("ow_company_members")
    .insert(
      newInviteRow({
        companyId: ctx.tenantId,
        userId: user_id,
        roleTitle: role_title.trim(),
        invitedByAuthId: authUser?.id ?? null,
        now: new Date().toISOString(),
      })
    )
    .select("id, invite_token")
    .single();

  if (error) {
    console.error("[ambassador invite] insert error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ★本人に承諾を依頼するメール。user_id 指定でも送る（承諾の入口がこれしかないため）
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
  } else {
    console.error("[ambassador invite] 招待先のメールアドレスが引けなかった（行は招待中のまま）:", member.id);
  }

  revalidateCompanyAmbassadors(ctx.tenantId);
  return NextResponse.json({ id: member.id, invite_token: member.invite_token });
}
