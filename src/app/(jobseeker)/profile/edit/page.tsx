import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditClient from "./ProfileEditClient";

export const metadata = { title: "設定 — Opinio" };

export default async function ProfileEditPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/profile/edit");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, visibility, location, birth_date, about_me, future_aspirations, social_links")
    .eq("auth_id", user.id)
    .maybeSingle();

  // スキルタグ + 学歴 + 資格 を並列取得（RLS select_all=true、認証不問で取得可）
  const [{ data: skillTagsRaw }, { data: educationsRaw }, { data: certificationsRaw }] = await Promise.all([
    owUser
      ? supabase
          .from("ow_user_skill_tags")
          .select("id, label, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_educations")
          .select("id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_certifications")
          .select("id, name, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
      initialSkillTags={skillTagsRaw ?? []}
      initialEducations={educationsRaw ?? []}
      initialCertifications={certificationsRaw ?? []}
      initialSocialLinks={(owUser?.social_links as Record<string, string> | null) ?? {}}
    />
  );
}
