"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { publishedAtPatch } from "@/lib/companies/publishedAt";
import { checkPublishable, publishBlockedMessage } from "@/lib/companies/publishable";
import { applyCompanyDraft } from "@/lib/companies/applyDraft";
import { notifyCompanyStatus } from "@/lib/notify/companyStatus";
import { insertCompanyJoined } from "@/lib/companies/listing";
import { draftWithPatch } from "@/lib/companies/syncDraft";
import { suspendCompany, unsuspendCompany } from "@/lib/companies/suspension";

async function assertAdmin(): Promise<void> {
  await assertAdminId();
}

/** 運営か確かめ、運営の ow_users.id を返す（停止の記録に使う。取れなければ null） */
async function assertAdminId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
  const { data: me, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[admin/companies] 運営の ow_users:", error.message);
  return (me?.id as string | undefined) ?? null;
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
 *    （未承認企業の掲載が CHECK 制約で 23514 で弾かれても、画面もログも無反応だった）。
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Postgres のエラーを運営が読める日本語にする。原文も残す */
function toMessage(err: { code?: string; message: string }): string {
  /* ⚠️ 承認の CHECK（check_listed_requires_approval）は 2026-10-28 に外した（公開は企業、停止は運営） */
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
  await revalidateCompanyPages(companyId);
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
  /* ★企業の下書きの同じキーもそろえる（2026-10-29）。そろえないと、企業が次に「公開する」を押したとき
        古い下書きの値で戻る（lib/companies/syncDraft.ts）。 */
  const { data: cur, error: readErr } = await admin
    .from("ow_companies").select("draft_data").eq("id", companyId).maybeSingle();
  if (readErr) {
    console.error("[updateAcceptingMeetings] draft_data", readErr.message);
    return { ok: false, error: toMessage(readErr) };
  }
  const draft = draftWithPatch(cur?.draft_data, { accepting_casual_meetings: newValue });
  const { error } = await admin
    .from("ow_companies")
    .update({
      accepting_casual_meetings: newValue,
      ...(draft ? { draft_data: draft } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (error) {
    console.error("[updateAcceptingMeetings]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  revalidatePath("/admin/companies");
  await revalidateCompanyPages(companyId);
  return { ok: true };
}

/**
 * ページの取り下げ・復帰（is_published）。**日常操作ではない。**
 *
 * ── 2026-08-13 に意味が反転した ─────────────────────────────────────────────
 * それまでは「未公開が既定で、公開するために押す」トグルだった。
 * いまは DB の既定が true で、**ページは作られた時点で存在する**。
 * この関数は「このページは出さない」と運営が判断したときだけ使う取り下げ用。
 *
 * ⚠️ 承認（is_approved）はもうここに掛かっていない。掛け先は一覧掲載に移した
 *    （check_listed_requires_approval）。ページの可視性と審査は無関係。
 *
 * ⚠️ **company_joined はここでは作らない。** フィードのお知らせは
 *    「ディレクトリに迎え入れた」ことに対して出すので updateListingStatus が持つ。
 *    ページが存在するだけで「参加しました」と流れるのはおかしい。
 */
export async function updateIsPublished(companyId: string, newValue: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();

  /* ⚠️ 公開ゲート。条件はここに書かず `checkPublishable` を呼ぶ（公開に触れる経路は
        4つあり、書き写すと必ず漏れる）。運営経路なので掲載規約の同意は求めない。
     ⚠️ 取り下げ（false）は常に通す。塞ぐのは「見えるようにする一手」だけ。 */
  if (newValue) {
    if (await isSuspended(companyId)) return { ok: false, error: "停止中の企業です。先に「停止」の列から解除してください。" };
    const gate = await checkPublishable(companyId, { kind: "admin" });
    if (!gate.ok) return { ok: false, error: publishBlockedMessage(gate.missing) };
  }
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

  revalidatePath("/admin/companies");
  await revalidateCompanyPages(companyId);
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
 *
 * ⚠️ **フィードの company_joined はここで作る**（2026-08-13 に is_published から移した）。
 *    「参加しました」のお知らせはディレクトリに迎え入れたことに対して出す。
 *    ページが存在するだけで流すと、経歴から拾っただけの非IT企業まで告知されてしまう。
 *    draft → listed のときだけ。往復しても部分UNIQUEで2回目は作られない。
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

  /* ⚠️ 公開ゲート（掲載に切り替えるときだけ）。取り下げ（draft）は常に通す。
     ★**下書きの値で判定し、掲載と一緒に下書き（と未公開の写真）を反映する**（2026-10-12）。
        （2026-10-28 から企業は「公開する」で自分で反映する。運営が代わりに掲載するときも）ここで反映しないと
        掲載した瞬間に**依頼したときの内容ではなく古い内容**が出る。
     ⚠️ 運営の掲載では従業員数・本社所在地で止めない（止めるのは企業の「掲載を依頼する」）。 */
  const admin = createAdminClient();
  if (newValue === "listed") {
    if (await isSuspended(companyId)) return { ok: false, error: "停止中の企業です。先に「停止」の列から解除してください。" };
    const gate = await checkPublishable(companyId, { kind: "admin" }, { useDraft: true });
    if (!gate.ok) return { ok: false, error: publishBlockedMessage(gate.missing) };
    /* ★掲載前の企業が下書きで直した企業名も、ここで反映する（掲載後は企業からは変えられない） */
    const applied = await applyCompanyDraft(companyId, { client: admin, label: "admin 掲載", writeName: true });
    if (!applied.ok) return { ok: false, error: `下書きを反映できませんでした: ${applied.message ?? applied.error}` };
  }

  /* ⚠️ 0行更新を成功として扱わない。.select("id") で戻り行を受ける（CLAUDE.md）。
        ⚠️ 引数なしの .select() は使わない。列単位 GRANT を剥がした列があると 403 になる。 */
  /* ★掲載にしたら、企業からの掲載依頼は片付いたので消す（2026-09-29）。
        ⚠️★**残すと `/admin` の要対応に出続ける。** 依頼は「運営が動くべき」という印で、
           動いた時点で意味を失う。取り下げ（draft）では消さない
           ——依頼が残っているほうが「まだ対応していない」と分かる。
        ⚠️ 同じ UPDATE に混ぜる。別の UPDATE にすると片方だけ通る余地ができる。 */
  /* ★切り替える前の状態（2026-10-19）。draft → listed に変わったときだけ企業へ知らせる（同じ値を押し直しても送らない） */
  const { data: before, error: beforeErr } = await admin.from("ow_companies").select("listing_status").eq("id", companyId).maybeSingle();
  if (beforeErr) console.error("[updateListingStatus] before:", beforeErr.message);
  const patch: Record<string, unknown> = { listing_status: newValue, updated_at: new Date().toISOString() };
  if (newValue === "listed") patch.listing_requested_at = null;

  const { data, error } = await admin
    .from("ow_companies")
    .update(patch)
    .eq("id", companyId)
    .select("id");

  if (error) {
    console.error("[updateListingStatus]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の企業が見つかりませんでした（0行更新）" };
  }

  if (newValue === "listed") await insertCompanyJoined(companyId);
  if (newValue === "listed" && before && before.listing_status !== "listed") await notifyCompanyStatus(companyId, "listed");

  revalidatePath("/admin/companies");
  await revalidateCompanyPages(companyId);
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
/* ★insertCompanyJoined は lib/companies/listing.ts に移した（2026-10-28。企業の「公開する」も同じ関数を呼ぶ） */

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
  /* ★承認する前の状態（2026-10-19）。false → true に変わったときだけ企業へ知らせる */
  const { data: before, error: beforeErr } = await admin.from("ow_companies").select("is_approved").eq("id", companyId).maybeSingle();
  if (beforeErr) console.error("[updateApproval] before:", beforeErr.message);
  const { error } = await admin
    .from("ow_companies")
    .update({ is_approved: true, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) {
    console.error("[updateApproval]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  if (before && before.is_approved !== true) await notifyCompanyStatus(companyId, "approved");
  revalidatePath("/admin/companies");
  await revalidateCompanyPages(companyId);
  return { ok: true };
}

/**
 * 企業からの掲載依頼（`ow_companies.listing_requested_at`）を片付ける（2026-09-29）。
 *
 * ⚠️★**掲載状態は変わらない。** 消すのは「運営が見た」という印だけ。
 *    掲載するなら `updateListingStatus('listed')` を使う（あちらは同じ UPDATE で
 *    この列も自動で消す）。**この関数は「掲載しないと決めた」ときに使う。**
 *
 * ⚠️★**残しておくと `/admin` の要対応に出続ける。** 依頼は「運営が動くべき」という印で、
 *    掲載しないと決めたならもう出す理由が無い（0件が正常な数字にしてある）。
 *
 * ⚠️ 依頼した企業には通知しない。断りの連絡は運営が直接行う
 *    ——押しただけで企業に「お断り」が飛ぶ形にしないこと。
 */
export async function clearListingRequest(companyId: string): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();

  /* ⚠️ 0行更新を成功として扱わない（CLAUDE.md）。
        ⚠️ 引数なしの `.select()` を使わない（列単位 GRANT で 403 になる）。 */
  const { data, error } = await admin
    .from("ow_companies")
    .update({ listing_requested_at: null })
    .eq("id", companyId)
    .select("id");

  if (error) {
    console.error("[clearListingRequest]", error.message);
    return { ok: false, error: toMessage(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象の企業が見つかりませんでした（0行更新）" };
  }

  /* ⚠️ `/admin`（要対応タスク）も作り直す。ここだけだと件数が古いまま残る。 */
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateSortOrder(items: { id: string; sort_order: number }[]): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "権限がありません" };
  }
  const admin = createAdminClient();
  const targets = items.filter((item) => UUID_RE.test(item.id));

  /* ⚠️ **0行更新を成功として扱わない**（CLAUDE.md）。
        id の綴り違いや、その企業が消えていた場合に黙って素通りしていた。 */
  const results = await Promise.all(
    targets.map((item) =>
      mutateOne(
        admin.from("ow_companies").update({ sort_order: item.sort_order }).eq("id", item.id),
        `updateSortOrder ${item.id}`,
      )
    )
  );
  const failed = results.find((r) => !r.ok);
  if (failed && !failed.ok) {
    return { ok: false, error: failed.error };
  }

  /* ⚠️ **`/companies` も再検証する。** 並び順を使っているのは公開の企業一覧で、
        `/admin/companies` だけ revalidate しても利用者の画面は変わらない。 */
  revalidatePath("/admin/companies");
  /* ⚠️ 並び替えは**一覧の順序**だけを変える。詳細ページの中身は変わらないので
        個社の revalidate は要らない（事前生成の順序には効くが、次のビルドの話）。 */
  revalidatePath("/companies");
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
  await revalidateCompanyPages(companyId);
  return { ok: true };
}

/**
 * ★企業の退会の操作（2026-10-10 / 段5）。`ow_companies.withdrawn_at` を記録する／取り消す。
 * この日から30日後に、日次の処理（/api/cron/purge-candidate-notes）がその企業の社内メモと社内の状態を消す。
 * ⚠️ いまはそれ以外のこと（掲載・担当者・プラン）は変えない。退会に伴うほかの手続きは別に行う。
 * ⚠️ 取り消せるのは、まだ消えていない（30日たっていない）あいだだけ意味がある。
 */
export async function setCompanyWithdrawn(companyId: string, withdrawn: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const { data, error } = await createAdminClient().from("ow_companies")
    .update({ withdrawn_at: withdrawn ? new Date().toISOString() : null }).eq("id", companyId).select("id");
  if (error) return { ok: false, error: toMessage(error) };
  if ((data ?? []).length !== 1) return { ok: false, error: "企業が見つかりません" };
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true };
}


/** 停止中か（停止中は運営の掲載・ページ表示の切り替えでも戻さない。解除は suspension.ts の unsuspendCompany） */
async function isSuspended(companyId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("ow_companies").select("suspended_at").eq("id", companyId).maybeSingle();
  if (error) console.error("[admin/companies] isSuspended:", error.message);
  return data?.suspended_at != null;
}

/**
 * ★企業ページを停止する（2026-10-28 / 柴さんの判断。公開は企業、停止は運営）。理由は必須で、企業にメールで送る。
 * ⚠️ 判定と書き込みは lib/companies/suspension.ts の1か所。ここは運営の確認だけ。
 */
export async function suspendCompanyAction(companyId: string, reason: string): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  let adminOwUserId: string | null = null;
  try { adminOwUserId = await assertAdminId(); } catch { return { ok: false, error: "権限がありません" }; }
  const r = await suspendCompany(companyId, reason, adminOwUserId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true };
}

/** ★停止を解除する。停止前の公開の状態に戻す。一言は任意（企業にも送る） */
export async function unsuspendCompanyAction(companyId: string, note: string | null): Promise<ActionResult> {
  if (!UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  let adminOwUserId: string | null = null;
  try { adminOwUserId = await assertAdminId(); } catch { return { ok: false, error: "権限がありません" }; }
  const r = await unsuspendCompany(companyId, adminOwUserId, note);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true };
}
