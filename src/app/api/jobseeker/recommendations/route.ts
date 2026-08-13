import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobs } from "@/lib/supabase/queries";
import { getDesiredRoles } from "@/lib/profile/desiredRoles";
import { computeRecommendations } from "@/lib/matching/scoreJob";

export const dynamic = "force-dynamic";

/**
 * ログイン中ユーザーへの「あなたへのおすすめ」求人。
 *
 * ── なぜページから切り出したか（2026-08-13）────────────────────────────────
 * これは元々 `/jobs` のサーバーコンポーネントで計算していた。**そのために
 * ページ全体が `force-dynamic` になり、未ログインの訪問者を含む全員が
 * 毎回サーバー関数の起動（コールドスタート 2〜4秒）を負担していた。**
 * 求人一覧そのものは全員同じなので、パーソナライズだけをここへ出して
 * ページ側を ISR に載せた。
 *
 * ⚠️ **求人の中身は返さない。返すのは `jobIds` だけ。**
 *    呼び出し元（JobsClient）は既に全求人を持っているので、
 *    求人オブジェクトを返すと同じデータを2回運ぶことになる。
 *
 * ⚠️ **未ログインでも 200 と空配列を返す**（401 にしない）。
 *    ここは認可の境界ではなく「出すものが無い」だけ。
 *    呼び出し側はログイン中しか叩かないが、叩かれても壊れない形にしておく。
 *
 * ⚠️ `getJobs()` を使うこと。独自に select しない。
 *    `roleIds`（祖先まで展開済み）が付かず職種マッチが常に外れる
 *    （CLAUDE.md「週次メール」の項に同じ趣旨の警告がある）。
 *
 * ⚠️ しきい値未満と「理由が作れないもの」は `computeRecommendations` が
 *    自分で落とす。**0件を呼び出し側で埋めないこと**
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ jobIds: [] });

  try {
    const admin = createAdminClient();

    // ow_profiles.user_id = auth.users.id（直接 auth UUID）
    const [{ jobs, companies }, { data: profile }, desired] = await Promise.all([
      getJobs(),
      admin
        .from("ow_profiles")
        .select("desired_work_styles, desired_salary_min, desired_salary_max, desired_phase")
        .eq("user_id", user.id)
        .maybeSingle(),
      getDesiredRoles(user.id),
    ]);

    if (!profile && desired.ids.length === 0) return NextResponse.json({ jobIds: [] });

    const scoringProfile = {
      // ⚠️ 突き合わせは展開後（祖先込み）。表示は展開前の名前
      desired_role_ids: desired.expandedIds,
      desired_role_names: desired.names,
      desired_work_styles: (profile?.desired_work_styles as string[] | null) ?? null,
      desired_salary_min: profile?.desired_salary_min ? Number(profile.desired_salary_min) : null,
      desired_salary_max: profile?.desired_salary_max ? Number(profile.desired_salary_max) : null,
      desired_phase: (profile?.desired_phase as string[] | null) ?? null,
    };

    const phaseMap = new Map(
      companies.filter((c) => c.phase).map((c) => [c.id, c.phase as string])
    );

    const recs = computeRecommendations(jobs, phaseMap, scoringProfile);
    return NextResponse.json({ jobIds: recs.map((r) => r.job.id) });
  } catch (err) {
    /* ⚠️ 握り潰さずログに出す（CLAUDE.md「エラーと失敗を握りつぶさない原則」）。
          おすすめが出ないだけで求人一覧は見えるので、画面は空配列で続行する。 */
    console.error("[recommendations]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ jobIds: [] });
  }
}
