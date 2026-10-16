import { NextResponse } from "next/server";
import { REASON_CLOSE_STEPS, REASON_CLOSE_VIA } from "@/lib/constants/careerReasons";
import { recordReasonClose, requireOwnExperience } from "@/lib/experiences/reasonAnswers";

export const dynamic = "force-dynamic";

/**
 * ★「あとで答える」と × で閉じたときの記録（2026-10-16）。どのステップで閉じたかを残す。
 * ⚠️★本人確認は `requireOwnExperience`（RLS は効かない）。
 * ⚠️ 記録に失敗しても利用者の操作は止めない（画面側は結果を待たない）。ログには残す。
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const step = body.step, via = body.via;
  if (typeof step !== "string" || !REASON_CLOSE_STEPS.has(step) || typeof via !== "string" || !REASON_CLOSE_VIA.has(via)) {
    return NextResponse.json({ error: "Invalid step or via" }, { status: 400 });
  }
  const r = await recordReasonClose(own.owUserId, own.row.id, step, via);
  if (!r.ok) return NextResponse.json({ error: "記録に失敗しました" }, { status: 500 });
  return NextResponse.json({ success: true });
}
