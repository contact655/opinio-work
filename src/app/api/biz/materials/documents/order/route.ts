import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { reorderDocuments } from "@/lib/companyMaterials/server";

export const dynamic = "force-dynamic";

/** PUT /api/biz/materials/documents/order — 資料一覧の並び順（管理者権限のみ。2026-10-12）。{ ids: 全件を上から順に } */
export async function PUT(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { ids?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 });
  }
  const r = await reorderDocuments(a.actor.companyId, body.ids as string[]);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
