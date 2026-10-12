import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { markApproachSeenByCompany } from "@/lib/approaches/server";
import { markProposalSeenByCompany } from "@/lib/evidence/companyProposals";
import { listSameTestStaff } from "@/lib/business/sameTestStaff";
import { conversationMeetingState, getSchedulingUrl } from "@/lib/meetings/server";
import { calcTotalExperience } from "@/lib/profile/tenure";
import { getCandidateProfileForCompany } from "@/lib/business/candidates/profile";
import { approachFirstMessageBody } from "@/lib/constants/companyApproaches";

/**
 * ★企業の会話1本を開くときの読み込み（2026-10-11 に /biz/messages/[id] から切り出した）。
 *   /biz/messages の右側と /biz/messages/[id] が**同じ関数**を使う。
 *
 * ⚠️★読み込みの条件・既読の付け方は切り出す前と同じ:
 *    - 会話は `company_id = tenantId` で絞る（他社の会話は null）
 *    - メッセージはセッションのクライアントで読む（参加していない会話は RLS で読めない）
 *    - 既読（`last_read_at`）は**参加者のときだけ**付ける。企業が見た印（送ったメッセージ・提案）も同じ条件
 *    ⚠️ ここに条件を書き足さないこと。権限・RLS は変えていない。
 */

export type ThreadCandidate = { id: string; name: string | null; about_me: string | null; location: string | null; avatar_color: string | null };
export type ThreadParticipant = { id: string; role: string; user_id: string; user: { name: string | null } | null };
export type ThreadMessage = {
  id: string; body: string; kind: string; payload: unknown; sent_at: string; sender_participant_id: string | null;
  participant: { id: string; role: string; user_id: string; user: { name: string | null } | null } | null;
};
export type CompanyThread = {
  conv: { id: string; kind: string | null; stage: string | null; status: string | null; last_message_at: string | null; created_at: string };
  candidate: ThreadCandidate | null;
  participants: ThreadParticipant[];
  isParticipant: boolean;
  /** ★返信欄を出してよいか（2026-10-12）。参加者、またはその会社の現役の管理者（返信すると参加する） */
  canReply: boolean;
  /** ★送れない理由（画面の表示用）。検証用と実アカウントの間は送れない（`companyConversationSendAllowed` と同じ判定） */
  sendBlocked: "test_mismatch" | null;
  messages: ThreadMessage[];
  messagesFailed: boolean;
  /** 送ったメッセージ（1通目）。吹き出しを「理由・本文」で描くため */
  approachFirst: { messageId: string; reason: string; body: string | null } | null;
  /** 返信が来たところに出す中央の一行 */
  replyNote: { messageId: string; text: string } | null;
  companyAdmins: { id: string; name: string; role: string | null }[];
  schedulingUrl: string | null;
  meetingState: Awaited<ReturnType<typeof conversationMeetingState>>;
};

