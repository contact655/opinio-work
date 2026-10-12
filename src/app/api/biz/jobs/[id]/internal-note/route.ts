import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getJobInternalNote } from "@/lib/jobs/internalNotes";
import { JOB_INTERNAL_NOTE_MAX } from "@/lib/constants/jobInternalNote";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★求人の社内メモ（2026-10-12）。GET で読む・PUT で保存（空なら消す）。
 * ⚠️ 書き込みはセッションのクライアント（RLS：その会社の現役の担当者だけ）。会社は getTenantContext で確かめる。
 * ⚠️ 求職者側からは呼ばない。求職者側の API・ページはこの表を読まない。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const note = await getJobInternalNote(ctx.tenantId, params.id);
  return NextResponse.json({ note });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => null) as { body?: unknown } | null;
  if (!json || typeof json.body !== "string") return NextResponse.json({ error: "本文がありません" }, { status: 400 });
  const body = json.body.trim();
  if (body.length > JOB_INTERNAL_NOTE_MAX) {
    return NextResponse.json({ error: `社内メモは${JOB_INTERNAL_NOTE_MAX.toLocaleString()}字までです` }, { status: 400 });
  }
  const supabase = createClient();
  /* ⚠️ 自社の求人か（RLS の WITH CHECK でも見るが、ここで先に 404 にする） */
  const { data: job, error: jErr } = await supabase.from("ow_jobs").select("id").eq("id", params.id).eq("company_id", ctx.tenantId).maybeSingle();
  if (jErr) { console.error("[internal-note] job:", jErr.message); return NextResponse.json({ error: "保存できませんでした" }, { status: 500 }); }
  if (!job) return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });

  if (!body) {
    const { error } = await supabase.from("ow_job_internal_notes").delete().eq("job_id", params.id).eq("company_id", ctx.tenantId);
    if (error) { console.error("[internal-note] delete:", error.message); return NextResponse.json({ error: "保存できませんでした" }, { status: 500 }); }
    return NextResponse.json({ note: null });
  }
  const { data: saved, error } = await supabase.from("ow_job_internal_notes")
    .upsert({ job_id: params.id, company_id: ctx.tenantId, body, updated_by: ctx.currentOwnId, updated_at: new Date().toISOString() }, { onConflict: "job_id" })
    .select("job_id");
  if (error || !saved || saved.length === 0) {
    console.error("[internal-note] upsert:", error?.message ?? "0 rows");
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ note: await getJobInternalNote(ctx.tenantId, params.id) });
}
