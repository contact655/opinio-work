import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { setCompanyProposalMode } from "@/lib/evidence/companyProposals";
import { isProposalCompanyMode } from "@/lib/constants/proposalResponses";

export const dynamic = "force-dynamic";

/**
 * ★提案で届いた方をどう受けるか（2026-10-11）。
 *   auto   … すぐにメッセージを始める（既定）
 *   review … 確認してから会うかを決める（14日以内）
 *
 * ⚠️★変えられるのは**その企業の管理者（admin）だけ**。メンバーは画面で読むだけ。
 * ⚠️ 変えても、既に届いた提案には効かない（届いた時点の設定を `delivery_mode` に写してある）。
 */
export async function PUT(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.currentPermission !== "admin") {
    return NextResponse.json({ error: "この設定は管理者だけが変更できます" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = String(body.mode ?? "");
  if (!isProposalCompanyMode(mode)) return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  const ok = await setCompanyProposalMode(ctx.tenantId, mode, ctx.currentOwnId);
  if (!ok) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, mode });
}