export async function loadCompanyThread(conversationId: string, ctx: { tenantId: string; currentOwnId: string },
  /** ★既読を付けるか（2026-10-13）。**既定は true（今までどおり）**。/biz/messages は渡さない。
   *   候補者を探すの右欄だけ false で読み、入力欄にフォーカス・スクロール・送信したときに `markCompanyThreadRead` を呼ぶ */
  opts: { markRead?: boolean } = {}): Promise<CompanyThread | null> {
  const supabase = createClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: rawConv, error: convError } = await supabase
    .from("ow_conversations")
    .select(`
      id, kind, stage, status, last_message_at, created_at,
      candidate:ow_users!candidate_user_id(id, name, about_me, location, avatar_color)
    `)
    .eq("id", conversationId)
    .eq("company_id", ctx.tenantId)
    .maybeSingle();
  if (convError) console.error("[companyThread] conv fetch error:", convError.message);
  if (!rawConv) return null;

  const candidate: ThreadCandidate | null = Array.isArray(rawConv.candidate) ? (rawConv.candidate[0] ?? null) : rawConv.candidate ?? null;
  const candidateName = candidate?.name ?? "名前未設定";

  const { data: rawParticipants, error: pErr } = await supabase
    .from("ow_conversation_participants")
    .select("id, role, user_id, user:ow_users(name)")
    .eq("conversation_id", conversationId);
  if (pErr) console.error("[companyThread] participants:", pErr.message);
  const participants: ThreadParticipant[] = (rawParticipants ?? []).map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: p.id, role: p.role, user_id: p.user_id, user: Array.isArray(p.user) ? (p.user[0] ?? null) : p.user ?? null,
  }));
  const myParticipant = participants.find((p) => p.user_id === ctx.currentOwnId) ?? null;

  const { data: rawMessages, error: msgsError } = await supabase
    .from("ow_conversation_messages")
    .select(`
      id, body, kind, payload, sent_at, sender_participant_id,
      participant:ow_conversation_participants!sender_participant_id(
        id, role, user_id,
        user:ow_users(name)
      )
    `)
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });
  if (msgsError) console.error("[companyThread] messages fetch error:", msgsError.message);

  /* ★既読。企業側も `last_read_at` で数える（`lib/conversations/unread.ts`）。
        ⚠️ **参加者のときだけ**。参加していない人はメッセージを読めていない（RLS）。
        ⚠️ admin で書く。絞り込みは自分の参加者行の id だけ。失敗しても画面は出す（ログは出す） */
  if (opts.markRead !== false && myParticipant && !msgsError) {
    await writeRead(conversationId, myParticipant.id, ctx.tenantId);
  }

  const messages: ThreadMessage[] = (rawMessages ?? []).map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: m.id, body: m.body, kind: m.kind ?? "text", payload: m.payload ?? null, sent_at: m.sent_at,
    sender_participant_id: m.sender_participant_id,
    participant: Array.isArray(m.participant) ? (m.participant[0] ?? null) : m.participant ?? null,
  }));

  /* ★送ったメッセージから始まった会話は、1通目を「理由・本文」で描く。⚠️ 本文の文字列を分けて推測しない（理由に空行が入りうる） */
  let approachFirst: CompanyThread["approachFirst"] = null;
  let replyNote: CompanyThread["replyNote"] = null;
  if (messages.length > 0) {
    const { data: ap, error: apErr } = await createAdminClient().from("ow_company_approaches")
      .select("reason, body, accepted_at").eq("conversation_id", conversationId).eq("company_id", ctx.tenantId).maybeSingle();
    if (apErr) console.error("[companyThread] approach:", apErr.message);
    if (ap) {
      const expected = approachFirstMessageBody(ap.reason as string, (ap.body as string | null) ?? null);
      const first = messages.find((m) => m.body === expected);
      if (first) {
        approachFirst = { messageId: first.id, reason: ap.reason as string, body: (ap.body as string | null) ?? null };
        const reply = messages.slice(messages.indexOf(first) + 1).find((m) => m.participant?.role === "candidate");
        if (reply) {
          const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(new Date(reply.sent_at));
          const md = `${ps.find((x) => x.type === "month")?.value ?? ""}月${ps.find((x) => x.type === "day")?.value ?? ""}日`;
          replyNote = { messageId: reply.id, text: `${md}・${candidateName}さんから返信がありました` };
        }
      }
    }
  }

  /* ★返信できるか（2026-10-12）。⚠️ 判定の担保は送信の API（参加者 or 現役の管理者・検証用と実アカウントの一致）。
        ここは表示の出し分けだけ。読み取りは admin（is_test と管理者の行はセッションでは読めないことがある） */
  const adminDb = createAdminClient();
  const [{ data: who, error: whoErr }, { data: adminRow, error: adminErr }] = await Promise.all([
    adminDb.from("ow_users").select("id, is_test").in("id", [ctx.currentOwnId, candidate?.id].filter((x): x is string => !!x)),
    adminDb.from("ow_company_admins").select("id").eq("user_id", ctx.currentOwnId).eq("company_id", ctx.tenantId).eq("is_active", true).maybeSingle(),
  ]);
  if (whoErr || adminErr) console.error("[companyThread] reply check:", whoErr?.message ?? adminErr?.message);
  const meTest = (who ?? []).find((u) => u.id === ctx.currentOwnId)?.is_test === true;
  const candTest = (who ?? []).find((u) => u.id === candidate?.id)?.is_test === true;
  const sendBlocked: CompanyThread["sendBlocked"] = candidate && who && meTest !== candTest ? "test_mismatch" : null;
  const canReply = myParticipant !== null || !!adminRow;

  const [sameTestStaff, schedulingUrl, meetingState] = await Promise.all([
    listSameTestStaff(ctx.tenantId, ctx.currentOwnId),
    getSchedulingUrl(ctx.tenantId, ctx.currentOwnId),
    conversationMeetingState(conversationId),
  ]);

  return {
    conv: { id: rawConv.id, kind: rawConv.kind, stage: rawConv.stage, status: rawConv.status, last_message_at: rawConv.last_message_at, created_at: rawConv.created_at },
    candidate, participants, isParticipant: myParticipant !== null, canReply, sendBlocked, messages, messagesFailed: !!msgsError,
    approachFirst, replyNote, companyAdmins: sameTestStaff ?? [], schedulingUrl, meetingState,
  };
}

