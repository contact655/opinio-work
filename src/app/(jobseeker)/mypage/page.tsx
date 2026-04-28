import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageClient from "./MypageClient";

export const metadata = { title: "マイページ — Opinio" };

export default async function MypagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, about_me, age_range, location, social_links, is_mentor")
    .eq("auth_id", user.id)
    .maybeSingle();

  return <MypageClient owUser={owUser} />;
}
