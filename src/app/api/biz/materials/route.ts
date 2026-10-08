import { NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { listMaterials } from "@/lib/companyMaterials/server";

export const dynamic = "force-dynamic";

/** GET /api/biz/materials — 自社の資料と項目（閲覧権限の担当者も可） */
export async function GET() {
  const a = await resolveMaterialsActor("view");
  if (!a.ok) return a.response;
  const data = await listMaterials(a.actor.companyId);
  /* ⚠️ 取れなかったときに空配列を返さない（「0件」と区別する） */
  if (!data) return NextResponse.json({ error: "資料を読み込めませんでした。" }, { status: 500 });
  return NextResponse.json(data);
}
