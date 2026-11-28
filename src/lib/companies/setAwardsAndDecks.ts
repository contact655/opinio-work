import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone } from "@/lib/supabase/mutate";
import { parseAwards } from "@/lib/companies/awards";
import { parseDecks } from "@/lib/companies/companyDecks";

type Result = { ok: true } | { ok: false; status: number; error: string };

/**
 * ★受賞・認定（ow_company_awards）を入れ替える（2026-11-28）。/biz の「変更を公開する」（applyCompanyDraft）が通る。
 * ⚠️ 認可は呼び出し側で済ませること（admin クライアントで書く）。下書きのキーは会社の管理者だけが書ける（COMPANY_BASIC_DRAFT_KEYS）。
 * ⚠️ 消す → 入れる の順。入れるのに失敗したら、その旨を返す（消したまま黙って成功にしない）。
 */
export async function replaceCompanyAwards(companyId: string, raw: unknown, label: string): Promise<Result> {
  const parsed = parseAwards(raw);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const admin = createAdminClient();
  const del = await mutateAllowNone(admin.from("ow_company_awards").delete().eq("company_id", companyId), `${label}（掃除）`);
  if (!del.ok) return { ok: false, status: del.status, error: "受賞・認定を保存できませんでした" };
  if (parsed.items.length === 0) return { ok: true };
  const { error } = await admin.from("ow_company_awards").insert(
    parsed.items.map((a, i) => ({ company_id: companyId, name: a.name, issuer: a.issuer, year: a.year, url: a.url, sort_order: i })),
  );
  if (error) {
    console.error(`[${label}] insert:`, error.message);
    return { ok: false, status: 500, error: "受賞・認定を保存できませんでした。もう一度お試しください" };
  }
  return { ok: true };
}

/**
 * ★会社紹介資料（ow_company_external_links の type='deck'）を入れ替える（2026-11-28）。
 * ⚠️ deck の行だけを消して入れ直す。運営が入れた記事・SNS などの行（type が deck 以外）には触らない。
 */
export async function replaceCompanyDecks(companyId: string, raw: unknown, label: string): Promise<Result> {
  const parsed = parseDecks(raw);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const admin = createAdminClient();
  const del = await mutateAllowNone(
    admin.from("ow_company_external_links").delete().eq("company_id", companyId).eq("type", "deck"),
    `${label}（掃除）`,
  );
  if (!del.ok) return { ok: false, status: del.status, error: "会社紹介資料を保存できませんでした" };
  if (parsed.items.length === 0) return { ok: true };
  const { error } = await admin.from("ow_company_external_links").insert(
    parsed.items.map((d, i) => ({
      company_id: companyId, type: "deck", title: d.title, url: d.url,
      created_by_role: "company", is_published: true, sort_order: i,
    })),
  );
  if (error) {
    console.error(`[${label}] insert:`, error.message);
    return { ok: false, status: 500, error: "会社紹介資料を保存できませんでした。もう一度お試しください" };
  }
  return { ok: true };
}
