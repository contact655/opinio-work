import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/companies";

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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth`);
}
