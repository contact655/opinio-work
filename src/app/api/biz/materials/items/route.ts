import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { createItem } from "@/lib/companyMaterials/server";
import { MATERIAL_CONTENT_MAX, VALID_MATERIAL_CATEGORIES, type MaterialCategory } from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/materials/items — 項目を手入力で足す（管理者権限のみ）
 * ⚠️ 作った時点では**未確定・内部のみ**。求職者には出ない（確定は confirm で行う）。
 */
export async function POST(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { category?: unknown; content?: unknown; documentId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }

  const category = typeof body.category === "string" ? body.category : "";
  if (!VALID_MATERIAL_CATEGORIES.has(category)) return NextResponse.json({ error: "区分が正しくありません。" }, { status: 400 });
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "内容を入力してください。" }, { status: 400 });
  if (content.length > MATERIAL_CONTENT_MAX) {
    return NextResponse.json({ error: `内容は${MATERIAL_CONTENT_MAX}文字までです。` }, { status: 400 });
  }
  const documentId = typeof body.documentId === "string" && body.documentId ? body.documentId : null;

  const r = await createItem(a.actor.companyId, a.actor.owUserId, {
    category: category as MaterialCategory, content, documentId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ id: r.value.id }, { status: 201 });
}
