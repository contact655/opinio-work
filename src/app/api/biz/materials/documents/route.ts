import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { createFileDocument, createUrlDocument } from "@/lib/companyMaterials/server";
import {
  MAX_MATERIAL_FILE_BYTES,
  MATERIAL_TITLE_MAX,
  isAllowedMaterialUrl,
  resolveMaterialFileType,
} from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/materials/documents — 資料を登録する（管理者権限のみ）
 *   multipart/form-data … file（＋任意の title）
 *   application/json    … { url, title }
 *
 * ⚠️★1a では**中身を読まない**。ファイルは Storage に置くだけ、URL はリンクとして保存するだけ
 *    （サーバーから URL を取りに行かない。SSRF 対策ごと 1b）。
 * ⚠️ ファイルは**拡張子と MIME の両方**で検査する（`resolveMaterialFileType`）。
 */
export async function POST(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  const { companyId, owUserId } = a.actor;

  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "ファイルがありません。" }, { status: 400 });
    if (file.size <= 0) return NextResponse.json({ error: "空のファイルは登録できません。" }, { status: 400 });
    if (file.size > MAX_MATERIAL_FILE_BYTES) {
      return NextResponse.json({ error: "ファイルは10MBまでです。" }, { status: 400 });
    }
    const type = resolveMaterialFileType(file.name, file.type);
    if (!type) {
      return NextResponse.json({ error: "登録できるのは PDF / Word（docx）/ PowerPoint（pptx）/ テキスト（txt・md）だけです。" }, { status: 400 });
    }
    const rawTitle = String(form.get("title") ?? "").trim() || file.name;
    const title = rawTitle.slice(0, MATERIAL_TITLE_MAX);
    const r = await createFileDocument(companyId, owUserId, title, {
      name: file.name, storedMime: type.storedMime, bytes: await file.arrayBuffer(),
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ id: r.value.id }, { status: 201 });
  }

  let body: { url?: unknown; title?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isAllowedMaterialUrl(url)) {
    return NextResponse.json({ error: "URL は http:// または https:// で始まるものだけ登録できます。" }, { status: 400 });
  }
  const title = (typeof body.title === "string" && body.title.trim() ? body.title.trim() : url).slice(0, MATERIAL_TITLE_MAX);
  const r = await createUrlDocument(companyId, owUserId, title, url);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ id: r.value.id }, { status: 201 });
}
