import { createAdminClient } from "@/lib/supabase/admin";
import AdminCompaniesClient, { type Company, type CompanyAdmin } from "./AdminCompaniesClient";
import { findPublishBlockers } from "@/lib/companies/publishable";

/**
 * 企業審査（運営）。
 *
 * ⚠️ **読み取りはここ（サーバー）で createAdminClient を使う。**
 *    2026-08-11 まではクライアント側で引いており、`ow_jobs` と
 *    `ow_company_admins` に運営ポリシー（auth_is_admin）が無いため、
 *    実測で **ow_jobs 13件・ow_company_admins 4件**が運営に見えていなかった。
 *    求人数と担当者の列が実際より少なく出ていた。
 *
 * ⚠️ /admin/layout.tsx が cookies() を呼ぶのでこのページは自動的に動的。
 */
export default async function AdminCompaniesPage() {
  const supabase = createAdminClient();

  const [
    { data: companyRows, error: cErr },
    { data: jobRows, error: jErr },
    { data: adminRows, error: aErr },
    { data: userRows, error: uErr },
  ] = await Promise.all([
    supabase
      .from("ow_companies")
      /* ⚠️ `target_industry_scope`（軸2の3値）も取る。運営がここを埋めていく作業画面なので、
            未確認が何社あるかが一目で分かる必要がある（2026-09-04 追加）。 */
      /* ⚠️ `source`（どの入口から作られたか）も取る。利用者が経歴入力から作った企業を
            運営が見つける唯一の入口がこの一覧なので（2026-09-05 追加）。 */
      .select("id, slug, name, brand_name, industry, location, employee_count, is_published, is_approved, accepting_casual_meetings, listing_status, engagement_status, jobs_public, verified_at, contracted_at, created_at, updated_at, sort_order, logo_url, url, target_industry_scope, is_test, source")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    supabase.from("ow_jobs").select("company_id"),
    supabase.from("ow_company_admins").select("company_id, user_id, is_active"),
    supabase.from("ow_users").select("id, name"),
  ]);

  /* ⚠️ error を握り潰さない。空配列で「0件」を装うと、
        取得失敗と本当に0件の区別がつかなくなる。 */
  const firstError = cErr ?? jErr ?? aErr ?? uErr;
  if (firstError) {
    console.error("[admin/companies]", firstError.message);
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>企業審査</h1>
        <div role="alert" style={{
          marginTop: 16, background: "#FEE2E2", border: "1px solid #FCA5A5",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991B1B",
        }}>
          企業の取得に失敗しました: {firstError.message}
        </div>
      </div>
    );
  }

  const jobCountMap = new Map<string, number>();
  for (const j of jobRows ?? []) {
    const cid = j.company_id as string;
    jobCountMap.set(cid, (jobCountMap.get(cid) ?? 0) + 1);
  }

  const userNameMap = new Map<string, string>(
    (userRows ?? []).map((u) => [u.id as string, (u.name as string) ?? "不明"])
  );

  const adminMap = new Map<string, CompanyAdmin[]>();
  for (const row of adminRows ?? []) {
    // ⚠️ user_id が null の行は「保留中の招待」であって担当者ではない。
    //    数に入れると、まだ誰も紐付いていない企業が自走できるように見える（2026-08-05）。
    if (!row.user_id) continue;
    const cid = row.company_id as string;
    if (!adminMap.has(cid)) adminMap.set(cid, []);
    adminMap.get(cid)!.push({
      name: userNameMap.get(row.user_id as string) ?? "不明",
      isActive: row.is_active as boolean,
    });
  }

  /* ⚠️ **公開中なのに掲載の条件を満たしていない企業**を洗い出す（2026-08-25）。
        公開ゲート（checkPublishable）は**切り替え操作しか見ない**ので、
        ゲートを入れる前から公開されている違反は誰も検知できない
        （実例: 株式会社データプール — 公開中・事業領域なし）。
     ⚠️ 判定は `findPublishBlockers` に任せる。条件をここに書き写さない
        （ゲートと一覧で食い違うと、直したのに警告が消えない／その逆が起きる）。
     ⚠️ 対象は**公開中の企業だけ**。下書きは「これから直すもの」なので警告にしない。 */
  const publishedIds = ((companyRows ?? []) as unknown as Company[])
    .filter((c) => c.is_published || c.listing_status === "listed")
    .map((c) => c.id);
  const blockers = await findPublishBlockers(publishedIds);
  // ⚠️ null は取得失敗。空 Map（＝違反0件）と区別して、画面にもそう出す
  const blockersFailed = blockers === null;

  const companies: Company[] = ((companyRows ?? []) as unknown as Company[]).map((c) => ({
    ...c,
    job_count: jobCountMap.get(c.id) ?? 0,
    admins: adminMap.get(c.id) ?? [],
    publish_blockers: blockers?.get(c.id) ?? [],
  }));

  return <AdminCompaniesClient initialCompanies={companies} blockersFailed={blockersFailed} />;
}
