import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";

/**
 * 保存した条件を消す。
 *
 * ⚠️★**持ち主と企業の両方で絞る。** id だけで消すと、id を知っていれば
 *    他人の行を消せる（admin クライアントなので RLS は効かない）。
 * ⚠️★**0行削除を成功として扱わない**（`mutateOne`）。他人の id を渡されたときに
 *    200 を返すと、消えていないのに消えたように見える。
 */
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /* ⚠️ プランのゲートは掛けていない。**消すのは常に許す** ——
        プランが free に戻った人が、自分の保存を片付けられなくなるため。 */
  const admin = createAdminClient();
  const r = await mutateOne(
    admin
      .from("ow_saved_candidate_searches")
      .delete()
      .eq("id", params.id)
      .eq("owner_user_id", ctx.currentOwnId)
      .eq("company_id", ctx.tenantId),
    "saved-search DELETE",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ ok: true });
}
