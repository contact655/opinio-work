// GET /api/companies/batch?ids=uuid1,uuid2,...
// 最近見た企業カード表示用: 複数 ID の企業データ + 在籍メンバーを一括取得

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { filterOpenCasualMeetingCompanies } from "@/lib/company/casualMeeting";
import { filterVisibleCompaniesStrict } from "@/lib/companies/visibility";

/* ⚠️ 2026-08-11 に edge を外した。面談バッジの判定に service role が要る
      （ow_users.email は anon から読めない）。 */

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ companies: [], membersByCompany: {} });

  const idList = ids.split(",").filter(Boolean).slice(0, 10); // 最大10件
  if (idList.length === 0) return NextResponse.json({ companies: [], membersByCompany: {} });

  const supabase = createPublicClient();

  // 企業データ + 求人カウントを並列取得
  const [{ data: rawCompanies }, { data: activeJobs }, { data: experienceData }] =
    await Promise.all([
      /* ⚠️ ここは**詳細の軸**（filterVisibleCompaniesStrict）。ディレクトリではない。
            この API は「最近見た企業」（RecentlyViewedSection）専用で、
            利用者が既に詳細ページに到達した企業を id 指定で引き直すだけ。
            ディレクトリ非掲載（listing_status='draft'）でも、自分の閲覧履歴から
            消えるほうが不自然なので listing_status では絞らない。 */
      filterVisibleCompaniesStrict(
        supabase
        .from("ow_companies")
        .select(
          "id, slug, name, name_en, tagline, industry, funding_stage, employee_count, description, " +
          "accepting_casual_meetings, remote_work_status, location, logo_letter, logo_gradient, logo_url, updated_at, " +
          "current_member_count, obog_count"
        )
      ).in("id", idList),
      supabase
        .from("ow_jobs")
        .select("company_id")
        .in("company_id", idList)
        .eq("status", "published").eq("is_test", false),
      supabase
        .from("ow_experiences")
        .select("company_id, ow_users(id, name)")
        .eq("is_current", true)
        .in("company_id", idList),
    ]);

  // 求人カウントマップ
  const jobCountMap: Record<string, number> = {};
  for (const j of activeJobs ?? []) {
    const cid = j.company_id as string;
    jobCountMap[cid] = (jobCountMap[cid] || 0) + 1;
  }

  // メンバーマップ
  const membersByCompany: Record<string, { id: string; name: string }[]> = {};
  for (const exp of experienceData ?? []) {
    const cid = exp.company_id as string;
    if (!membersByCompany[cid]) membersByCompany[cid] = [];
    if (membersByCompany[cid].length < 8) {
      const raw = exp.ow_users;
      const u = (Array.isArray(raw) ? raw[0] : raw) as { id: string; name: string } | null;
      if (u) membersByCompany[cid].push({ id: u.id, name: u.name ?? "?" });
    }
  }

  /* ⚠️ DB のフラグをそのまま返さない（2026-08-11）。宛先が無ければ「面談」バッジを出さない。
        企業ページ側の判定（lib/company/casualMeeting.ts）と必ず同じ結論にすること。 */
  const meetingOpen = await filterOpenCasualMeetingCompanies(
    ((rawCompanies ?? []) as unknown as { id: string }[]).map((c) => c.id),
  );

  // idList の順番を保持して返す
  const idOrder = new Map(idList.map((id, i) => [id, i] as [string, number]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companies = (rawCompanies ?? []).map((c: any) => ({
    id: c.id, name: c.name, name_en: c.name_en, tagline: c.tagline,
    industry: c.industry, funding_stage: c.funding_stage, employee_count: c.employee_count,
    description: c.description, accepting_casual_meetings: meetingOpen.has(c.id),
    remote_work_status: c.remote_work_status, location: c.location,
    logo_letter: c.logo_letter, logo_gradient: c.logo_gradient, logo_url: c.logo_url,
    updated_at: c.updated_at, current_member_count: c.current_member_count,
    obog_count: c.obog_count, job_count: jobCountMap[c.id] || 0,
  })).sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99));

  return NextResponse.json(
    { companies, membersByCompany },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
