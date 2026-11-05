import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { CONTACT_BLOCKED_MESSAGE, isMessagingBlocked } from "@/lib/conversations/contactGate";
import {
  CONNECTION_FIRST_MESSAGE_MAX,
  getDmState,
  getRequestQuota,
  isMutualFollow,
  quotaBlockMessage,
  sendDirectToConnection,
  sendMessageRequest,
  stateBlockMessage,
} from "@/lib/conversations/messageRequest";
import { GENERAL_FIRST_MESSAGE_MAX } from "@/lib/constants/messages";
import { consultAboutOptions } from "@/lib/conversations/consult";
import { optionKeyForExperience } from "@/lib/constants/careerConsult";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★DM の入口（`/u/[id]` の「メッセージ」ボタン）。2026-10-09 に「メッセージのお願い」へ作り替えた（段階3）。
 *
 * - GET  … 相手とのあいだの段と、送り手の残り枠を返す（ボタンが「開く／書く／止まる」を決める）
 * - POST … お願いを送る（本文が必須）。判定と書き込みは `lib/conversations/messageRequest.ts`
 *
 * ⚠️★**空の会話を作らない。** 以前はボタンを押しただけで本文の無い会話ができていた
 *    （本番の DM 3件はすべてそれだった）。
 * ⚠️★GET は**本文を返さない。** 以前は既存の会話のメッセージまで返していたが、受け手が
 *    承認前に本文を読めてしまう。
 * ⚠️ 止めた理由のうち相手に関わるものは返さない（`CONTACT_BLOCKED_MESSAGE`）。
 */

async function resolveMe() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: owMe } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  return (owMe?.id as string | undefined) ?? null;
}

/**
 * ★止まったときに出す文言（2026-10-20 / 柴さんの要望）。
 *   原則は理由を返さない（`CONTACT_BLOCKED_MESSAGE`）。**例外は送り手が検証用で相手が実在のときだけ**で、
 *   そのときは理由をそのまま出す（検証で「なぜ送れないのか」が分からず止まっていたため）。
 * ⚠️ 実在の利用者には今までどおり理由を出さない（ブロック・受け取り設定などが分かってしまう）。
 */
const TEST_TO_REAL_MESSAGE = "検証用アカウントからは、実在の利用者には送れません";
async function blockedMessageFor(meId: string, targetUserId: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("ow_users").select("id, is_test").in("id", [meId, targetUserId]);
  if (error) {
    console.error("[dm/start] is_test:", error.message);
    return CONTACT_BLOCKED_MESSAGE;
  }
  const testOf = new Map((data ?? []).map((u) => [u.id as string, u.is_test === true]));
  if (testOf.get(meId) === true && testOf.get(targetUserId) === false) return TEST_TO_REAL_MESSAGE;
  return CONTACT_BLOCKED_MESSAGE;
}

/**
 * ★送る人に職歴があるか（2026-11-05 / 柴さんの指示）。無ければ、新しい相手へ送る前に職歴の登録を案内する。
 *   相談を受ける人が「誰から来たか」で受けるかを決められるようにするため。⚠️ 既にある会話を開く・続きを送るのは止めない。
 *   取得に失敗したら null（呼び出し側は止める）
 */
const NEED_EXPERIENCE_MESSAGE = "メッセージを送る前に、職歴を1件登録してください。相手は、誰から届いたかを見て返信するかを決めます";
async function senderHasExperience(meId: string): Promise<boolean | null> {
  const { count, error } = await createAdminClient()
    .from("ow_experiences").select("id", { count: "exact", head: true }).eq("user_id", meId);
  if (error) {
    console.error("[dm/start] experiences:", error.message);
    return null;
  }
  return (count ?? 0) > 0;
}

async function targetExists(targetUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("ow_users").select("id, visibility").eq("id", targetUserId).maybeSingle();
  return !!data && data.visibility !== "private";
}

