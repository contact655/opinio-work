import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * ★企業の退会の操作をした日から30日たった企業の、社内メモと社内の状態を消す（2026-10-10 / 段5）。
 * 日次（vercel.json）。中身は DB 関数 purge_withdrawn_company_candidate_notes()（service_role だけ）。
 * ⚠️ 担当者が全員無効になっても消さない（退会の操作が起点。柴さんの判断）。
 * ⚠️ フラグがオフでも動かす（消す処理は止める理由が無い。表が空なら0件で終わる）。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await createNoStoreAdminClient().rpc("purge_withdrawn_company_candidate_notes");
  if (error) {
    console.error("[cron/purge-candidate-notes]", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  console.log("[cron/purge-candidate-notes] 消した件数:", JSON.stringify(row));
  return Response.json({ ok: true, deleted: row });
}
