import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/isAdmin";
import { setCompanyBusinessDomains } from "@/lib/companies/setBusinessDomains";

/**
 * PUT /api/admin/companies/[id]/business-domains — 事業領域の入れ替え（運営）
 *
 * body: { domain_ids: string[], primary_domain_id: string | null }
 *
 * ⚠️★**検証・RPC・キャッシュ破棄はすべて `setCompanyBusinessDomains` の中**
 *    （2026-09-29 に共通化）。企業側（`PUT /api/biz/company/business-domains`）が
 *    同じ関数を呼ぶ。**ここに条件を書き戻さないこと** ——割れると
 *    「運営からは3件入るのに企業からは4件入る」のような食い違いになる。
 *
 * ⚠️ ここに残すのは**認可だけ。** 運営と企業で違うのはそこだけ。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { domain_ids?: unknown; primary_domain_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await setCompanyBusinessDomains(
    params.id, body, `PUT /api/admin/companies/${params.id}/business-domains`,
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({ success: true, count: res.count });
}
