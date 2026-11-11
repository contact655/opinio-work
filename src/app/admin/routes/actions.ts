"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { parseHostInput, parseRouteInput } from "@/lib/constants/careerRoutes";

/**
 * ★転職ルートの運営操作（2026-11-11）。表は anon / authenticated に権限が無いので、書くのはここ（admin クライアント）だけ。
 *
 * ⚠️★各操作の先頭で auth_is_admin() を確かめる。Server Action は画面を経由せず直接呼べる（/admin/layout.tsx のガードに頼らない）。
 * ⚠️ 0行の更新を成功にしない（mutateOne）。
 */
export type RouteActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 運営かを確かめ、運営の ow_users.id を返す（承認した人の記録に使う） */
async function requireAdminOwUserId(): Promise<{ ok: true; owUserId: string | null } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: isAdmin, error } = await supabase.rpc("auth_is_admin");
  if (error) console.error("[admin/routes] auth_is_admin:", error.message);
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインし直してください" };
  const { data: me, error: meErr } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[admin/routes] me:", meErr.message);
  return { ok: true, owUserId: (me?.id as string | undefined) ?? null };
}

function done(): RouteActionResult {
  revalidatePath("/admin/routes");
  return { ok: true };
}

/** ルートを作る（id が null）・直す */
export async function saveRoute(id: string | null, input: unknown): Promise<RouteActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  const p = parseRouteInput(input);
  if (!p.ok) return { ok: false, error: p.message };
  const row = { slug: p.value.slug, from_label: p.value.fromLabel, to_label: p.value.toLabel, display_order: p.value.displayOrder, is_published: p.value.isPublished, updated_at: new Date().toISOString() };
  const db = createAdminClient();
  if (id !== null && !UUID_RE.test(id)) return { ok: false, error: "ルートが見つかりません" };
  const r = id === null
    ? await mutateOne(db.from("ow_career_routes").insert(row), "admin/routes insert")
    : await mutateOne(db.from("ow_career_routes").update(row).eq("id", id), "admin/routes update");
  if (!r.ok) return { ok: false, error: r.code === "23505" ? "その URL の名前はすでに使われています" : "保存に失敗しました" };
  return done();
}

/** 経験者を登録する。利用者はメールアドレス・username・id のどれかで指定する。登録した時点では掲載しない */
export async function addHost(routeId: string, userKey: string): Promise<RouteActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(routeId)) return { ok: false, error: "ルートが見つかりません" };
  const key = userKey.trim();
  if (!key) return { ok: false, error: "利用者のメールアドレス・username・id を入力してください" };
  const db = createAdminClient();
  const col = UUID_RE.test(key) ? "id" : key.includes("@") ? "email" : "username";
  const { data: users, error } = await db.from("ow_users").select("id").eq(col, key).limit(2);
  if (error) { console.error("[admin/routes] find user:", error.message); return { ok: false, error: "利用者の検索に失敗しました" }; }
  if (!users || users.length === 0) return { ok: false, error: "その利用者は見つかりませんでした" };
  if (users.length > 1) return { ok: false, error: "利用者が1人に決まりません。id で指定してください" };
  const r = await mutateOne(db.from("ow_route_hosts").insert({ route_id: routeId, user_id: users[0].id }), "admin/routes add host");
  if (!r.ok) return { ok: false, error: r.code === "23505" ? "この人はすでにこのルートに登録されています" : "登録に失敗しました" };
  return done();
}

/** 経験者の内容（転職した年・話せること・ひとこと・相談の受付）を直す */
export async function updateHost(hostId: string, input: unknown): Promise<RouteActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(hostId)) return { ok: false, error: "経験者が見つかりません" };
  const p = parseHostInput(input);
  if (!p.ok) return { ok: false, error: p.message };
  const r = await mutateOne(createAdminClient().from("ow_route_hosts").update({
    moved_year: p.value.movedYear, talk_tags: p.value.talkTags, message: p.value.message,
    accepting_consult: p.value.acceptingConsult, updated_at: new Date().toISOString(),
  }).eq("id", hostId), "admin/routes update host");
  if (!r.ok) return { ok: false, error: "保存に失敗しました" };
  return done();
}

/** 承認する（掲載する）・掲載をやめる。⚠️ やめても承認の記録（approved_at）は消さない */
export async function setHostListed(hostId: string, listed: boolean): Promise<RouteActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(hostId)) return { ok: false, error: "経験者が見つかりません" };
  const now = new Date().toISOString();
  const patch = listed
    ? { is_listed: true, approved_at: now, approved_by: auth.owUserId, updated_at: now }
    : { is_listed: false, updated_at: now };
  const r = await mutateOne(createAdminClient().from("ow_route_hosts").update(patch).eq("id", hostId), "admin/routes listed");
  if (!r.ok) return { ok: false, error: "切り替えに失敗しました" };
  return done();
}

/** 登録を消す（このルートの経験者から外す。プロフィールや職歴には触らない） */
export async function deleteHost(hostId: string): Promise<RouteActionResult> {
  const auth = await requireAdminOwUserId();
  if (!auth.ok) return auth;
  if (!UUID_RE.test(hostId)) return { ok: false, error: "経験者が見つかりません" };
  const r = await mutateOne(createAdminClient().from("ow_route_hosts").delete().eq("id", hostId), "admin/routes delete host");
  if (!r.ok) return { ok: false, error: "削除に失敗しました" };
  return done();
}
