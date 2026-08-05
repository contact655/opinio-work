"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCompanyJoinedRow } from "@/lib/feed/systemPosts";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * Server Action の戻り値。
 *
 * ⚠️ 例外を投げずに結果を返すこと。呼び出し元はクリックハンドラなので、
 *    throw すると unhandled rejection になって画面に何も出ない。
 *
 * ⚠️ supabase-js は失敗しても例外を投げず { error } を返す。
 *    2026-08-05 まで全アクションが戻り値を捨てており、
 *    「トグルは動いたように見えるが DB は変わっていない」状態を作っていた
 *    （未承認企業の掲載が CHECK 制約 check_published_requires_approval で
 *      23514 で弾かれても、画面もログも無反応だった）。
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Postgres のエラーを運営が読める日本語にする。原文も残す */
function toMessage(err: { code?: string; message: string }): string {
  if (err.code === "23514" && err.message.includes("check_published_requires_approval")) {
    return "運営の承認が済んでいないため掲載できません。先に「承認」を押してください。";
  }
  return `${err.message}${err.code ? `（${err.code}）` : ""}`;
}

const VALID_ENGAGEMENT = new Set(["none", "verified", "contracted"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ⚠️ 2026-08-05 時点、このアクションを呼ぶ UI は無い（一覧のドロップダウンは表示のみ）。
 *    engagement_status は判定にまったく使われていないのに、
 *    verified / none に変えると jobs_public を false に落とす副作用だけ持っていたため。
 *    効かないものに害だけあるので編集を止めた。カラムと関数は残してある。
 *    ⚠️ 復活させるなら、jobs_public を巻き添えにする下の1行を先に見直すこと。
 */
export async function updateEngagementStatus(
  companyId: string,
  newStatus: string,
  verifiedAt: string | null,
  contractedAt: string | null,
): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  if (!VALID_ENGAGEMENT.has(newStatus)) return { ok: false, error: "Invalid status" };
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { engagement_status: newStatus, updated_at: now };
  if (newStatus === "verified" && !verifiedAt) updates.verified_at = now;
  if (newStatus === "contracted" && !contractedAt) updates.contracted_at = now;
  if (newStatus === "none" || newStatus === "verified") updates.jobs_public = false;
  const { error } = await admin.from("ow_companies").update(updates).eq("id", companyId);
  if (error) {
    console.error("[updateEngagementStatus]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  revalidatePath("/admin/companies");
  return { ok: true };
}

/** 求人・面談CTAの表示可否。/jobs/[id] のカジュアル面談CTAを実際にゲートしている */
export async function updateJobsPublic(companyId: string, newValue: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_companies")
    .update({ jobs_public: newValue, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) {
    console.error("[updateJobsPublic]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  revalidatePath("/admin/companies");
  return { ok: true };
}

/**
 * 掲載（is_published）。承認とは別操作。
 *
 * ⚠️ 未承認（is_approved = false）の企業は CHECK 制約で弾かれる。
 *    エラーは呼び出し元に返すこと。握り潰すと「掲載中」と表示されたまま DB は非掲載になる。
 */
export async function updateIsPublished(companyId: string, newValue: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // published_at は「最初に公開した日時」。非掲載に戻しても消さない
  // （フィード投稿は残るので、公開した事実の記録を消すと突合できなくなる）。
  const updates: Record<string, unknown> = { is_published: newValue, updated_at: now };
  if (newValue) {
    const { data: cur } = await admin
      .from("ow_companies").select("published_at").eq("id", companyId).maybeSingle();
    if (!cur?.published_at) updates.published_at = now;
  }

  const { error } = await admin.from("ow_companies").update(updates).eq("id", companyId);
  if (error) {
    console.error("[updateIsPublished]", error.message);
    return { ok: false, error: toMessage(error) };
  }

  if (newValue) await insertCompanyJoined(companyId);

  revalidatePath("/admin/companies");
  return { ok: true };
}

/**
 * 掲載時に company_joined を作る。
 *
 * ⚠️ 2026-08-05 まで PATCH /api/biz/company の1箇所にしか無く、
 *    admin から公開してもフィードに何も出なかった。
 *
 * ⚠️ 本文と ref_* の埋め方は lib/feed/systemPosts に集約している。ここで組み立てない。
 * ⚠️ best-effort。失敗しても掲載自体は成功として扱う（突合スクリプトで後から作れる）。
 * ⚠️ 部分UNIQUEインデックス（idx_ow_posts_unique_company）があるので、
 *    非掲載に戻して再度掲載しても投稿は作り直されない。23505 は「既にある」なので無視する。
 *    つまり本文は最初に公開した瞬間の brand_name / tagline で固定される。
 */
async function insertCompanyJoined(companyId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: co } = await admin
      .from("ow_companies").select("name, brand_name, tagline").eq("id", companyId).maybeSingle();
    if (!co) return;
    const { error } = await admin.from("ow_posts").insert(buildCompanyJoinedRow(companyId, co));
    if (error && error.code !== "23505") console.error("[feed company_joined]", error.message);
  } catch (e) {
    console.error("[feed company_joined]", e);
  }
}

/**
 * 承認（is_approved）。運営が掲載を許すかどうか。
 *
 * ⚠️ is_published は触らない。承認は運営・掲載は企業側という役割分担を崩さないため
 *    （2026-08-05 に変更。それまで is_published も同時に立てていた）。
 * ⚠️ 承認の取り消しは実装しない。is_published = true の企業を未承認に戻すと、
 *    CHECK 制約に違反する行が既存行として残る（制約は更新時にしか効かない）。
 *    取り消しが要るなら、先に非掲載にする手順とセットで設計すること。
 */
export async function updateApproval(companyId: string): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_companies")
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) {
    console.error("[updateApproval]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  revalidatePath("/admin/companies");
  return { ok: true };
}

export async function updateSortOrder(items: { id: string; sort_order: number }[]): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const results = await Promise.all(
    items
      .filter((item) => UUID_RE.test(item.id))
      .map((item) =>
        admin.from("ow_companies").update({ sort_order: item.sort_order }).eq("id", item.id)
      )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("[updateSortOrder]", failed.error.message);
    return { ok: false, error: toMessage(failed.error) };
  }
  revalidatePath("/admin/companies");
  return { ok: true };
}
