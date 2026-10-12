"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne, mutateAllowNone } from "@/lib/supabase/mutate";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";

/**
 * ★企業が追加した事業の確認（運営。2026-10-12 / 柴さんの判断）。
 *   「そのまま採用する」… status='active'・is_active=true（業種は運営が決める）
 *   「既存の事業にまとめる（別名として残す）」… 会社の紐付けをまとめ先へ移し、名前をまとめ先の別名に足し、
 *        追加された行は status='merged'・merged_into・is_active=false（行は消さない）
 * ⚠️ 1社に同じ事業が2行にならないようにする（PK が (company_id, domain_id)）。主が外れたらまとめ先を主にする。
 */
type R = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function pendingRow(id: string) {
  const { data, error } = await createAdminClient().from("ow_business_domains").select("id, name, status").eq("id", id).maybeSingle();
  if (error) console.error("[admin business-domains]", error.message);
  return data && data.status === "pending" ? data : null;
}
async function touched(domainIds: string[]) {
  const { data } = await createAdminClient().from("ow_company_business_domains").select("company_id").in("domain_id", domainIds);
  for (const id of Array.from(new Set((data ?? []).map((r) => r.company_id as string)))) await revalidateCompanyPages(id);
  revalidateTag("business-domains");
  revalidatePath("/admin/business-domains");
}

export async function adoptDomain(domainId: string, industryId: string): Promise<R> {
  if (!(await isAdmin())) return { ok: false, error: "権限がありません。" };
  if (!UUID_RE.test(domainId) || !UUID_RE.test(industryId)) return { ok: false, error: "指定が正しくありません。" };
  if (!(await pendingRow(domainId))) return { ok: false, error: "確認待ちの事業が見つかりません。" };
  const db = createAdminClient();
  const { data: ind } = await db.from("ow_industries").select("id").eq("id", industryId).is("parent_id", null).is("retired_at", null).maybeSingle();
  if (!ind) return { ok: false, error: "業種（大分類）を選んでください。" };
  const r = await mutateOne(db.from("ow_business_domains").update({ status: "active", is_active: true, industry_id: industryId, display_kind: "search" }).eq("id", domainId), "adopt domain");
  if (!r.ok) return { ok: false, error: r.error };
  await db.from("ow_business_domain_proposals").update({ reviewed_at: new Date().toISOString() }).eq("domain_id", domainId);
  await touched([domainId]);
  return { ok: true };
}

export async function mergeDomain(domainId: string, targetId: string): Promise<R> {
  if (!(await isAdmin())) return { ok: false, error: "権限がありません。" };
  if (!UUID_RE.test(domainId) || !UUID_RE.test(targetId) || domainId === targetId) return { ok: false, error: "指定が正しくありません。" };
  const src = await pendingRow(domainId);
  if (!src) return { ok: false, error: "確認待ちの事業が見つかりません。" };
  const db = createAdminClient();
  const { data: target, error: tErr } = await db.from("ow_business_domains").select("id, aliases, status").eq("id", targetId).maybeSingle();
  if (tErr || !target || target.status !== "active") return { ok: false, error: "まとめ先の事業が見つかりません。" };

  const { data: links, error: lErr } = await db.from("ow_company_business_domains").select("company_id, domain_id, is_primary").in("domain_id", [domainId, targetId]);
  if (lErr) return { ok: false, error: "紐付けを確認できませんでした。" };
  for (const l of (links ?? []).filter((x) => x.domain_id === domainId)) {
    const both = (links ?? []).find((x) => x.company_id === l.company_id && x.domain_id === targetId);
    if (both) {
      const del = await mutateOne(db.from("ow_company_business_domains").delete().eq("company_id", l.company_id).eq("domain_id", domainId), "merge: 重複を消す", { returning: "company_id" });
      if (!del.ok) return { ok: false, error: del.error };
      if (l.is_primary) await mutateAllowNone(db.from("ow_company_business_domains").update({ is_primary: true }).eq("company_id", l.company_id).eq("domain_id", targetId), "merge: 主を移す", { returning: "company_id" });
    } else {
      const mv = await mutateOne(db.from("ow_company_business_domains").update({ domain_id: targetId }).eq("company_id", l.company_id).eq("domain_id", domainId), "merge: 付け替え", { returning: "company_id" });
      if (!mv.ok) return { ok: false, error: mv.error };
    }
  }
  const aliases = Array.from(new Set([...(((target.aliases as string[] | null) ?? [])), src.name as string]));
  const a = await mutateOne(db.from("ow_business_domains").update({ aliases }).eq("id", targetId), "merge: 別名");
  if (!a.ok) return { ok: false, error: a.error };
  const m = await mutateOne(db.from("ow_business_domains").update({ status: "merged", merged_into: targetId, is_active: false }).eq("id", domainId), "merge: 印");
  if (!m.ok) return { ok: false, error: m.error };
  await db.from("ow_business_domain_proposals").update({ reviewed_at: new Date().toISOString() }).eq("domain_id", domainId);
  await touched([targetId]);
  return { ok: true };
}
