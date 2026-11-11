"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { CONSULTANT_STOP_REASON_MAX } from "@/lib/constants/careerRoutes";

/**
 * ★相談可能なユーザーの運営操作（2026-11-12）。本人がマイページでオンにする形にしたので、運営は「止める・解除・消す」だけ。
 * ⚠️★各操作の先頭で auth_is_admin() を確かめる（Server Action は画面を経由せず直接呼べる）。
 * ⚠️ 0行の更新を成功にしない（mutateOne）。
 */
export type ConsultantActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdminOwUserId(): Promise<{ ok: true; owUserId: string | null } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: isAdmin, error } = await supabase.rpc("auth_is_admin");
  if (error) console.error("[admin/consultants] auth_is_admin:", error.message);
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインし直してください" };
  const { data: me, error: meErr } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[admin/consultants] me:", meErr.message);
  return { ok: true, owUserId: (me?.id as string | undefined) ?? null };
}

function done(): ConsultantActionResult {
  revalidatePath("/admin/consultants");
  return { ok: true };
}

/**
 * 止める（stop = true。理由は必須）・止めるのをやめる（stop = false）。
 * ⚠️ 止めると is_listed も倒す。解除しても自動では載らない（本人がもう一度オンにする）。
 */
export async function setConsultantStopped(id: string, stop: boolean, reason: string): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(id)) return { ok: false, error: "見つかりません" };
  const r0 = reason.trim();
  if (stop && !r0) return { ok: false, error: "止める理由を入れてください" };
  if (r0.length > CONSULTANT_STOP_REASON_MAX) return { ok: false, error: `理由は${CONSULTANT_STOP_REASON_MAX}字以内で入れてください` };
  const now = new Date().toISOString();
  const patch = stop
    ? { stopped_at: now, stopped_by: auth.owUserId, stop_reason: r0, is_listed: false, updated_at: now }
    : { stopped_at: null, stopped_by: null, stop_reason: null, updated_at: now };
  const r = await mutateOne(createAdminClient().from("ow_featured_consultants").update(patch).eq("id", id), "admin/consultants stop");
  if (!r.ok) return { ok: false, error: "切り替えに失敗しました" };
  return done();
}

/** 行を消す（プロフィールや職歴には触らない。本人はまたオンにできる） */
export async function deleteConsultant(id: string): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(id)) return { ok: false, error: "見つかりません" };
  const r = await mutateOne(createAdminClient().from("ow_featured_consultants").delete().eq("id", id), "admin/consultants delete");
  if (!r.ok) return { ok: false, error: "削除に失敗しました" };
  return done();
}
