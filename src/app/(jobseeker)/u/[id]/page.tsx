import { notFound, permanentRedirect, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  /* ★★検索エンジンに出すのは公開範囲が「公開」の人だけ（2026-10-18）。
        検証用・システム・本人未登録（auth_id なし）は「公開」でも出さない。
     ⚠️ 判定は admin で引く（閲覧者がログインしているかに関係なく、同じ答えにするため） */
  const { data: v, error: vErr } = await createAdminClient()
    .from("ow_users").select("visibility, is_test, is_system, auth_id").eq("id", resolved.resolvedId).maybeSingle();
  if (vErr) console.error("[u/[id] metadata] visibility:", vErr.message);
  const indexable = !!v && v.visibility === "public" && !v.is_test && !v.is_system && !!v.auth_id;
  return {
    title: { absolute: title },
    alternates: { canonical: `/u/${canonicalId}` },
    openGraph: { title },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
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

  /* ★★ログインしていない人が「公開」以外の人のページを開いたら、ログインへ送る（2026-10-18）。
        それまでは middleware が `/u/` を丸ごとログイン必須にしていた。そこを外したので、ここで同じ動きにする
        （404 にすると、共有されたリンクを開いた人がログインすれば見られることに気づけない）。
     ⚠️ 判定は session クライアント（RLS）。「公開」以外の行は未ログインには返らない。
     ⚠️ この下に loading.tsx の境界は無いので redirect は 307 になる（ソフト200にならない） */
  const supabase = createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();
  if (!viewer) {
    const { data: visible } = await supabase.from("ow_users").select("id").eq("id", resolvedId).maybeSingle();
    if (!visible) redirect(`/auth?next=${encodeURIComponent(`/u/${params.id}`)}`);
  }

  return <UserProfileContent resolvedId={resolvedId} profileUsername={profileUsername} />;
}
