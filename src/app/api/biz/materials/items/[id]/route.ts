import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { deleteItem, updateItem } from "@/lib/companyMaterials/server";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import {
  MATERIAL_CONTENT_MAX,
  MATERIAL_RESTRICTED_REASON_MAX,
  VALID_MATERIAL_CATEGORIES,
  type MaterialCategory,
} from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/biz/materials/items/[id] — 項目を直す・「選考に使ってはいけない内容」の印を付け外しする
 * （管理者権限のみ）
 *   { content?, category?, restricted?: { flag: boolean, reason?: string } }
 * ⚠️★本文か区分を直すと**確定が外れて内部のみに戻る**（`updateItem` の1か所で行う）。
 * ⚠️ 公開中だった項目に触れたら企業ページを作り直す（`revalidateCompanyPages`）。
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { content?: unknown; category?: unknown; restricted?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }

  const patch: Parameters<typeof updateItem>[2] = {};
  if (body.content !== undefined) {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "内容を入力してください。" }, { status: 400 });
    if (content.length > MATERIAL_CONTENT_MAX) {
      return NextResponse.json({ error: `内容は${MATERIAL_CONTENT_MAX}文字までです。` }, { status: 400 });
    }
    patch.content = content;
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !VALID_MATERIAL_CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: "区分が正しくありません。" }, { status: 400 });
    }
    patch.category = body.category as MaterialCategory;
  }
  if (body.restricted !== undefined) {
    const r = body.restricted as { flag?: unknown; reason?: unknown };
    if (typeof r?.flag !== "boolean") return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 });
    const reason = typeof r.reason === "string" ? r.reason.trim() : "";
    if (r.flag && !reason) return NextResponse.json({ error: "印を付ける理由を入力してください。" }, { status: 400 });
    if (reason.length > MATERIAL_RESTRICTED_REASON_MAX) {
      return NextResponse.json({ error: `理由は${MATERIAL_RESTRICTED_REASON_MAX}文字までです。` }, { status: 400 });
    }
    patch.restricted = { flag: r.flag, reason: r.flag ? reason : null };
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "変更がありません。" }, { status: 400 });

  const res = await updateItem(a.actor.companyId, params.id, patch);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.value.affectsPublic) await revalidateCompanyPages(a.actor.companyId);
  return NextResponse.json({ ok: true });
}

/** DELETE — 項目を消す（管理者権限のみ） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  const res = await deleteItem(a.actor.companyId, params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.value.affectsPublic) await revalidateCompanyPages(a.actor.companyId);
  return NextResponse.json({ ok: true });
}
