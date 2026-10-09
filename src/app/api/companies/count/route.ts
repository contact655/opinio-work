import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/search/companies";
import { companyFilterParams, type CompanyListQuery } from "@/lib/search/companyListParams";

/**
 * /companies の詳細検索（ドロワー）の「N社を表示」の件数（2026-10-09）。
 *
 * ⚠️★条件はページと同じ `companyFilterParams` を通し、同じ `searchCompanies` で数える。
 *    ここで条件を書き写さないこと。
 * ⚠️★取れなかったら 500 を返す。0 にしない（画面は「—」を出す）。
 * ⚠️ GET のルートハンドラは既定でキャッシュされる（CLAUDE.md）。条件ごとに変わるので動的にする。
 */
export const dynamic = "force-dynamic";

const KEYS = ["q", "phase", "workStyle", "hiring", "location", "industry", "target", "foreign", "talk", "size"] as const;

export async function GET(req: NextRequest) {
  const sp: CompanyListQuery = {};
  for (const k of KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) sp[k] = v.slice(0, 200);
  }
  try {
    /* ⚠️ 件数は並び替えに関係しないので sort は渡さない（既定の新着順で数える） */
    const { totalCount } = await searchCompanies(companyFilterParams(sp));
    return NextResponse.json({ count: totalCount });
  } catch (e) {
    console.error("[api/companies/count]", e);
    return NextResponse.json({ error: "count_failed" }, { status: 500 });
  }
}
