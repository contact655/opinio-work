import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";
import { dismissMember } from "@/lib/companyMembers/decide";

export const dynamic = "force-dynamic";

// DELETE /api/biz/ambassador/revoke
// Body: { member_id: string }
export async function DELETE(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "管理者のみ操作できます" }, { status: 403 });
  }

  let body: { member_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { member_id } = body;
  if (!member_id) return NextResponse.json({ error: "member_id required" }, { status: 400 });

  /* ⚠️★このルートは**3つの操作**を兼ねている（/biz/members の3箇所から呼ばれる）:
        「見送る」（本人の申請）/「解除」（承認済み）/「解除」（招待中）。
        どれなのかは**消える行の状態でしか分からない**ので、判定と通知は
        decide.ts の内側に置いてある。ここで DELETE を書き直さないこと。 */
  const result = await dismissMember(member_id, ctx.tenantId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, notified: result.notified });
}
