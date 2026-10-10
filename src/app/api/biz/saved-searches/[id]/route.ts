import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { MAX_SAVED_SEARCH_NAME } from "@/lib/business/savedSearch";
import { isNotifyFrequency } from "@/lib/business/savedSearchServer";

export const dynamic = "force-dynamic";

/**
 * ★保存した条件の編集（2026-10-10 / 段3）。**作った人だけ。** 名前・お知らせの頻度・公開範囲。
 * ⚠️ 条件そのもの（filters）はここでは変えない（変えるときは検索画面から同じ名前で保存し直す）。
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = {};
  if (b?.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
    if (name.length > MAX_SAVED_SEARCH_NAME) return NextResponse.json({ error: `名前は${MAX_SAVED_SEARCH_NAME}文字以内にしてください` }, { status: 400 });
    patch.name = name;
  }
  if (b?.notifyFrequency !== undefined) {
    if (!isNotifyFrequency(b.notifyFrequency)) return NextResponse.json({ error: "お知らせの設定が正しくありません" }, { status: 400 });
    patch.notify_frequency = b.notifyFrequency;
  }
  if (b?.isShared !== undefined) {
    if (typeof b.isShared !== "boolean") return NextResponse.json({ error: "公開範囲の設定が正しくありません" }, { status: 400 });
    patch.is_shared = b.isShared;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "変更がありません" }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  const r = await mutateOne(
    createAdminClient().from("ow_saved_candidate_searches").update(patch)
      .eq("id", params.id).eq("owner_user_id", ctx.currentOwnId).eq("company_id", ctx.tenantId),
    "saved-search PATCH",
  );
  /* ⚠️ 0行 = 作った人ではない（他人の共有条件）か、無い。どちらも 404 にする */
  if (!r.ok) return NextResponse.json({ error: r.status === 404 ? "編集できるのは作った人だけです" : r.error }, { status: r.status === 404 ? 403 : r.status });
  return NextResponse.json({ ok: true });
}

/**
 * 削除。**作った人、または企業の管理者（permission = admin）。** 作った人が辞めたとき用。
 * ⚠️★プランのゲートを掛けない（free に戻った人が自分の保存を片付けられなくなるため）。
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let q = createAdminClient().from("ow_saved_candidate_searches").delete()
    .eq("id", params.id).eq("company_id", ctx.tenantId);
  if (ctx.currentPermission !== "admin") q = q.eq("owner_user_id", ctx.currentOwnId);
  const r = await mutateOne(q, "saved-search DELETE");
  if (!r.ok) return NextResponse.json({ error: r.status === 404 ? "削除できるのは作った人と企業の管理者だけです" : r.error }, { status: r.status === 404 ? 403 : r.status });
  return NextResponse.json({ ok: true });
}
