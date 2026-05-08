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
    .select("id, name, avatar_color, cover_color, visibility")
    .eq("auth_id", user.id)
    .maybeSingle();

  return (
    <ProfileEditClient
      owUser={owUser}
      authEmail={user.email ?? ""}
    />
  );
}
