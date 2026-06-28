import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileStartClient from "./ProfileStartClient";

export const metadata = { title: { absolute: "プロフィールを公開する | OPINIO" } };

export default async function ProfileStartPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/profile/start");

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, about_me, profile_setup_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  // 既に完了済みならマイページへ
  if (owUser?.profile_setup_at) {
    redirect("/mypage");
  }

  const { data: skillTags } = await supabase
    .from("ow_user_skill_tags")
    .select("id, label, sort_order")
    .eq("user_id", owUser?.id ?? "")
    .order("sort_order", { ascending: true })
    .limit(3);

  return (
    <ProfileStartClient
      initialName={(owUser?.name as string | null) ?? ""}
      initialAboutMe={(owUser?.about_me as string | null) ?? ""}
      initialSkills={(skillTags ?? []).map((t) => t.label as string)}
    />
  );
}
