import { createAdminClient } from "@/lib/supabase/admin";
import AdminJobsClient from "./AdminJobsClient";

/**
 * 求人審査（運営）。
 *
 * ⚠️ **読み取りはここ（サーバー）で createAdminClient を使う。**
 *    2026-08-11 まではクライアント側で `@/lib/supabase/client` から引いており、
 *    `ow_jobs` に運営ポリシー（auth_is_admin）が無いため
 *    **20件中13件が運営に見えていなかった**（すべて他社の draft）。
 *    「審査待ち0件」が本当に0なのか見えていないだけなのか区別できなかった。
 *
 * ⚠️ RLS を緩める案は採らない。ブラウザセッションから他社の下書きが取れる経路を
 *    増やすことになるため。/admin/meetings と同じ「サーバーで admin クライアント +
 *    書き込みは Server Action」に寄せている。
 *
 * ⚠️ /admin/layout.tsx が cookies() を呼ぶので、このページは自動的に動的。
 *    revalidate の宣言は不要（CLAUDE.md「レイアウト単位の保護」）。
 */
export default async function AdminJobsPage() {
  const supabase = createAdminClient();

  /* ⚠️ 職種の表示は標準職種名（ow_job_roles の主ロール）。運営面では会社呼称を使わない。
        会社ごとに違う名前で並ぶと、職種を横断して見られなくなる。
     ⚠️ job_category はクライアント側のキーワード検索が使っているので SELECT から外さない。 */
  const { data, error } = await supabase
    .from("ow_jobs")
    .select(
      "id, title, status, job_category, salary_min, salary_max, location, remote_work_status, work_style, source_url, is_test, rejection_reason, rejection_reviewer, submitted_at, created_at, updated_at, ow_companies(name), ow_job_roles!job_id(is_primary, ow_roles!role_id(name))"
    )
    .order("updated_at", { ascending: false });

  /* ⚠️ error を握り潰さない。空配列で「0件」を装うと、
        取得失敗と本当に0件の区別がつかなくなる。 */
  if (error) {
    console.error("[admin/jobs] ow_jobs", error.message);
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>求人審査</h1>
        <div role="alert" style={{
          marginTop: 16, background: "#FEE2E2", border: "1px solid #FCA5A5",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991B1B",
        }}>
          求人の取得に失敗しました: {error.message}
        </div>
      </div>
    );
  }

  return <AdminJobsClient initialJobs={(data ?? []) as unknown as Parameters<typeof AdminJobsClient>[0]["initialJobs"]} />;
}
