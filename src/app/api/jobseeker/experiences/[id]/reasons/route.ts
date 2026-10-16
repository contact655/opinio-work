import { NextResponse } from "next/server";
import { parseReasonAnswersV2 } from "@/lib/constants/careerReasons";
import {
  loadReasonAnswers,
  requireOwnExperience,
  resolveReasonTarget,
  saveReasonAnswers,
} from "@/lib/experiences/reasonAnswers";

export const dynamic = "force-dynamic";

/**
 * ★「この会社について」モーダルの読み書き（新形式 reason_version = 2。2026-10-16）。
 * ⚠️★書き込みは service_role。**本人確認は `requireOwnExperience` だけが担う**（RLS は効かない）。
 * ⚠️ 職歴の本体（PUT /api/jobseeker/experiences/[id]）とは別。職歴の中身を一緒に送らなくてよい。
 */

// GET — モーダルを開いたときの初期値（会社単位）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
  const loaded = await loadReasonAnswers(own.owUserId, own.row);
  if (!loaded) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT — 保存（入れ替え）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const target = await resolveReasonTarget(own.owUserId, own.row);
  if (!target) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });

  const parsed = parseReasonAnswersV2(body, target.canLeave);
  if (!parsed.ok) return NextResponse.json({ error: "INVALID_ANSWERS", message: parsed.message }, { status: 400 });

  const saved = await saveReasonAnswers(target.anchor.id, parsed.value);
  if (!saved.ok) return NextResponse.json({ error: "SAVE_FAILED", message: saved.error }, { status: 500 });
  return NextResponse.json({ success: true, anchorId: target.anchor.id });
}
