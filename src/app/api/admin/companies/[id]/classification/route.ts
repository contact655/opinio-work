import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { isCapitalType, isCompanyStage, isHqCountry } from "@/lib/companies/classification";
import { setCompanyCustomerIndustries } from "@/lib/companies/setCustomerIndustries";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";

/**
 * PUT /api/admin/companies/[id]/classification — 分類の③④（運営。2026-10-12）
 *   body: { capital_type, hq_country, company_stage, customer_industry_ids, serves_consumers, customer_all_industries }
 * ⚠️ 業種は PUT /api/admin/companies/[id]、事業は …/business-domains が書く（画面の「保存する」が3本まとめて呼ぶ）。
 * ⚠️ 値の検証は企業側の反映（applyDraft.ts）と同じ関数。お客さまの入れ替えも同じ関数（setCompanyCustomerIndustries）。
 * ⚠️ is_foreign は capital_type に揃える（読み手を capital_type へ移すまで。段6）。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const cap = b.capital_type ?? null;
  const hq = b.hq_country ?? null;
  const stage = b.company_stage ?? null;
  if (cap !== null && !isCapitalType(cap)) return NextResponse.json({ error: "資本の値が不正です。" }, { status: 400 });
  if (hq !== null && !isHqCountry(hq)) return NextResponse.json({ error: "本社の国の値が不正です。" }, { status: 400 });
  if (stage !== null && !isCompanyStage(stage)) return NextResponse.json({ error: "事業ステージの値が不正です。" }, { status: 400 });
  const ids = Array.isArray(b.customer_industry_ids) ? b.customer_industry_ids : null;
  if (!ids || !ids.every((x): x is string => typeof x === "string" && UUID_RE.test(x))) {
    return NextResponse.json({ error: "お客さまの業界の形式が不正です。" }, { status: 400 });
  }
  const label = `PUT /api/admin/companies/${params.id}/classification`;

  const up = await mutateOne(
    createAdminClient().from("ow_companies").update({
      capital_type: cap as string | null,
      is_foreign: cap === "foreign_subsidiary",
      hq_country: cap === "foreign_subsidiary" ? (hq as string | null) : null,
      company_stage: stage as string | null,
    }).eq("id", params.id),
    label,
  );
  if (!up.ok) return NextResponse.json({ error: up.error }, { status: up.status });

  const r = await setCompanyCustomerIndustries(params.id, {
    industry_ids: ids, serves_consumers: b.serves_consumers === true, all_industries: b.customer_all_industries === true,
  }, label);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  await revalidateCompanyPages(params.id);
  return NextResponse.json({ success: true });
}
