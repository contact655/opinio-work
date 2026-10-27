import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireCompanyAction, permissionDeniedResponse } from "@/lib/auth/permissions";
import { setCompanyListedBySelf } from "@/lib/companies/listing";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/company/listing — 企業ページを公開する／非公開にする（2026-10-28 / 柴さんの判断。公開は企業、停止は運営）
 *   body: { listed: boolean }
 * ⚠️ 管理者だけ（company.listingRequest。それまでの「掲載を依頼する」と同じ役割）。
 * ⚠️ 判定と書き込みは lib/companies/listing.ts（停止中・掲載規約の同意・必要な項目）。ここに条件を書かない。
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  try { requireCompanyAction(ctx.allMemberships, ctx.companyId, "company.listingRequest"); } catch { return permissionDeniedResponse(); }

  const body = (await req.json().catch(() => null)) as { listed?: unknown } | null;
  if (typeof body?.listed !== "boolean") return NextResponse.json({ error: "listed を指定してください" }, { status: 400 });

  const r = await setCompanyListedBySelf({ companyId: ctx.companyId, listed: body.listed, session: supabase, authUserId: user.id, owUserId: ctx.owUserId });
  if (!r.ok) return NextResponse.json({ error: r.error, missing: r.missing }, { status: r.status });
  return NextResponse.json({ ok: true });
}
