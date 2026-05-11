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

  // スキルタグ + 学歴 + 資格 + 実績 + 受賞 + メディア掲載 を並列取得
  const [
    { data: skillTagsRaw },
    { data: educationsRaw },
    { data: certificationsRaw },
    { data: achievementsRaw },
    { data: awardsRaw },
    { data: mediaAppearancesRaw },
  ] = await Promise.all([
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
          .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
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
    owUser
      ? supabase
          .from("ow_user_achievements")
          .select("id, title, value, unit, description, period_start, period_end, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_awards")
          .select("id, title, issuer, awarded_at, description, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    owUser
      ? supabase
          .from("ow_user_media_appearances")
          .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
          .eq("user_id", owUser.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
      initialSkillTags={skillTagsRaw ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEducations={(educationsRaw ?? []) as any}
      initialCertifications={certificationsRaw ?? []}
      initialSocialLinks={(owUser?.social_links as Record<string, string> | null) ?? {}}
      initialAchievements={achievementsRaw ?? []}
      initialAwards={awardsRaw ?? []}
      initialMediaAppearances={mediaAppearancesRaw ?? []}
    />
  );
}