/**
 * ★右側の上部の2行目（「社会人8年・AE・zap・東京都」）。候補者を探すの右欄と同じ並び。
 * ⚠️ 社名は `getCandidateProfileForCompany`（伏せた社名は出さない関数）から。取れなければ null（行ごと出さない）。
 */
export async function candidateHeaderMeta(owUserId: string): Promise<string | null> {
  const [profile, { data: u, error }] = await Promise.all([
    getCandidateProfileForCompany(owUserId),
    createAdminClient().from("ow_users").select("location").eq("id", owUserId).maybeSingle(),
  ]);
  if (error) console.error("[companyThread] location:", error.message);
  const location = (u?.location as string | null | undefined) ?? null;
  if (!profile) return location ?? null;
  const tenure = calcTotalExperience(profile.experiences.map((e) => e.startedAt));
  const tenureText = tenure ? (tenure.months < 12 ? "社会人1年未満" : `社会人${Math.floor(tenure.months / 12)}年`) : null;
  const cur = profile.experiences.find((e) => e.isCurrent);
  const role = cur ? (cur.roleTitle || cur.roleName) : null;
  const company = cur && !cur.companyMasked ? cur.company : null;
  return [tenureText, role, company, location].filter(Boolean).join("・") || null;
}

/** 既読と「企業が見た印」を書く（`loadCompanyThread` と `markCompanyThreadRead` が同じ処理を通る） */
async function writeRead(conversationId: string, participantId: string, tenantId: string): Promise<boolean> {
  const r = await mutateOne(
    createAdminClient().from("ow_conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("id", participantId),
    "biz 会話の既読",
  );
  if (!r.ok) console.error("[companyThread] 既読にできませんでした:", r.error);
  /* ★企業が見た印（送ったメッセージ・提案）。⚠️ 参加者のときだけ（読めていない人に印を付けない）。呼び出し側で company_id を確かめてある */
  await markApproachSeenByCompany(conversationId, tenantId);
  await markProposalSeenByCompany(conversationId, tenantId);
  return r.ok;
}

/**
 * ★会話を既読にする（2026-10-13 / 候補者を探すの右欄。入力欄にフォーカス・スクロール・送信したとき）。
 * ⚠️★条件は `loadCompanyThread` の既読と同じ: 会話が自社のもの（セッションで `company_id` を確かめる）かつ、
 *    自分がその会話の参加者のとき**だけ**。参加していなければ何もしない（false）。
 */
export async function markCompanyThreadRead(conversationId: string, ctx: { tenantId: string; currentOwnId: string }): Promise<boolean> {
  const supabase = createClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: conv, error: convErr } = await supabase.from("ow_conversations").select("id")
    .eq("id", conversationId).eq("company_id", ctx.tenantId).maybeSingle();
  if (convErr) console.error("[companyThread] read conv:", convErr.message);
  if (!conv) return false;
  const { data: me, error: meErr } = await supabase.from("ow_conversation_participants").select("id")
    .eq("conversation_id", conversationId).eq("user_id", ctx.currentOwnId).limit(1).maybeSingle();
  if (meErr) console.error("[companyThread] read participant:", meErr.message);
  if (!me) return false;
  return writeRead(conversationId, me.id as string, ctx.tenantId);
}
