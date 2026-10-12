"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateMany } from "@/lib/supabase/mutate";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { isCompanyStage, isHqCountry } from "@/lib/companies/classification";

/**
 * ★分類の一括設定（運営。2026-10-12 / 提案A）。チェックを入れた会社に、まとめて値を付ける。
 * ⚠️ 初期値（IT → ソフトウェア・SaaS、従業員数からの候補）は画面に出すだけ。**ここは押された値しか書かない。**
 * ⚠️ 会社 id は画面から来た配列をそのまま信じない（uuid の形・実在・検証用でないことを確かめる）。
 * ⚠️ 公開・掲載の状態には触らない。
 */
export type BulkResult = { ok: true; count: number } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function targetIds(ids: string[]): Promise<string[] | string> {
  if (!(await isAdmin())) return "権限がありません。";
  const clean = Array.from(new Set(ids.filter((x) => UUID_RE.test(x))));
  if (clean.length === 0) return "会社を選んでください。";
  if (clean.length > 200) return "一度に200社までです。";
  const { data, error } = await createAdminClient().from("ow_companies").select("id").in("id", clean).eq("is_test", false);
  if (error) { console.error("[bulk classification] 会社の確認:", error.message); return "会社を確認できませんでした。"; }
  if ((data ?? []).length !== clean.length) return "選んだ会社に、見つからない会社か検証用の会社が含まれています。";
  return clean;
}

async function done(ids: string[]): Promise<void> {
  for (const id of ids) await revalidateCompanyPages(id);
  revalidatePath("/admin/companies/classification");
}

/** 業種（小分類）を付ける。⚠️ 小分類だけ（大分類は個別に） */
export async function bulkSetIndustry(companyIds: string[], industryId: string): Promise<BulkResult> {
  const ids = await targetIds(companyIds);
  if (typeof ids === "string") return { ok: false, error: ids };
  const { data: ind, error } = await createAdminClient().from("ow_industries").select("id, parent_id").eq("id", industryId).is("retired_at", null).maybeSingle();
  if (error || !ind) return { ok: false, error: "業種を確認できませんでした。" };
  if (!ind.parent_id) return { ok: false, error: "小分類を選んでください。" };
  const r = await mutateMany(createAdminClient().from("ow_companies").update({ industry_id: industryId }).in("id", ids), "bulk industry");
  if (!r.ok) return { ok: false, error: r.error };
  await done(ids);
  return { ok: true, count: ids.length };
}

export async function bulkSetStage(companyIds: string[], stage: string): Promise<BulkResult> {
  const ids = await targetIds(companyIds);
  if (typeof ids === "string") return { ok: false, error: ids };
  if (!isCompanyStage(stage)) return { ok: false, error: "事業ステージの値が不正です。" };
  const r = await mutateMany(createAdminClient().from("ow_companies").update({ company_stage: stage }).in("id", ids), "bulk stage");
  if (!r.ok) return { ok: false, error: r.error };
  await done(ids);
  return { ok: true, count: ids.length };
}

/** 本社の国。⚠️ 外資系（capital_type = foreign_subsidiary）の会社だけに付ける */
export async function bulkSetHqCountry(companyIds: string[], code: string): Promise<BulkResult> {
  const ids = await targetIds(companyIds);
  if (typeof ids === "string") return { ok: false, error: ids };
  if (!isHqCountry(code)) return { ok: false, error: "国の値が不正です。" };
  const db = createAdminClient();
  const { data: foreign, error } = await db.from("ow_companies").select("id").in("id", ids).eq("capital_type", "foreign_subsidiary");
  if (error) return { ok: false, error: "会社を確認できませんでした。" };
  if ((foreign ?? []).length !== ids.length) return { ok: false, error: "外資系でない会社が含まれています（本社の国は外資系の会社だけに付けます）。" };
  const r = await mutateMany(db.from("ow_companies").update({ hq_country: code }).in("id", ids), "bulk hq");
  if (!r.ok) return { ok: false, error: r.error };
  await done(ids);
  return { ok: true, count: ids.length };
}
