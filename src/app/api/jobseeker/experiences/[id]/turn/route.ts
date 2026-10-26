import { NextResponse } from "next/server";
import { requireOwnExperience } from "@/lib/experiences/reasonAnswers";
import { parseTurnAnswers } from "@/lib/careerTurns/constants";
import { activeAxisKeys, loadTurn, loadTurnTendency, saveTurn, saveTurnDetail, skipTurn } from "@/lib/careerTurns/server";
import { parseTurnDetail } from "@/lib/careerTurns/detail";

export const dynamic = "force-dynamic";

/**
 * ★転機の3問の読み書き（2026-10-27 / フェーズ1c）。本人の分だけ。
 * ⚠️★本人確認は `requireOwnExperience`（他人の職歴は 404。存在を区別させない）。
 * ⚠️ 表（ow_career_turns）は anon / authenticated に権限が無い。読み書きはここ（service role）だけ。
 * ⚠️ 回答は誰にも表示しない。企業側の API からは読ませない。
 * ⚠️ 削除は DELETE /api/jobseeker/experiences/[id]/review（この会社への回答をまとめて消す。1a-4）。
 */

// GET — 開いたときの初期値（その会社の転機）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
  const loaded = await loadTurn(own.owUserId, own.row);
  if (!loaded) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT — body: { answers } か { skip: true } か { detail }（任意の段）。3問の保存後は、本人の回答だけから作った傾向も返す
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: { answers?: unknown; skip?: unknown; detail?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  /* ★任意の段「もう少し詳しく」（2026-10-27）。3問とは別に保存する（飛ばしても3問は残る） */
  if (body.detail !== undefined) {
    const keys = await activeAxisKeys();
    if (!keys) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
    const parsed = parseTurnDetail(body.detail, keys);
    if (!parsed.ok) return NextResponse.json({ error: "INVALID_DETAIL", message: parsed.message }, { status: 400 });
    const r = await saveTurnDetail(own.owUserId, own.row, parsed.value);
    if (!r.ok) return NextResponse.json({ error: "SAVE_FAILED", message: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, anchorId: r.anchorId });
  }

  let saved;
  if (body.skip === true) {
    saved = await skipTurn(own.owUserId, own.row);
  } else {
    const parsed = parseTurnAnswers(body.answers);
    if (!parsed.ok) return NextResponse.json({ error: "INVALID_ANSWERS", message: parsed.message }, { status: 400 });
    saved = await saveTurn(own.owUserId, own.row, parsed.value);
  }
  if (!saved.ok) return NextResponse.json({ error: "SAVE_FAILED", message: saved.error }, { status: saved.status });

  /* ⚠️ 傾向が取れなくても保存は成功（null を返し、画面は傾向の部分だけ出さない） */
  const tendency = body.skip === true ? [] : await loadTurnTendency(own.owUserId);
  return NextResponse.json({ ok: true, anchorId: saved.anchorId, tendency });
}
