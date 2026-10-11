import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { transformFormToDb, getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import type { BizCompany } from "@/lib/business/mockCompany";
import { checkPublishable, publishBlockedMessage } from "@/lib/companies/publishable";
import { applyCompanyDraft } from "@/lib/companies/applyDraft";


// PUT /api/biz/company — 自動保存（draft_data に書き込み。本番カラムは触らない）
export async function PUT(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<BizCompany>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId, owUserId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  // フォーム値を DB カラム形式に変換して draft_data に保存
  // 本番カラム（name, mission など）は一切変更しない
  const record = transformFormToDb(body as BizCompany);

  /* ⚠️ **0行更新を成功として扱わない。** 2026-08-23 まで `.select()` が無く、
        RLS が `auth.uid() = user_id`（87社中2社にしか入っていない列）を
        要求していたため、**85社で保存されないまま「保存しました」と出ていた。** */
  const draftRes = await mutateOne(
    supabase
      .from("ow_companies")
      .update({
        draft_data: record,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId),
    "company PATCH draft_data",
  );
  if (!draftRes.ok) {
    return NextResponse.json({ error: draftRes.error }, { status: draftRes.status });
  }

  await insertActivity(supabase, {
    company_id: companyId,
    actor_user_id: owUserId,
    type: "company_info_updated",
    description: "企業情報を下書き保存しました",
    target_type: "company",
    target_id: companyId,
  });

  /* ⚠️ ここは `draft_data` への下書き保存で、**公開ページの内容は変わらない**ので
        revalidate しない。公開列に展開するのは下の PATCH（変更を公開する）。 */
  return NextResponse.json({ ok: true });
}

// PATCH /api/biz/company
//   { action: "publish_draft" }  … 下書き（draft_data）と未公開の写真を反映する（「変更を公開する」）。
//                                  掲載中の企業だけ。反映の処理は lib/companies/applyDraft.ts
//
// ⚠️★**掲載（is_published / listing_status）はここでは動かない**（2026-09-18 に分離）。
//    それまでは `{ isPublished: true }` の**1リクエストが両方**を駆動していた。
//    掲載の管理は運営（/admin/companies の updateIsPublished / updateListingStatus）だけ。
export async function PATCH(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; isPublished?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  /* ★★掲載の切り替えは企業側から取り上げた（2026-09-18 / 柴さんの指示）。
     ⚠️★**`isPublished` を受け付けない。** 掲載（`is_published` / `listing_status`）の
        管理は運営（`/admin/companies`）だけが行う。
     ⚠️★**黙って無視しないこと。** 無視すると「押したのに変わらない」になり、
        呼び出し側が気づけない。**400 で明示的に断る。**
     ⚠️★**このチェックを消して `isPublished` を復活させないこと。** 復活させるなら
        `checkPublishable`（掲載規約の同意を含む）を必ず通す形に戻すこと。 */
  if ("isPublished" in body) {
    return NextResponse.json(
      { error: "PUBLISH_NOT_ALLOWED", message: "掲載の切り替えは運営が行います。" },
      { status: 400 },
    );
  }

  /* ⚠️ 受け付けるのは「下書きを反映する」だけ（2026-10-12）。
        `update_numbers_timestamp`（「数値を最新として公開する」）は外した。押しても求職者側のどこにも出ない日付だった */
  if (body.action !== "publish_draft") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  /* ★掲載中の企業だけが自分で反映できる（2026-10-12 / 柴さんの判断）。
        掲載前の企業は「掲載を依頼する」→ 運営が掲載にする操作の中で、下書きもまとめて反映される
        （admin/companies/actions.ts の updateListingStatus → applyCompanyDraft）。
     ⚠️ 未承認の企業は今までどおり反映できない（403）。 */
  const { data: co, error: coErr } = await supabase
    .from("ow_companies")
    .select("is_approved, is_published, listing_status")
    .eq("id", companyId)
    .maybeSingle();
  if (coErr) {
    console.error("[company PATCH fetch]", coErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!co?.is_approved) {
    return NextResponse.json({ error: "Not approved by admin yet" }, { status: 403 });
  }
  if (!(co.is_published === true && co.listing_status === "listed")) {
    return NextResponse.json(
      { error: "NOT_LISTED", message: "掲載前の企業ページは「掲載を依頼する」から公開します。" },
      { status: 409 },
    );
  }

  /* ⚠️ 公開ゲート。**下書きの値で**判定する（業種・事業領域を下書きで変えていればそちらで見る）。
        条件はここに書かず `checkPublishable` → `companyRequirements.ts`。企業経路なので掲載規約の同意も要る。
     ⚠️ 掲載中の企業は従業員数・本社所在地では止めない（forListing を付けない） */
  const gate = await checkPublishable(companyId, { kind: "company", authUserId: user.id }, { useDraft: true });
  if (!gate.ok) {
    return NextResponse.json({ error: publishBlockedMessage(gate.missing), missing: gate.missing }, { status: 400 });
  }

  /* ★反映は applyCompanyDraft の1か所（運営の掲載と同じ関数）。
     ⚠️ セッションのクライアントで書く（`ow_companies` は UPDATE が列単位 GRANT。企業が書ける列だけが通る） */
  const r = await applyCompanyDraft(companyId, { client: supabase, label: "company PATCH" });
  if (!r.ok) return NextResponse.json({ error: r.error, message: r.message }, { status: r.status });

  /* ⚠️★`company_joined` の投稿をこの経路に戻さないこと（掲載を立てた運営の操作に対して出す） */
  return NextResponse.json({ ok: true });
}
