import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone } from "@/lib/supabase/mutate";
import { parseMilestones } from "@/lib/companies/milestones";

/**
 * ★これまでの歩み（ow_company_milestones）を入れ替える（2026-11-27）。
 *   /biz の「変更を公開する」（applyCompanyDraft）と /admin の保存（PUT /api/admin/companies/[id]）が同じ関数を通る。
 *
 * ⚠️ 認可は呼び出し側で済ませること（admin クライアントで書く）。
 *    /biz は下書きのキーを会社の管理者だけが書ける（COMPANY_BASIC_DRAFT_KEYS）。/admin は requireAdmin。
 * ⚠️ 消す → 入れる の順。入れるのに失敗したら、その旨を返す（消したまま黙って成功にしない）。
 */
export async function replaceCompanyMilestones(
  companyId: string,
  raw: unknown,
  label: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = parseMilestones(raw);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const admin = createAdminClient();
  const del = await mutateAllowNone(
    admin.from("ow_company_milestones").delete().eq("company_id", companyId),
    `${label}（掃除）`,
  );
  if (!del.ok) return { ok: false, status: del.status, error: "これまでの歩みを保存できませんでした" };

  if (parsed.items.length === 0) return { ok: true };
  const { error } = await admin.from("ow_company_milestones").insert(
    parsed.items.map((m, i) => ({ company_id: companyId, year: m.year, month: m.month, event: m.event, sort_order: i })),
  );
  if (error) {
    console.error(`[${label}] insert:`, error.message);
    return { ok: false, status: 500, error: "これまでの歩みを保存できませんでした。もう一度お試しください" };
  }
  return { ok: true };
}
