import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★求人の社内メモ（2026-10-12）。**求職者には一切出さない。** 表は ow_job_internal_notes（ow_jobs とは別）。
 *
 * ⚠️★求職者側のコード（app/(jobseeker)・lib/supabase/queries.ts・求人の API・sitemap・JSON-LD）からこのファイルを読まないこと。
 * ⚠️ 読み書きの権限は RLS（その会社の現役の担当者）。ここ（admin）で読むときは、呼ぶ側が会社を確かめてから company_id で絞る。
 */
export type JobInternalNote = { body: string; updatedAt: string; updatedByName: string | null };

/** 会社の求人ごとのメモ（一覧の印に使う）。取れなければ空 */
export async function listJobInternalNotes(companyId: string): Promise<Map<string, string>> {
  const { data, error } = await createAdminClient()
    .from("ow_job_internal_notes").select("job_id, body").eq("company_id", companyId);
  if (error) { console.error("[jobInternalNotes] list:", error.message); return new Map(); }
  return new Map((data ?? []).map((r) => [r.job_id as string, r.body as string]));
}

/** 求人1件のメモ。⚠️ companyId は呼ぶ側で確かめた自社の id。無ければ null */
export async function getJobInternalNote(companyId: string, jobId: string): Promise<JobInternalNote | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_job_internal_notes")
    .select("body, updated_at, updated_by").eq("company_id", companyId).eq("job_id", jobId).maybeSingle();
  if (error) { console.error("[jobInternalNotes] get:", error.message); return null; }
  if (!data) return null;
  let name: string | null = null;
  if (data.updated_by) {
    const { data: u } = await db.from("ow_users").select("name").eq("id", data.updated_by as string).maybeSingle();
    name = (u?.name as string | null) ?? null;
  }
  return { body: data.body as string, updatedAt: data.updated_at as string, updatedByName: name };
}

/** 複製のとき、元の求人のメモを新しい求人へ写す（無ければ何もしない） */
export async function copyJobInternalNote(companyId: string, fromJobId: string, toJobId: string, byOwUserId: string | null): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_job_internal_notes").select("body").eq("company_id", companyId).eq("job_id", fromJobId).maybeSingle();
  if (error) { console.error("[jobInternalNotes] copy read:", error.message); return; }
  if (!data) return;
  const ins = await db.from("ow_job_internal_notes").insert({ job_id: toJobId, company_id: companyId, body: data.body, updated_by: byOwUserId });
  if (ins.error) console.error("[jobInternalNotes] copy write:", ins.error.message);
}
