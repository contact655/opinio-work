import { NextResponse } from "next/server";
import { requireOwnExperience } from "@/lib/experiences/reasonAnswers";
import { parseJoinDecision } from "@/lib/joinDecision/constants";
import { loadJoinDecision, markJoinDecisionReshown, saveJoinDecision, skipJoinDecision } from "@/lib/joinDecision/server";

export const dynamic = "force-dynamic";

/**
 * ★入社の決め手（1問・2026-11-02）の読み書き。本人の分だけ。
 * ⚠️★本人確認は `requireOwnExperience`（他人の職歴は 404。存在を区別させない）。
 * ⚠️ 表（ow_join_decisions）は anon / authenticated に権限が無い。読み書きはここ（service role）だけ。
 * ⚠️★回答は誰にも表示しない。企業側の API からは読ませない。
 */

// GET — 開いたときの初期値と、いま聞いてよいか
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
  const loaded = await loadJoinDecision(own.owUserId, own.row);
  if (!loaded) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json(loaded);
}

// PUT — body: { reasons } か { skip: true } か { reshown: true }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: { reasons?: unknown; skip?: unknown; reshown?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let r;
  if (body.skip === true) r = await skipJoinDecision(own.owUserId, own.row);
  else if (body.reshown === true) r = await markJoinDecisionReshown(own.owUserId, own.row);
  else {
    const parsed = parseJoinDecision(body.reasons);
    if (!parsed.ok) return NextResponse.json({ error: "INVALID_ANSWERS", message: parsed.message }, { status: 400 });
    r = await saveJoinDecision(own.owUserId, own.row, parsed.value);
  }
  if (!r.ok) return NextResponse.json({ error: "SAVE_FAILED", message: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, anchorId: r.anchorId });
}
