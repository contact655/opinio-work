import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { confirmItems } from "@/lib/companyMaterials/server";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { VALID_MATERIAL_VISIBILITIES, type MaterialVisibility } from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/** 一括確定の上限。⚠️ 1回の操作で触る件数を抑える（1件ずつ UPDATE するため） */
const MAX_CONFIRM = 200;

/**
 * POST /api/biz/materials/items/confirm — 区分を決めて確定する（管理者権限のみ）
 *   { items: [{ id, visibility }] }   1件でも複数（一括確定）でも同じ形
 * ⚠️ 「公開」を含む確定のあとは企業ページを作り直す（`revalidateCompanyPages`）。
 */
export async function POST(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { items?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "確定する項目を選んでください。" }, { status: 400 });
  }
  if (body.items.length > MAX_CONFIRM) {
    return NextResponse.json({ error: `一度に確定できるのは${MAX_CONFIRM}件までです。` }, { status: 400 });
  }
  const entries: { id: string; visibility: MaterialVisibility }[] = [];
  for (const raw of body.items as { id?: unknown; visibility?: unknown }[]) {
    if (typeof raw?.id !== "string" || typeof raw.visibility !== "string" || !VALID_MATERIAL_VISIBILITIES.has(raw.visibility)) {
      return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 });
    }
    entries.push({ id: raw.id, visibility: raw.visibility as MaterialVisibility });
  }

  const res = await confirmItems(a.actor.companyId, a.actor.owUserId, entries);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.value.affectsPublic) await revalidateCompanyPages(a.actor.companyId);
  return NextResponse.json({ confirmed: res.value.confirmed });
}
