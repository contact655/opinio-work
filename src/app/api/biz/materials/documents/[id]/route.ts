import { NextRequest, NextResponse } from "next/server";
import { resolveMaterialsActor } from "@/lib/companyMaterials/access";
import { deleteDocument, renameDocument, signedUrlForDocument } from "@/lib/companyMaterials/server";
import { MATERIAL_TITLE_MAX } from "@/lib/constants/companyMaterials";

export const dynamic = "force-dynamic";

/**
 * GET /api/biz/materials/documents/[id] — ファイルの短時間の署名 URL を返す（閲覧権限も可）
 * ⚠️ バケットは非公開・クライアント向けのポリシー0本。**ファイルを開く経路はこれだけ。**
 * ⚠️ 会社の一致は `signedUrlForDocument` が `company_id` で確かめる（他社の id では 404）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await resolveMaterialsActor("view");
  if (!a.ok) return a.response;
  const r = await signedUrlForDocument(a.actor.companyId, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ url: r.value.url });
}

/** DELETE — 資料を消す（管理者権限のみ）。⚠️ 項目は残る（document_id が外れるだけ） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  const r = await deleteDocument(a.actor.companyId, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

/** PATCH — 資料名を変える（管理者権限のみ。2026-10-12）。{ title } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await resolveMaterialsActor("edit");
  if (!a.ok) return a.response;
  let body: { title?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "資料名を入力してください。" }, { status: 400 });
  if (title.length > MATERIAL_TITLE_MAX) return NextResponse.json({ error: `資料名は${MATERIAL_TITLE_MAX}字までです。` }, { status: 400 });
  const r = await renameDocument(a.actor.companyId, params.id, title);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
