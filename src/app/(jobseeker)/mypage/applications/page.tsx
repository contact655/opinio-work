import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobs } from "@/lib/supabase/queries";
import { getDesiredRoles } from "@/lib/profile/desiredRoles";
import { computeRecommendations } from "@/lib/matching/scoreJob";
import {
  fetchIndustryMatchBlocks,
  industryMatchReason,
} from "@/lib/companies/industryMatch";
import ApplicationsClient, {
  type Entry,
  type SuggestedCompany,
  type SuggestedJob,
} from "./ApplicationsClient";
import type { Metadata } from "next";

/* ⚠️ **ログイン後のページにもタイトルを付ける。** 付けないとサイト既定の
      「IT業界の転職・求人情報 | OPINIO」になり、**タブを何枚開いても全部同じ名前**で
      見分けがつかない。2026-08-20 の実測で /mypage 配下の3ページが該当した。
   ⚠️ `absolute` にする（ルートの template が `| OPINIO` を足すため）。 */
export const metadata: Metadata = {
  title: { absolute: "応募・面談 | OPINIO" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** おすすめに出す件数の上限。⚠️ 画面にハードコードしない */
const MAX_SUGGESTED_JOBS = 3;
const MAX_SUGGESTED_COMPANIES = 4;

export default async function ApplicationsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/applications");

  const admin = createAdminClient();
  const { data: owUser } = await admin
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();

  let entries: Entry[] = [];
  let suggestedJobs: SuggestedJob[] = [];
  let suggestedCompanies: SuggestedCompany[] = [];

  if (owUser) {
    /* ⚠️ ここから下、Supabase の呼び出しは `error` を必ず受けてログに出す（2026-08-29）。
          捨てると **RLS も GRANT も 400 も、すべて「0件」に化ける**。`?? []` で受けている
          側からは区別が付かず、画面には**節ごと消えたようにしか見えない**。
          ⚠️ `try/catch` では捕まらない。supabase-js はエラーを**戻り値**で返す。 */
    const [{ data: appRows, error: appErr }, { data: meetingRows, error: meetingErr }] =
      await Promise.all([
        admin
          .from("ow_job_applications")
          .select(
            `id, status, created_at,
            ow_jobs(id, slug, title,
              ow_companies(id, slug, name, logo_url, url)
            )`
          )
          .eq("user_id", owUser.id)
          .order("created_at", { ascending: false }),
        /* ★カジュアル面談（2026-09-13 追加）。
              ⚠️ それまで**求職者側のどの画面にも出ていなかった**。申し込んでも本人は
                 状態を確認できず、完了画面の「マイページで確認する →」は何も無い
                 `/mypage` を指していた。
              ⚠️ 埋め込みは `ow_companies!company_id` と**FK を明示する**。
                 この列は `ow_companies` のほかに集計ビュー2つへも張られていた
                 （`ow_business_monthly_stats` / `ow_business_todo_counts`。2026-09-22 に DROP 済み）。
                 ビューが増えればまた曖昧になるので、明示は外さないこと。
                 `ec60b5a0` で職歴側が同じ形で壊れている。 */
        admin
          .from("ow_casual_meetings")
          .select(
            `id, status, created_at, conversation_id,
            company:ow_companies!company_id(id, slug, name, logo_url, url),
            job:ow_jobs!job_id(id, slug, title)`
          )
          .eq("user_id", owUser.id)
          .order("created_at", { ascending: false }),
      ]);

    if (appErr) console.error("[mypage/applications] ow_job_applications:", appErr.message);
    if (meetingErr) console.error("[mypage/applications] ow_casual_meetings:", meetingErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobEntries: Entry[] = ((appRows ?? []) as any[]).map((r) => {
      const job = r.ow_jobs as Record<string, unknown> | null;
      const company = (job?.ow_companies ?? null) as Record<string, unknown> | null;
      return {
        kind: "job" as const,
        id: r.id as string,
        status: r.status as string,
        createdAt: r.created_at as string,
        company: company
          ? {
              id: company.id as string,
              slug: (company.slug as string | null) ?? null,
              name: (company.name as string) ?? "",
              logoUrl: (company.logo_url as string | null) ?? null,
              url: (company.url as string | null) ?? null,
            }
          : null,
        job: job
          ? { id: job.id as string, slug: (job.slug as string | null) ?? null, title: (job.title as string) ?? "" }
          : null,
        conversationId: null,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meetingEntries: Entry[] = ((meetingRows ?? []) as any[]).map((r) => {
      const company = r.company as Record<string, unknown> | null;
      const job = r.job as Record<string, unknown> | null;
      return {
        kind: "meeting" as const,
        id: r.id as string,
        status: r.status as string,
        createdAt: r.created_at as string,
        company: company
          ? {
              id: company.id as string,
              slug: (company.slug as string | null) ?? null,
              name: (company.name as string) ?? "",
              logoUrl: (company.logo_url as string | null) ?? null,
              url: (company.url as string | null) ?? null,
            }
          : null,
        job: job
          ? { id: job.id as string, slug: (job.slug as string | null) ?? null, title: (job.title as string) ?? "" }
          : null,
        conversationId: (r.conversation_id as string | null) ?? null,
      };
    });

    entries = [...jobEntries, ...meetingEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    /* ── おすすめ（2026-09-13 追加）────────────────────────────────────────
          ⚠️★**マッチ度%・星評価を出さない**（Hisato 思想⑦）。出すのは**理由の文**だけ。
          ⚠️★**出せるものが無ければセクションごと描かない。**「該当なし」も出さない
             （`IndustryMatchSection` と同じ扱い）。0件を「おすすめ」で埋めない。
          ⚠️ **既に申し込んだ相手は出さない。** 応募済みの求人と、面談を申し込んだ企業を除く。 */
    const appliedJobIds = new Set(entries.map((e) => e.job?.id).filter(Boolean) as string[]);
    const engagedCompanyIds = new Set(entries.map((e) => e.company?.id).filter(Boolean) as string[]);

    const [jobsResult, blocks] = await Promise.all([
      buildSuggestedJobs(user.id, appliedJobIds),
      /* ⚠️ 同じ関数を `/mypage` の右カラム（`IndustryMatchSection`）も呼ぶ。
            **意図的に同じ出どころを使っている** —— 会社の推薦ロジックを2つ持つと、
            片方だけ直る形の食い違いが生まれる。見せ方だけこちらで変える。 */
      fetchIndustryMatchBlocks(owUser.id),
    ]);

    suggestedJobs = jobsResult;
    suggestedCompanies = blocks
      .flatMap((b) =>
        b.companies.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          tagline: c.tagline,
          logoUrl: c.logoUrl,
          logoLetter: c.logoLetter,
          logoGradient: c.logoGradient,
          reason: industryMatchReason(c.matchedIndustryName),
        })),
      )
      .filter((c) => !engagedCompanyIds.has(c.id))
      .slice(0, MAX_SUGGESTED_COMPANIES);
  }

  return (
    <ApplicationsClient
      initialEntries={entries}
      suggestedJobs={suggestedJobs}
      suggestedCompanies={suggestedCompanies}
    />
  );
}

/**
 * 希望条件から出す「あなたに合いそうな募集」。
 *
 * ⚠️ `getJobs()` を使うこと。独自に select すると `roleIds`（祖先まで展開済み）が付かず、
 *    職種マッチが**常に外れる**（`/api/jobseeker/recommendations` と同じ注意）。
 * ⚠️ しきい値未満と「理由が作れないもの」は `computeRecommendations` が自分で落とす。
 *    **0件を呼び出し側で埋めない。**
 * ⚠️ `ow_profiles.user_id` は **auth.users.id**（ow_users.id ではない）。
 */
async function buildSuggestedJobs(
  authUserId: string,
  excludeJobIds: Set<string>,
): Promise<SuggestedJob[]> {
  try {
    const admin = createAdminClient();
    const [{ jobs, companies }, { data: profile, error: profErr }, desired] = await Promise.all([
      getJobs(),
      admin
        .from("ow_profiles")
        .select("desired_work_styles, desired_salary_min, desired_salary_max, desired_phase")
        .eq("user_id", authUserId)
        .maybeSingle(),
      getDesiredRoles(authUserId),
    ]);

    if (profErr) console.error("[mypage/applications] ow_profiles:", profErr.message);
    if (!profile && desired.ids.length === 0) return [];

    const phaseMap = new Map(
      companies.filter((c) => c.phase).map((c) => [c.id, c.phase as string]),
    );
    const companyById = new Map(companies.map((c) => [c.id, c]));

    const recs = computeRecommendations(
      jobs,
      phaseMap,
      {
        // ⚠️ 突き合わせは展開後（祖先込み）。表示は展開前の名前
        desired_role_ids: desired.expandedIds,
        desired_role_names: desired.names,
        desired_work_styles: (profile?.desired_work_styles as string[] | null) ?? null,
        desired_salary_min: profile?.desired_salary_min ? Number(profile.desired_salary_min) : null,
        desired_salary_max: profile?.desired_salary_max ? Number(profile.desired_salary_max) : null,
        desired_phase: (profile?.desired_phase as string[] | null) ?? null,
      },
      excludeJobIds,
    );

    return recs.slice(0, MAX_SUGGESTED_JOBS).map((r) => {
      const company = companyById.get(r.job.company_id);
      return {
        id: r.job.id,
        slug: r.job.slug ?? null,
        title: r.job.roleLabel ?? r.job.role,
        companyName: company?.name ?? "",
        companyLogoUrl: company?.logo_url ?? null,
        companyUrl: company?.url ?? null,
        reasonText: r.reasonText,
      };
    });
  } catch (err) {
    /* ⚠️ 握り潰さずログに出す。おすすめが出ないだけで一覧は見えるので空配列で続行する。 */
    console.error("[mypage/applications] おすすめ求人:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
