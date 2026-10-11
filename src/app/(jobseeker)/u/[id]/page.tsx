import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserProfileContent, resolveUserId, IS_UUID } from "@/components/profile/view/UserProfileContent";

/* ★中身（データの取得・見せてよいかの判定・描画）は `components/profile/view/UserProfileContent.tsx` に切り出した
      （2026-10-11。候補者を探す・メッセージの右欄が同じ関数を使うため）。ここはページの入口だけ。 */

export async function generateMetadata({ params }: { params: { id: string } }) {
  const resolved = await resolveUserId(params.id);
  if (!resolved) return { title: { absolute: "プロフィール | OPINIO" } };
  const supabase = createClient();
  const { data } = await supabase.from("ow_users").select("name").eq("id", resolved.resolvedId).maybeSingle();
  const title = data ? `${data.name} | OPINIO` : "プロフィール | OPINIO";
  const canonicalId = resolved.username ?? resolved.resolvedId;
  return {
    title: { absolute: title },
    alternates: { canonical: `/u/${canonicalId}` },
    openGraph: { title },
    robots: { index: false, follow: false },
  };
}

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  // Phase 1: username or UUID → resolvedId
  const resolved = await resolveUserId(params.id);
  if (!resolved) notFound();

  const { resolvedId, username: profileUsername } = resolved;

  // UUID → username redirect (308)
  if (IS_UUID.test(params.id) && profileUsername) {
    permanentRedirect(`/u/${profileUsername}`);
  }

  return <UserProfileContent resolvedId={resolvedId} profileUsername={profileUsername} />;
}
