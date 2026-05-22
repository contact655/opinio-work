import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addUserRole } from "@/lib/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset
  const isBiz = searchParams.get("biz") === "1"; // biz側からのOAuth
  const next = searchParams.get("next") ?? (isBiz ? "/biz/dashboard" : "/companies");

  if (code) {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      // ow_users レコードが存在するか確認（トリガーで自動作成されるはず）
      const { data: owUser } = await supabase
        .from("ow_users")
        .select("id, name")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (!owUser) {
        // トリガーが動かなかった場合のフォールバック: 手動作成
        await supabase.from("ow_users").insert({
          auth_id: session.user.id,
          email: session.user.email,
          name:
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0] ||
            "ユーザー",
          visibility: "public",
        });
      }

      // パスワードリセットフローはそのまま update-password へ
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }

      // biz側からのOAuth: ダッシュボードへリダイレクト（role登録・onboarding不要）
      if (isBiz) {
        return NextResponse.redirect(`${origin}/biz/dashboard`);
      }

      // role='candidate' を best-effort で登録（重複は無視）
      await addUserRole(supabase, "candidate").catch(() => {});

      // onboarding_completed チェック: 未完了のユーザーはオンボーディングへ
      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        const onboardingNext = next !== "/companies" ? next : "/companies";
        return NextResponse.redirect(
          `${origin}/onboarding?next=${encodeURIComponent(onboardingNext)}`
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth`);
}
