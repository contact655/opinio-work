import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobseeker/companies/[id]/viewer-state
 *
 * 企業詳細ページの「閲覧者ごとに変わる状態」だけを返す。
 * ログイン状態 / ブックマーク済みか / フォロー済みか の3つ。
 *
 * ── なぜ作ったか（2026-08-09）────────────────────────────────────────────
 * これらは以前サーバー側で引いて props で渡していた。
 * そのために `/companies/[id]` が `auth.getUser()` を呼ぶ必要があり、
 * ページ全体が動的になって `export const revalidate = 60` が効かなかった。
 * 閲覧者依存の値をここに追い出すことで、ページ本体を閲覧者非依存にしていく。
 *
 * ⚠️ **未ログインでも 401 にしない。** ブックマークとフォローは付加機能で、
 *    未ログインの人には「まだ押していない状態」を返せば画面が成立する。
 *    401 にすると呼び出し側が毎回エラー処理を書くことになる。
 *
 * ⚠️ 返すのは**閲覧者自身の状態だけ**。他人の情報は1つも含めないこと。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, bookmarked: false, following: false });
  }

  // 閲覧者自身の ow_users.id（本人の行なので admin で引いても見える範囲は広がらない）
  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (meErr) {
    console.error("[viewer-state] user lookup", meErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!me?.id) {
    // auth はあるが ow_users が無い（招待直後など）。ログイン済みとしては扱う
    return NextResponse.json({ authenticated: true, bookmarked: false, following: false });
  }

  const owUserId = me.id as string;

  // 互いに独立なので1往復にまとめる
  const [bmarkRes, followRes] = await Promise.all([
    admin
      .from("ow_bookmarks")
      .select("id")
      .eq("user_id", owUserId)
      .eq("target_type", "company")
      .eq("target_id", params.id)
      .maybeSingle(),
    admin
      .from("ow_company_follows")
      .select("id")
      .eq("follower_user_id", owUserId)
      .eq("company_id", params.id)
      .maybeSingle(),
  ]);

  if (bmarkRes.error) console.error("[viewer-state] bookmark", bmarkRes.error.message);
  if (followRes.error) console.error("[viewer-state] follow", followRes.error.message);

  return NextResponse.json({
    authenticated: true,
    bookmarked: !!bmarkRes.data,
    following: !!followRes.data,
  });
}
