import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobs } from "@/lib/supabase/queries";
import { getDesiredRoles } from "@/lib/profile/desiredRoles";
import { computeRecommendations } from "@/lib/matching/scoreJob";
import { WORK_STYLE_LABELS } from "@/lib/constants/workStyle";
import { getCompanyConnections } from "@/lib/companies/connections";

/** ★/jobs の一番上の枠（JobsForYouPanel）に出す上位の件数。⚠️ 部品側の上限（3件）と揃える */
const PANEL_TOP = 3;

/** ★本人の希望を1行に畳む（「営業・CS ／ ハイブリッド ／ 年収 600万円〜」）。何も無ければ null */
function summarize(p: {
  roleNames: string[]; workStyles: string[] | null; salaryMin: number | null; salaryMax: number | null; phase: string[] | null;
}): string | null {
  const parts: string[] = [];
  if (p.roleNames.length) parts.push(p.roleNames.join("・"));
  if (p.workStyles?.length) parts.push(p.workStyles.map((w) => WORK_STYLE_LABELS[w] ?? w).join("・"));
  if (p.salaryMin || p.salaryMax) {
    parts.push(`年収 ${p.salaryMin ? `${p.salaryMin}万円` : ""}〜${p.salaryMax ? `${p.salaryMax}万円` : ""}`);
  }
  if (p.phase?.length) parts.push(p.phase.join("・"));
  return parts.length ? parts.join(" ／ ") : null;
}

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
  /* ★2026-10-20: /jobs の一番上の枠のために、理由・希望の要約・つながりの人数も返す。
        ⚠️ jobIds は残す（並び＝スコア降順）。求人の中身は返さない（呼び出し元が持っている） */
  if (!user) return NextResponse.json({ jobIds: [], reasons: {}, summary: null, connections: {} });

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

    const summary = summarize({
      roleNames: desired.names,
      workStyles: (profile?.desired_work_styles as string[] | null) ?? null,
      salaryMin: profile?.desired_salary_min ? Number(profile.desired_salary_min) : null,
      salaryMax: profile?.desired_salary_max ? Number(profile.desired_salary_max) : null,
      phase: (profile?.desired_phase as string[] | null) ?? null,
    });
    if (!summary) return NextResponse.json({ jobIds: [], reasons: {}, summary: null, connections: {} });

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

    /* ★つながり（相互フォロー・本人の同意あり。企業ページと同じ getCompanyConnections）を上位の会社だけ数える。
          ⚠️ 失敗（null）は 0 として扱い、行を出さないだけ（人数を推測しない） */
    const connections: Record<string, number> = {};
    const { data: me } = await admin.from("ow_users").select("id, is_test, is_system").eq("auth_id", user.id).maybeSingle();
    if (me && !me.is_test && !me.is_system) {
      const companyIds = Array.from(new Set(recs.slice(0, PANEL_TOP).map((r) => r.job.company_id)));
      const counts = await Promise.all(companyIds.map((cid) => getCompanyConnections(cid, me.id as string)));
      companyIds.forEach((cid, i) => { connections[cid] = counts[i]?.length ?? 0; });
    }

    return NextResponse.json({
      jobIds: recs.map((r) => r.job.id),
      reasons: Object.fromEntries(recs.map((r) => [r.job.id, r.reasonText])),
      summary,
      connections,
    });
  } catch (err) {
    /* ⚠️ 握り潰さずログに出す（CLAUDE.md「エラーと失敗を握りつぶさない原則」）。
          おすすめが出ないだけで求人一覧は見えるので、画面は空配列で続行する。 */
    console.error("[recommendations]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ jobIds: [], reasons: {}, summary: null, connections: {}, failed: true });
  }
}
