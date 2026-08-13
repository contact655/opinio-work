"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCompanyJoinedRow } from "@/lib/feed/systemPosts";
import { revalidatePath } from "next/cache";
import { publishedAtPatch } from "@/lib/companies/publishedAt";

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

/**
 * カジュアル面談を受け付けるか（ow_companies.accepting_casual_meetings）。
 *
 * ⚠️ 2026-08-06 に jobs_public から差し替えた。面談の可否は3つのフラグに分かれており、
 *    申込ページ本体（casual-meeting/page.tsx）と API（/api/casual-meetings）は
 *    accepting_casual_meetings しか見ていない。jobs_public は /jobs/[id] の
 *    CTA表示しか決めておらず、2つがずれると
 *      ・ボタンは出るが押すと「現在受付していません」
 *      ・面談できるのにボタンが出ない
 *    が起きる。実際に非掲載企業で1社ずつ起きていた。
 * ⚠️ jobs_public カラムは残してあるが、参照はゼロ。新しい判定に使わないこと。
 */
export async function updateAcceptingMeetings(companyId: string, newValue: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_companies")
    .update({ accepting_casual_meetings: newValue, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) {
    console.error("[updateAcceptingMeetings]", error.message);
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

  /* ⚠️ **ここは詳細ページの軸だけを動かす。** ディレクトリ掲載は
        updateListingStatus（下）が別に持つ。2軸を同時に動かすのは
        企業側の /biz/company だけ。 */
  /* ⚠️ published_at の規則は lib/companies/publishedAt.ts に集約している。
        ここに条件を書き写さないこと（3経路あり、片方だけ直し忘れる）。 */
  const { data: cur } = await admin
    .from("ow_companies").select("published_at").eq("id", companyId).maybeSingle();
  const updates: Record<string, unknown> = {
    is_published: newValue,
    ...publishedAtPatch(cur?.published_at, newValue, now),
    updated_at: now,
  };

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
 * ディレクトリ掲載（listing_status）の切り替え。**is_published とは別の軸。**
 *
 * ── 2軸の意味（2026-08-12 分離）────────────────────────────────────────────
 *   is_published   … 詳細ページが見えるか（404ゲート）
 *   listing_status … 一覧・検索・サジェスト・sitemap・LP に載るか
 *
 * ⚠️ **経歴に出てくる企業は詳細ページだけ必要で、ディレクトリには要らない。**
 *    以前は is_published が両方を制御しており、非公開だと経歴のリンクが404になっていた
 *    （経歴に出る6社のうち4社が該当）。
 *
 * ⚠️ 企業側（/biz/company の公開トグル）は2軸を同時に動かす。
 *    「詳細は見えるがディレクトリには出ない」は**運営だけが作れる状態**にしてある。
 */
export async function updateListingStatus(
  companyId: string,
  newValue: "listed" | "draft"
): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  if (newValue !== "listed" && newValue !== "draft") {
    return { ok: false, error: "listing_status の値が不正です" };
  }
  await assertAdmin();
  const admin = createAdminClient();

  /* ⚠️ 0行更新を成功として扱わない。.select("id") で戻り行を受ける（CLAUDE.md）。
        ⚠️ 引数なしの .select() は使わない。列単位 GRANT を剥がした列があると 403 になる。 */
  const { data, error } = await admin
    .from("ow_companies")
    .update({ listing_status: newValue, updated_at: new Date().toISOString() })
    .eq("id", companyId)
    .select("id");

  if (error) {
    console.error("[updateListingStatus]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の企業が見つかりませんでした（0行更新）" };
  }

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

/**
 * ロゴURLを更新する（運営用）。
 *
 * ⚠️ **ブラウザ側のクライアントで更新しないこと（2026-08-11 修正）。**
 *    一覧ページが `createClient()` で直接 `ow_companies.update({logo_url})` しており、
 *    `ow_companies_own_update` は `auth.uid() = user_id` を要求する。
 *    `user_id` が入っているのは **85社中2社**なので、**残り83社では0行更新**だった。
 *    戻り値も捨てていたため、入力欄は保存されたように見えていた。
 */
export async function updateCompanyLogoUrl(
  companyId: string,
  logoUrl: string | null,
): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "企業IDが不正です" };
  await assertAdmin();

  const url = (logoUrl ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL は http:// または https:// で始めてください" };
  }
  if (url.length > 2000) return { ok: false, error: "URL が長すぎます（2000文字以内）" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_companies")
    .update({ logo_url: url || null, updated_at: new Date().toISOString() })
    .eq("id", companyId)
    .select("id");   // ⚠️ 列を絞る。引数なしの .select() は全列を返す
  if (error) return { ok: false, error: toMessage(error) };
  /* ⚠️ 0行更新を成功にしない。id 違いを黙って通すと同じ穴に戻る */
  if (!data || data.length === 0) {
    return { ok: false, error: `対象の企業が見つかりませんでした（id: ${companyId}）` };
  }

  revalidatePath("/admin/companies");
  return { ok: true };
}
