import { NextResponse } from "next/server";
import { requireOwnExperience } from "@/lib/experiences/reasonAnswers";
import { isCheckpointKey, parseCheckinAnswers } from "@/lib/joinCheckin/constants";
import { loadCheckin, loadCheckinTendency, saveCheckin, skipCheckin } from "@/lib/joinCheckin/server";

export const dynamic = "force-dynamic";

/**
 * ★入社後のふり返り（入社3か月・1年。2026-11-20）の読み書き。本人の分だけ。
 * ⚠️★本人確認は `requireOwnExperience`（他人の職歴は 404。存在を区別させない）。
 * ⚠️ 表（ow_join_checkins / ow_join_checkin_axes）は anon / authenticated に権限が無い。読み書きはここ（service role）だけ。
 * ⚠️★回答は誰にも表示しない。企業側の API からは読ませない。
 */

// GET ?checkpoint=3m|1y — 開いたときの初期値（省略するといま聞くべき時点）
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
  const raw = new URL(req.url).searchParams.get("checkpoint");
  if (raw !== null && !isCheckpointKey(raw)) return NextResponse.json({ error: "Invalid checkpoint" }, { status: 400 });
  const loaded = await loadCheckin(own.owUserId, own.row, raw ?? undefined);
  if (!loaded) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT — body: { checkpoint, answers } か { checkpoint, skip: true }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: { checkpoint?: unknown; answers?: unknown; skip?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!isCheckpointKey(body.checkpoint)) return NextResponse.json({ error: "Invalid checkpoint" }, { status: 400 });

  if (body.skip === true) {
    const r = await skipCheckin(own.owUserId, own.row, body.checkpoint);
    if (!r.ok) return NextResponse.json({ error: "SAVE_FAILED", message: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, anchorId: r.anchorId });
  }

  const parsed = parseCheckinAnswers(body.answers);
  if (!parsed.ok) return NextResponse.json({ error: "INVALID_ANSWERS", message: parsed.message }, { status: 400 });
  const r = await saveCheckin(own.owUserId, own.row, body.checkpoint, parsed.value);
  if (!r.ok) return NextResponse.json({ error: "SAVE_FAILED", message: r.error }, { status: r.status });
  /* ★答えた見返りに、本人の傾向を返す。⚠️ 取れなくても保存は成功（null を返し、画面がその旨を出す） */
  const tendency = await loadCheckinTendency(own.owUserId);
  return NextResponse.json({ ok: true, anchorId: r.anchorId, tendency });
}
