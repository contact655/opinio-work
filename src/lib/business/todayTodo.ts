/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOpenProposals } from "@/lib/evidence/proposalEnded";

/**
 * ★企業ホームの「今日やること」（2026-10-10 / 声かけまわり 段3）。**今あるデータを読むだけ。新しい表は作らない。**
 *
 * | 種類 | 何を | どこへ |
 * |---|---|---|
 * | `approach` | 承認されたのに、まだ会話を開いていない声かけ（`company_seen_at` が null） | その会話 |
 * | `unreplied` | 最後のメッセージが求職者からの会話（＝こちらがまだ返していない） | その会話 |
 * | `proposal` | 答えていない提案（`/biz/proposals` の「未回答」と同じ条件。`listOpenProposals`） | /biz/proposals |
 * | `meetingRequest` | まだ開いていない面談申込（`/biz/meetings` の未読と同じ条件） | /biz/meetings |
 *
 * ⚠️ 「保存した条件の新着」は出さない（柴さんの判断。まだ実装されていない）。
 * ⚠️ 「今日以降の面談」は、日時を持つ表が無いのでまだ出せない（段4で `ow_meetings` を作るときに足す）。
 *    それまで4つ目の件数は「未確認の面談申込」。
 * ⚠️ 提案には締め切りが無いので「残り日数」は出せない。代わりに「届いてから◯日」を出す。
 * ⚠️ 提案の候補者は匿名。**名前を出さない**（`biz/proposals/page.tsx` と同じ）。
 * ⚠️ 種類ごとに取得に失敗したら、その種類の件数を null にする（画面は「—」。0 と出さない）。
 */
export type TodayTodoKind = "approach" | "unreplied" | "proposal" | "meetingRequest";

export type TodayTodoItem = {
  kind: TodayTodoKind;
  /** 並び順に使う日時（新しい順） */
  at: string;
  title: string;
  href: string;
};

export type TodayTodo = {
  counts: Record<TodayTodoKind, number | null>;
  items: TodayTodoItem[];
};

const DAY = 24 * 60 * 60 * 1000;
export function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));
}

export async function getTodayTodo(companyId: string): Promise<TodayTodo> {
  const db = createAdminClient();
  const counts: TodayTodo["counts"] = { approach: null, unreplied: null, proposal: null, meetingRequest: null };
  const items: TodayTodoItem[] = [];

  const [approaches, conversations, proposals, meetings] = await Promise.all([
    db.from("ow_company_approaches").select("id, accepted_at, conversation_id, candidate_user_id")
      .eq("company_id", companyId).not("accepted_at", "is", null).is("company_seen_at", null)
      .order("accepted_at", { ascending: false }),
    db.from("ow_conversations").select("id, candidate_user_id, last_message_at")
      .eq("company_id", companyId).eq("kind", "company"),
    listOpenProposals("company", { companyId }),
    db.from("ow_casual_meetings").select("id, created_at, user_id")
      .eq("company_id", companyId).is("company_read_at", null).order("created_at", { ascending: false }),
  ]);

  /* 会話の最後のメッセージが誰からか */
  let unrepliedRows: { id: string; candidate: string; at: string }[] | null = null;
  if (conversations.error) {
    console.error("[todayTodo] conversations:", conversations.error.message);
  } else {
    const convs = (conversations.data ?? []).filter((c) => c.last_message_at);
    unrepliedRows = [];
    if (convs.length > 0) {
      const ids = convs.map((c) => c.id as string);
      const [{ data: msgs, error: mErr }, { data: parts, error: pErr }] = await Promise.all([
        db.from("ow_conversation_messages").select("conversation_id, sender_participant_id, sent_at")
          .in("conversation_id", ids).is("deleted_at", null).order("sent_at", { ascending: false }),
        db.from("ow_conversation_participants").select("id, user_id").in("conversation_id", ids),
      ]);
      if (mErr || pErr) {
        console.error("[todayTodo] messages:", mErr?.message ?? pErr?.message);
        unrepliedRows = null;
      } else {
        const userByPart = new Map((parts ?? []).map((p) => [p.id as string, (p.user_id as string | null) ?? null]));
        const last = new Map<string, { sender: string | null; at: string }>();
        for (const m of msgs ?? []) {
          const cid = m.conversation_id as string;
          if (!last.has(cid)) last.set(cid, { sender: userByPart.get(m.sender_participant_id as string) ?? null, at: m.sent_at as string });
        }
        for (const c of convs) {
          const l = last.get(c.id as string);
          if (l && l.sender && l.sender === c.candidate_user_id) unrepliedRows.push({ id: c.id as string, candidate: c.candidate_user_id as string, at: l.at });
        }
      }
    }
  }

  /* 名前（声かけ・会話・面談申込）。⚠️ 提案は匿名なので引かない */
  const nameIds = new Set<string>();
  for (const a of approaches.data ?? []) nameIds.add(a.candidate_user_id as string);
  for (const u of unrepliedRows ?? []) nameIds.add(u.candidate);
  for (const m of meetings.data ?? []) nameIds.add(m.user_id as string);
  const names = new Map<string, string>();
  if (nameIds.size > 0) {
    const { data, error } = await db.from("ow_users").select("id, name").in("id", Array.from(nameIds));
    if (error) console.error("[todayTodo] names:", error.message);
    for (const u of data ?? []) names.set(u.id as string, (u.name as string) || "名前未設定");
  }
  const nameOf = (id: string) => names.get(id) ?? "求職者";

  if (approaches.error) console.error("[todayTodo] approaches:", approaches.error.message);
  else {
    counts.approach = approaches.data?.length ?? 0;
    for (const a of approaches.data ?? []) {
      items.push({
        kind: "approach", at: a.accepted_at as string,
        title: `${nameOf(a.candidate_user_id as string)} さんが声かけを承認しました`,
        href: a.conversation_id ? `/biz/conversations/${a.conversation_id}` : "/biz/approaches",
      });
    }
  }
  if (unrepliedRows) {
    counts.unreplied = unrepliedRows.length;
    for (const u of unrepliedRows) {
      items.push({ kind: "unreplied", at: u.at, title: `${nameOf(u.candidate)} さんへの返信がまだです`, href: `/biz/conversations/${u.id}` });
    }
  }
  if (proposals) {
    counts.proposal = proposals.length;
    for (const p of proposals) {
      items.push({ kind: "proposal", at: p.createdAt, title: `答えていない提案（届いてから${daysSince(p.createdAt)}日）`, href: "/biz/proposals" });
    }
  }
  if (meetings.error) console.error("[todayTodo] meetings:", meetings.error.message);
  else {
    counts.meetingRequest = meetings.data?.length ?? 0;
    for (const m of meetings.data ?? []) {
      items.push({ kind: "meetingRequest", at: m.created_at as string, title: `${nameOf(m.user_id as string)} さんから面談の申し込み`, href: "/biz/meetings" });
    }
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return { counts, items };
}
