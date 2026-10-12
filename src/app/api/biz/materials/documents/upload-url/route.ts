import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { createFileUploadUrl } from "@/lib/companyMaterials/server";
import { MAX_MATERIAL_FILE_BYTES, resolveMaterialFileType } from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/materials/documents/upload-url — ファイルをブラウザから Storage へ直接置く準備（管理者権限のみ。2026-10-12）
 *   { name, size, type } → { id, path, signedUrl, storedMime }
 * ⚠️ ファイルの中身はこの関数を通さない（Vercel の関数は 4.5MB まで。資料は 10MB まで）。
 * ⚠️ 置いたあと `/complete` を呼ぶまで資料にはならない。完了時に Storage 上の実物の大きさと種類をもう一度確かめる。
 */
export async function POST(req: NextRequest) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { name?: unknown; size?: unknown; type?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name : "";
  const size = typeof body.size === "number" ? body.size : -1;
  const type = typeof body.type === "string" ? body.type : "";
  if (!name) return NextResponse.json({ error: "ファイルがありません。" }, { status: 400 });
  if (size <= 0) return NextResponse.json({ error: "空のファイルは登録できません。" }, { status: 400 });
  if (size > MAX_MATERIAL_FILE_BYTES) return NextResponse.json({ error: "ファイルは10MBまでです。" }, { status: 400 });
  const t = resolveMaterialFileType(name, type);
  if (!t) {
    return NextResponse.json({ error: "登録できるのは PDF / Word（docx）/ PowerPoint（pptx）/ テキスト（txt・md）だけです。" }, { status: 400 });
  }
  const r = await createFileUploadUrl(a.actor.companyId, name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ...r.value, storedMime: t.storedMime });
}
