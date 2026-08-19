// GET /api/companies/batch?ids=slug1,uuid2,...
// 「最近見た企業」カード用: 複数の企業を一括取得する。
// ⚠️ **id でも slug でも受ける**（localStorage には slug が入っている）。

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { filterOpenCasualMeetingCompanies } from "@/lib/company/casualMeeting";
import { filterVisibleCompaniesStrict } from "@/lib/companies/visibility";

/* ⚠️ 2026-08-11 に edge を外した。面談バッジの判定に service role が要る
      （ow_users.email は anon から読めない）。 */

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ companies: [] });

  const idList = ids.split(",").filter(Boolean).slice(0, 10); // 最大10件
  if (idList.length === 0) return NextResponse.json({ companies: [] });

  /* ★**slug でも id でも受ける**（2026-08-20）。
     ⚠️ 呼び出し元（`RecentlyViewedTracker`）は `companySlug ?? companyId` を
        localStorage に入れているので、**実際に届くのはほぼ slug**。
        2026-08-20 まで `.in("id", idList)` で uuid として引いていたため
        **`22P02`（invalid input syntax for type uuid）で毎回 400**。
        `?? []` で受けていたので「最近見た企業」は**常に空**で、
        セクションごと出ていなかった（本番ログで確認）。
     ⚠️ **localStorage は作り直せない。** 既に slug が入っている利用者がいるので、
        記録側を uuid に変えるだけでは直らない。**受け側で両方受ける。** */
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidList = idList.filter((v) => UUID_RE.test(v));
  const slugList = idList.filter((v) => !UUID_RE.test(v));

  const supabase = createPublicClient();

  // 企業データ + 求人カウントを並列取得
  /* ⚠️ **error を捨てない**（2026-08-20 / 段階2）。ここは anon キー（`createPublicClient`）。
        `ow_users` は 2026-08-19 に anon の SELECT を**23列に絞った**ので、
        埋め込みに1列でも許可外を混ぜると **403 が丸ごと返る**。
        `?? []` で受けているため **「0件」として静かに素通りする**。
        CLAUDE.md「★403 は『0件』として静かに素通りする」参照。 */
  /* ⚠️ ここは**詳細の軸**（filterVisibleCompaniesStrict）。ディレクトリではない。
        この API は「最近見た企業」（RecentlyViewedSection）専用で、
        利用者が既に詳細ページに到達した企業を id 指定で引き直すだけ。
        ディレクトリ非掲載（listing_status='draft'）でも、自分の閲覧履歴から
        消えるほうが不自然なので listing_status では絞らない。 */
  let companyQuery = filterVisibleCompaniesStrict(
    supabase
      .from("ow_companies")
      .select(
        "id, slug, name, name_en, tagline, industry, funding_stage, employee_count, description, " +
        "accepting_casual_meetings, remote_work_status, location, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count"
      )
  );
  /* ⚠️ 片方が空のときに `in.()` を書かない。空の in は構文エラーで 400 になる。 */
  if (uuidList.length > 0 && slugList.length > 0) {
    companyQuery = companyQuery.or(`id.in.(${uuidList.join(",")}),slug.in.(${slugList.join(",")})`);
  } else if (uuidList.length > 0) {
    companyQuery = companyQuery.in("id", uuidList);
  } else {
    companyQuery = companyQuery.in("slug", slugList);
  }

  const { data: rawCompanies, error: companiesError } = await companyQuery;
  if (companiesError) console.error("[companies/batch] ow_companies:", companiesError.message);

  /* ⚠️ 求人と経歴は **uuid でしか引けない**（`company_id` は uuid 列）。
        受け取った値をそのまま渡さず、**上で解決した id** を使う。 */
  const resolvedIds = ((rawCompanies ?? []) as unknown as { id: string }[]).map((c) => c.id);

  /* ⚠️ **在籍メンバーはもう引かない**（2026-08-20）。理由は2つで、どちらも単独で十分。
        ① 唯一の呼び出し元 `RecentlyViewedSection` が `membersByCompany` を
           **一度も使っていない**（型注釈に名前が出るだけ）。
        ② そもそも anon には `ow_experiences` の SELECT が無いので**常に0件**。
        引いても捨てるだけの往復だったので、クエリごと外した。
        ⚠️ 復活させるなら `createAdminClient` が要る（面談バッジと同じ理由）。 */
  const { data: activeJobs, error: jobsError } = resolvedIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("ow_jobs")
        .select("company_id")
        .in("company_id", resolvedIds)
        .eq("status", "published").eq("is_test", false);

  if (jobsError) console.error("[companies/batch] ow_jobs:", jobsError.message);

  // 求人カウントマップ
  const jobCountMap: Record<string, number> = {};
  for (const j of activeJobs ?? []) {
    const cid = j.company_id as string;
    jobCountMap[cid] = (jobCountMap[cid] || 0) + 1;
  }

  /* ⚠️ DB のフラグをそのまま返さない（2026-08-11）。宛先が無ければ「面談」バッジを出さない。
        企業ページ側の判定（lib/company/casualMeeting.ts）と必ず同じ結論にすること。 */
  const meetingOpen = await filterOpenCasualMeetingCompanies(
    ((rawCompanies ?? []) as unknown as { id: string }[]).map((c) => c.id),
  );

  /* idList の順番を保持して返す。
     ⚠️ **キーは id と slug の両方**。受け取った値がどちらの形かは呼び出し元次第。 */
  const idOrder = new Map(idList.map((v, i) => [v, i] as [string, number]));
  const orderOf = (c: { id: string; slug?: string | null }) =>
    idOrder.get(c.id) ?? (c.slug ? idOrder.get(c.slug) : undefined) ?? 99;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companies = (rawCompanies ?? []).map((c: any) => ({
    /* ⚠️ `slug` を落とさない。呼び出し側は `/companies/${slug ?? id}` を組むので、
          落とすと**リンクが uuid になる**（動くが URL が読めなくなる）。 */
    id: c.id, slug: c.slug ?? null, name: c.name, name_en: c.name_en, tagline: c.tagline,
    industry: c.industry, funding_stage: c.funding_stage, employee_count: c.employee_count,
    description: c.description, accepting_casual_meetings: meetingOpen.has(c.id),
    remote_work_status: c.remote_work_status, location: c.location,
    logo_letter: c.logo_letter, logo_gradient: c.logo_gradient, logo_url: c.logo_url,
    updated_at: c.updated_at, current_member_count: c.current_member_count,
    obog_count: c.obog_count, job_count: jobCountMap[c.id] || 0,
  })).sort((a, b) => orderOf(a) - orderOf(b));

  return NextResponse.json(
    { companies },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
