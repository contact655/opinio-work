import { NextResponse } from "next/server";
import { requireOwnExperience } from "@/lib/experiences/reasonAnswers";
import { parseAnswers } from "@/lib/workplaceReview/constants";
import { loadReview, loadTendency, saveReview } from "@/lib/workplaceReview/server";

export const dynamic = "force-dynamic";

/**
 * ★入社後レビュー（「株式会社◯◯について」）の読み書き（2026-10-16）。
 * ⚠️★本人確認は `requireOwnExperience`（他人の職歴は 404。存在を区別させない）。
 * ⚠️ 回答は公開しない。企業側の API からは読ませない（このルートは本人の分だけを返す）。
 */

// GET — 開いたときの初期値（会社単位）とマスタ
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
  const loaded = await loadReview(own.owUserId, own.row);
  if (!loaded) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT — 保存。body: { answers, complete }。①がそろっていないと 400。保存後の④の傾向も返す
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: { answers?: unknown; complete?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = parseAnswers(body.answers);
  if (!parsed.ok) return NextResponse.json({ error: "INVALID_ANSWERS", message: parsed.message }, { status: 400 });

  const saved = await saveReview(own.owUserId, own.row, parsed.value, body.complete === true);
  if (!saved.ok) return NextResponse.json({ error: "SAVE_FAILED", message: saved.error }, { status: saved.status });

  /* ⚠️ 傾向が取れなくても保存は成功（null を返し、画面は傾向の部分だけ出さない） */
  const tendency = await loadTendency(own.owUserId);
  return NextResponse.json({ ok: true, status: saved.status, anchorId: saved.anchorId, tendency });
}
