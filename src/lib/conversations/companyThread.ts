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

export async function loadCompanyThread(conversationId: string, ctx: { tenantId: string; currentOwnId: string }): Promise<CompanyThread | null> {
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
  if (myParticipant && !msgsError) {
    const r = await mutateOne(
      createAdminClient().from("ow_conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("id", myParticipant.id),
      "biz 会話の既読",
    );
    if (!r.ok) console.error("[companyThread] 既読にできませんでした:", r.error);
    /* ★企業が見た印（送ったメッセージ・提案）。⚠️ 参加者のときだけ（読めていない人に印を付けない）。上で company_id を確かめてある */
    await markApproachSeenByCompany(conversationId, ctx.tenantId);
    await markProposalSeenByCompany(conversationId, ctx.tenantId);
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
      const expected = `【送った理由】\n${ap.reason as string}${ap.body ? `\n\n${ap.body as string}` : ""}`;
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

  const [sameTestStaff, schedulingUrl, meetingState] = await Promise.all([
    listSameTestStaff(ctx.tenantId, ctx.currentOwnId),
    getSchedulingUrl(ctx.tenantId, ctx.currentOwnId),
    conversationMeetingState(conversationId),
  ]);

  return {
    conv: { id: rawConv.id, kind: rawConv.kind, stage: rawConv.stage, status: rawConv.status, last_message_at: rawConv.last_message_at, created_at: rawConv.created_at },
    candidate, participants, isParticipant: myParticipant !== null, messages, messagesFailed: !!msgsError,
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
