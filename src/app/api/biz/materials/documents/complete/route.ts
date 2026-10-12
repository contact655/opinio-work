import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { completeFileUpload } from "@/lib/companyMaterials/server";
import { MATERIAL_FILE_TYPES, MATERIAL_TITLE_MAX, MAX_MATERIAL_FILE_BYTES } from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

const ALLOWED_STORED_MIMES = Array.from(new Set(Object.values(MATERIAL_FILE_TYPES).map((t) => t.storedMime)));

/**
 * POST /api/biz/materials/documents/complete — 直接アップロードしたファイルを資料として登録する（管理者権限のみ。2026-10-12）
 *   { id, path, title } → { id }
 * ⚠️ パスがこの会社・この id の下か、実物の大きさ・種類が合うかは `completeFileUpload` が確かめる。
 */
export async function POST(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { id?: unknown; path?: unknown; title?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const path = typeof body.path === "string" ? body.path : "";
  const title = (typeof body.title === "string" ? body.title.trim() : "").slice(0, MATERIAL_TITLE_MAX);
  if (!id || !path || !title) return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 });
  const r = await completeFileUpload(a.actor.companyId, a.actor.owUserId, title, {
    id, path, maxBytes: MAX_MATERIAL_FILE_BYTES, allowedMimes: ALLOWED_STORED_MIMES,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ id: r.value.id }, { status: 201 });
}
