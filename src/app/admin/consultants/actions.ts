"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { CONSULTANT_CONSENT_REQUIRED_MESSAGE, isRouteConsentMethod, parseConsultantInput } from "@/lib/constants/careerRoutes";

/**
 * ★相談できる人の運営操作（2026-11-12）。表は anon / authenticated に権限が無いので、書くのはここ（admin クライアント）だけ。
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
  revalidatePath("/people");
  return { ok: true };
}

async function readConsent(id: string): Promise<{ ok: true; isListed: boolean; consentConfirmedAt: string | null; consentMethod: string | null } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient().from("ow_featured_consultants")
    .select("is_listed, consent_confirmed_at, consent_method").eq("id", id).maybeSingle();
  if (error) { console.error("[admin/consultants] read:", error.message); return { ok: false, error: "読み込みに失敗しました" }; }
  if (!data) return { ok: false, error: "見つかりません" };
  return { ok: true, isListed: data.is_listed === true, consentConfirmedAt: (data.consent_confirmed_at as string | null) ?? null, consentMethod: (data.consent_method as string | null) ?? null };
}

/** 登録する。利用者はメールアドレス・username・id のどれかで指定する。登録した時点では載せない */
export async function addConsultant(userKey: string): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  const key = userKey.trim();
  if (!key) return { ok: false, error: "利用者のメールアドレス・username・id を入力してください" };
  const db = createAdminClient();
  const col = UUID_RE.test(key) ? "id" : key.includes("@") ? "email" : "username";
  const { data: users, error } = await db.from("ow_users").select("id").eq(col, key).limit(2);
  if (error) { console.error("[admin/consultants] find user:", error.message); return { ok: false, error: "利用者の検索に失敗しました" }; }
  if (!users || users.length === 0) return { ok: false, error: "その利用者は見つかりませんでした" };
  if (users.length > 1) return { ok: false, error: "利用者が1人に決まりません。id で指定してください" };
  const r = await mutateOne(db.from("ow_featured_consultants").insert({ user_id: users[0].id }), "admin/consultants add");
  if (!r.ok) return { ok: false, error: r.code === "23505" ? "この人はすでに登録されています" : "登録に失敗しました" };
  return done();
}

/** 内容（話せること・ひとこと・表示順・同意の記録）を直す */
export async function updateConsultant(id: string, input: unknown): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(id)) return { ok: false, error: "見つかりません" };
  const cur = await readConsent(id);
  if (!cur.ok) return cur;
  /* ⚠️ 載せている人は同意の記録を消せない（DB の CHECK でも止まる） */
  const p = parseConsultantInput(input, { isListed: cur.isListed });
  if (!p.ok) return { ok: false, error: p.message };
  const r = await mutateOne(createAdminClient().from("ow_featured_consultants").update({
    talk_tags: p.value.talkTags, message: p.value.message, display_order: p.value.displayOrder,
    consent_confirmed_at: p.value.consentConfirmedAt, consent_method: p.value.consentMethod,
    updated_at: new Date().toISOString(),
  }).eq("id", id), "admin/consultants update");
  if (!r.ok) return { ok: false, error: r.code === "23514" ? CONSULTANT_CONSENT_REQUIRED_MESSAGE : "保存に失敗しました" };
  return done();
}

/** 承認する（載せる）・載せるのをやめる。⚠️ やめても承認の記録（approved_at）は消さない */
export async function setConsultantListed(id: string, listed: boolean): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(id)) return { ok: false, error: "見つかりません" };
  if (listed) {
    const cur = await readConsent(id);
    if (!cur.ok) return cur;
    if (!cur.consentConfirmedAt || !isRouteConsentMethod(cur.consentMethod)) return { ok: false, error: CONSULTANT_CONSENT_REQUIRED_MESSAGE };
  }
  const now = new Date().toISOString();
  const patch = listed ? { is_listed: true, approved_at: now, approved_by: auth.owUserId, updated_at: now } : { is_listed: false, updated_at: now };
  const r = await mutateOne(createAdminClient().from("ow_featured_consultants").update(patch).eq("id", id), "admin/consultants listed");
  if (!r.ok) return { ok: false, error: r.code === "23514" ? CONSULTANT_CONSENT_REQUIRED_MESSAGE : "切り替えに失敗しました" };
  return done();
}

/** 登録を消す（プロフィールや職歴には触らない） */
export async function deleteConsultant(id: string): Promise<ConsultantActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(id)) return { ok: false, error: "見つかりません" };
  const r = await mutateOne(createAdminClient().from("ow_featured_consultants").delete().eq("id", id), "admin/consultants delete");
  if (!r.ok) return { ok: false, error: "削除に失敗しました" };
  return done();
}
