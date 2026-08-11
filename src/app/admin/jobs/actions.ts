"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 運営操作の戻り値。**形は admin/companies/actions.ts と同じにしてある。**
 *
 * ⚠️ throw しない。Server Action で throw すると unhandled rejection になり
 *    画面に何も出ない。必ず戻り値で返して呼び出し側が出す。
 * ⚠️ supabase-js は失敗しても例外を投げず `{ error }` を返す。
 *    2026-08-11 まで、この4つのアクションは戻り値を捨てていた。
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(err: { code?: string; message: string } | null | undefined): ActionResult {
  if (!err) return { ok: true };
  return { ok: false, error: `${err.message}${err.code ? `（${err.code}）` : ""}` };
}

/**
 * ⚠️ **0行更新を成功として扱わない。**
 *    2026-08-11 まで求人詳細ページがブラウザ側クライアントで直接 UPDATE しており、
 *    `ow_jobs` に運営ポリシー（auth_is_admin）が無いため
 *    **他社の求人では常に0行更新**だった。error も出ないので成功に見えていた。
 *    ここは admin クライアントなので RLS は効かないが、
 *    id の綴り違いなどで0行になる可能性は残るため必ず件数を見る。
 */
function requireOneRow(rows: unknown[] | null, jobId: string): ActionResult {
  if (!rows || rows.length === 0) {
    return { ok: false, error: `対象の求人が見つかりませんでした（id: ${jobId}）` };
  }
  return { ok: true };
}

export async function approveJob(jobId: string): Promise<ActionResult> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "求人IDが不正です" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin.from("ow_jobs").update({
    status: "published",
    published_at: now,
    updated_at: now,
    rejection_reason: null,
    rejection_reviewer: null,
    rejection_date: null,
  }).eq("id", jobId).select("id");   // ⚠️ 列を絞る。引数なしの .select() は全列を返す
  if (error) return fail(error);
  const rowCheck = requireOneRow(data, jobId);
  if (!rowCheck.ok) return rowCheck;
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

export async function rejectJob(
  jobId: string,
  reason: string,
  reviewer: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "求人IDが不正です" };
  if (!reason.trim()) return { ok: false, error: "差し戻し理由を入力してください" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const dateLabel = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const { data, error } = await admin.from("ow_jobs").update({
    status: "rejected",
    rejection_reason: reason.slice(0, 1000),
    rejection_reviewer: (reviewer || "OPINIO編集部").slice(0, 100),
    rejection_date: dateLabel,
    updated_at: now,
  }).eq("id", jobId).select("id");
  if (error) return fail(error);
  const rowCheck = requireOneRow(data, jobId);
  if (!rowCheck.ok) return rowCheck;
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

export async function privateJob(jobId: string): Promise<ActionResult> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "求人IDが不正です" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_jobs")
    .update({ status: "private", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("id");
  if (error) return fail(error);
  const rowCheck = requireOneRow(data, jobId);
  if (!rowCheck.ok) return rowCheck;
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

export async function republishJob(jobId: string): Promise<ActionResult> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "求人IDが不正です" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_jobs")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("id");
  if (error) return fail(error);
  const rowCheck = requireOneRow(data, jobId);
  if (!rowCheck.ok) return rowCheck;
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

/**
 * 求人の職種タグを差し替える（運営用）。
 *
 * ── なぜ運営に編集手段が要るか（2026-08-06）────────────────────────────────
 * 既存の公開求人18件のうち11件は職種タグが大分類のままで、求職者面の職種表示が
 * 「営業」「カスタマーサクセス」と粗くなっている。原因は migration 147/166 が
 * role_category_id に大分類の UUID を入れ、それが ow_job_roles にコピーされたこと。
 * ところが**直す手段がどこにも無かった**。
 * `/biz/jobs/[id]/edit` はその企業の admin である必要があり（requireAdmin）、
 * 対象6社のうち5社は担当者0名。ADMIN 側にも編集手段が無かった。
 *
 * ⚠️ 会社呼称（company_job_role_id）はここでは触らない。
 *    呼称は企業のものなので、運営が代わりに付けると出どころが分からなくなる。
 *
 * ⚠️ 整合ルールは PUT /api/biz/jobs/[id] に揃える（全消し→入れ直し→job_category 派生）。
 *    加えて role_category_id も主ロールで更新する。biz 側の API はこれを更新しないため
 *    古い値が残り続けており（20260803114812 の migration コメント参照）、
 *    運営が直したのにまた食い違う、という状態を作らないため。
 */
export async function updateJobRoles(
  jobId: string,
  jobRoles: { roleId: string; isPrimary: boolean }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "Invalid jobId" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }

  const clean = jobRoles.filter((r) => UUID_RE.test(r.roleId));
  if (clean.length !== jobRoles.length) return { ok: false, error: "職種IDが不正です" };
  if (clean.length === 0) return { ok: false, error: "職種を1つ以上選んでください" };
  // 主ロールは必ず1つ。決まっていなければ先頭を主にする
  const primary = clean.find((r) => r.isPrimary) ?? clean[0];
  const rows = clean.map((r) => ({ job_id: jobId, role_id: r.roleId, is_primary: r.roleId === primary.roleId }));

  const admin = createAdminClient();

  const del = await admin.from("ow_job_roles").delete().eq("job_id", jobId);
  if (del.error) return { ok: false, error: del.error.message };

  const ins = await admin.from("ow_job_roles").insert(rows);
  if (ins.error) return { ok: false, error: ins.error.message };

  // 主ロール名を job_category に派生（移行期間中の互換値）＋ role_category_id を同期
  const role = await admin.from("ow_roles").select("name").eq("id", primary.roleId).maybeSingle();
  if (role.error) return { ok: false, error: role.error.message };

  const patch: Record<string, unknown> = {
    role_category_id: primary.roleId,
    updated_at: new Date().toISOString(),
  };
  // 「値が無い」ことを「ある値」に置き換えない。取れなければ job_category は触らない
  if (role.data?.name) patch.job_category = role.data.name;

  const up = await admin.from("ow_jobs").update(patch).eq("id", jobId);
  if (up.error) return { ok: false, error: up.error.message };

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/**
 * 求人の出典（原文URL）を記録する。運営用。
 *
 * ⚠️ **公開ページには出さない。** 求人がどこから来たかを運営が追えるようにするためだけの列。
 *
 * ⚠️ 空文字は null にする。「入力したが空」と「未入力」を別物として持たない
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」の裏返しで、
 *      空文字を残すと「出典なし」の抽出が空振りする）。
 *
 * 2026-08-11 に追加。出典列が無かったために公開求人18件の出所調査に丸一日かかり、
 * うち13件は実在を確認できず掲載を下ろすことになった。
 */
export async function updateJobSource(
  jobId: string,
  sourceUrl: string,
  markVerified: boolean,
): Promise<{ ok: boolean; error?: string; verifiedAt?: string | null }> {
  if (!UUID_RE.test(jobId)) return { ok: false, error: "求人IDが不正です" };
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }

  const url = sourceUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL は http:// または https:// で始めてください" };
  }
  if (url.length > 2000) return { ok: false, error: "URL が長すぎます（2000文字以内）" };

  // ⚠️ URL が空なら突合日時も落とす。原文が無いのに「確認済み」は成立しない
  const verifiedAt = url && markVerified ? new Date().toISOString() : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_jobs")
    .update({
      source_url: url || null,
      source_verified_at: verifiedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("id");   // ⚠️ 引数なしの .select() は全列を返す。列を絞る
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true, verifiedAt };
}
