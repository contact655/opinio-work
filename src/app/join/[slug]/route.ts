import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOIN_COOKIE, JOIN_COOKIE_MAX_AGE, findJoinCompany } from "@/lib/companies/joinLink";

export const dynamic = "force-dynamic";

/**
 * ★会社の招待リンク（2026-10-12）。会社をクッキーに覚えて行き先へ送る。
 *   未ログイン → 新規登録（登録後はオンボーディングで「お勤め先」にこの会社が入っている）
 *   ログイン中・オンボーディング未完了 → オンボーディング
 *   ログイン中・完了済み → マイページで職歴の追加を、この会社が入った状態で開く
 * ⚠️ ここでは何も保存しない（記録は本人がオンボーディングに来たとき。お勤め先の保存は本人）。
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const company = await findJoinCompany(decodeURIComponent(params.slug));
  const origin = new URL(req.url).origin;
  if (!company) return NextResponse.redirect(new URL("/", origin));

  const { data: { user } } = await createClient().auth.getUser();
  let dest = "/auth?mode=signup&next=%2Fonboarding";
  if (user) {
    const { data: prof, error } = await createAdminClient().from("ow_profiles").select("onboarding_completed").eq("user_id", user.id).maybeSingle();
    if (error) console.error("[join] ow_profiles:", error.message);
    dest = prof?.onboarding_completed ? `/mypage?join=${company.id}` : "/onboarding";
  }
  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.set(JOIN_COOKIE, company.id, { path: "/", maxAge: JOIN_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://") });
  return res;
}