export async function GET(request: NextRequest) {
  const meId = await resolveMe();
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUserId = request.nextUrl.searchParams.get("targetUserId");
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }
  if (targetUserId === meId || !(await targetExists(targetUserId))) {
    return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 404 });
  }

  const state = await getDmState(meId, targetUserId);
  if (!state) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });

  /* 承認済み・自分が送ったお願いは、その会話を開く（自分の会話なので開いてよい） */
  if (state.kind === "accepted" || state.kind === "outgoing_pending") {
    return NextResponse.json({ action: "open", conversationId: state.conversationId });
  }
  /* 相手からのお願いが届いている／自分が断った */
  const stateMsg = stateBlockMessage(state);
  if (stateMsg) {
    return NextResponse.json({
      action: state.kind === "incoming_pending" ? "incoming" : "blocked",
      message: stateMsg,
    });
  }

  /* これから送る。⚠️ 相手に関わる理由で止まるなら、書かせる前に止める */
  if (await isMessagingBlocked(meId, targetUserId)) {
    return NextResponse.json({ action: "blocked", message: await blockedMessageFor(meId, targetUserId) });
  }
  /* ★職歴が無ければ、書く前に登録を案内する（2026-11-05） */
  const hasExp = await senderHasExperience(meId);
  if (hasExp === null) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  if (!hasExp) return NextResponse.json({ action: "need_experience", message: NEED_EXPERIENCE_MESSAGE });

  /* ★相談メニューの「聞きたい話」（2026-11-05）。送るときの確かめと同じ関数（consultAboutOptions）。
       「この経験について聞く」から来たときは、その職歴の選択肢を選んだ状態で開く */
  const consultOptions = await consultAboutOptions(targetUserId);
  if (!consultOptions) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  const expRaw = request.nextUrl.searchParams.get("aboutExperienceId");
  const selectedAbout = optionKeyForExperience(consultOptions, expRaw && UUID_RE.test(expRaw) ? expRaw : null);

  /* ★つながっている（相互フォロー）なら、返事待ちを挟まずにすぐ始められる（2026-10-20）。返事待ちの枠も見ない */
  if ((await isMutualFollow(meId, targetUserId)) === true) {
    return NextResponse.json({ action: "compose", connected: true, maxLength: CONNECTION_FIRST_MESSAGE_MAX, consultOptions, selectedAbout });
  }
  /* ⚠️ 2026-11-03〜11-05 は、相手の「話を聞ける」設定で書く前に止めていた。外した（柴さんの指示）。
        量の歯止めは返事待ちの上限（既定 5 人）と1日の上限 */
  const quota = await getRequestQuota(meId);
  if (!quota) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  const quotaMsg = quotaBlockMessage(quota);
  if (quotaMsg) return NextResponse.json({ action: "blocked", message: quotaMsg });

  return NextResponse.json({ action: "compose", quota, consultOptions, selectedAbout, maxLength: GENERAL_FIRST_MESSAGE_MAX });
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(request, { limit: 20, windowSec: 3600, prefix: "dm" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const meId = await resolveMe();
  if (!meId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { targetUserId?: unknown; topic?: unknown; format?: unknown; aboutCompanyId?: unknown; askCompanyId?: unknown; message?: unknown; connected?: unknown; kind?: unknown; consult?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }
  if (!(await targetExists(targetUserId))) {
    return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 404 });
  }
  /* ★職歴が無い人は、新しい相手へ送れない（2026-11-05。画面の案内と同じ判定をサーバーでも） */
  const hasExp = await senderHasExperience(meId);
  if (hasExp === null) return NextResponse.json({ error: "送信に失敗しました。もう一度お試しください" }, { status: 500 });
  if (!hasExp) return NextResponse.json({ error: NEED_EXPERIENCE_MESSAGE }, { status: 403 });
  /* ★キャリア相談（2026-11-05）。あれば相談として送る（中身の確かめは resolveConsult） */
  const consult = body.consult != null && typeof body.consult === "object" ? body.consult : null;
  if (body.consult != null && !consult) return NextResponse.json({ error: "相談の内容を選び直してください" }, { status: 400 });

  /* ★つながっている相手へ（GET が connected を返したときだけ画面が付けてくる）。
       ⚠️ 画面の申告は信じない。sendDirectToConnection が相互フォローを確かめ直す */
  if (body.connected === true) {
    const direct = await sendDirectToConnection({
      senderId: meId,
      recipientId: targetUserId,
      body: typeof body.message === "string" ? body.message : "",
      consult,
    });
    if (!direct.ok) {
      const error = direct.error === CONTACT_BLOCKED_MESSAGE ? await blockedMessageFor(meId, targetUserId) : direct.error;
      return NextResponse.json({ error }, { status: direct.status });
    }
    return NextResponse.json({ conversationId: direct.conversationId }, { status: 201 });
  }

  const result = await sendMessageRequest({
    senderId: meId,
    recipientId: targetUserId,
    /* ★「キャリアの相談をする」か「メッセージを送る」か（2026-10-20）。知らない値は相談として扱う（テーマが無ければ 400） */
    kind: consult ? "career_consult" : body.kind === "message" ? "message" : "consult",
    consult,
    topic: typeof body.topic === "string" ? body.topic : "",
    aboutCompanyId: typeof body.aboutCompanyId === "string" && UUID_RE.test(body.aboutCompanyId) ? body.aboutCompanyId : null,
    askCompanyId: typeof body.askCompanyId === "string" && UUID_RE.test(body.askCompanyId) ? body.askCompanyId : null,
    format: typeof body.format === "string" ? body.format : undefined,
    body: typeof body.message === "string" ? body.message : "",
  });
  if (!result.ok) {
    const error = result.error === CONTACT_BLOCKED_MESSAGE ? await blockedMessageFor(meId, targetUserId) : result.error;
    return NextResponse.json({ error }, { status: result.status });
  }
  return NextResponse.json({ conversationId: result.conversationId }, { status: 201 });
}
