/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOpenProposals, proposalDaysLeft } from "@/lib/evidence/proposalEnded";
import { listCompanyMeetings } from "@/lib/meetings/server";
import { MEETING_FORMATS, formatMeetingDateTime } from "@/lib/constants/meetings";
import { listSavedSearchesWithCounts } from "@/lib/business/savedSearchServer";
import { canUse, type PlanType } from "@/lib/constants/plans";

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
 * | `savedSearch` | 新着が1名以上ある保存した条件（自分の条件＋共有。2026-10-10 / 候補者探し 段3） | その条件の新着 |
 * ⚠️ 保存した条件の新着は、見ている担当者ごとに違う（前回見た日時が担当者ごと）。viewer を渡したときだけ数える。
 * | `meeting` | 今日以降の面談（`ow_meetings`。取り消しを除く。2026-10-10 / 段4） | その会話 |
 * ⚠️ 件数カードの4つ目は 2026-10-10（段4）から「今日以降の面談」。面談申込は一覧にだけ出す。
 * ★提案は締め切り（届いてから30日。`respond_by`）まで「あと◯日」を出す（2026-10-10）。
 * ⚠️ 提案の候補者は匿名。**名前を出さない**（`biz/proposals/page.tsx` と同じ）。
 * ⚠️ 種類ごとに取得に失敗したら、その種類の件数を null にする（画面は「—」。0 と出さない）。
 */
export type TodayTodoKind = "approach" | "unreplied" | "proposal" | "meetingRequest" | "meeting" | "savedSearch";

export type TodayTodoItem = {
  kind: TodayTodoKind;
  /** 並び順に使う日時（新しい順） */
  at: string;
  title: string;
  /** ★2行目の補足（2026-10-11 / キャンバス7）。無ければ出さない */
  sub?: string;
  /** ★ボタンの文言（2026-10-11）。⚠️ 主な操作（承認された声かけ）だけ primary */
  action: string;
  href: string;
};

export type TodayTodo = {
  counts: Record<TodayTodoKind, number | null>;
  /** ★保存した条件の新着の人数の合計（2026-10-11）。⚠️ counts.savedSearch は「新着がある条件の数」。取れなければ null */
  savedSearchPeople: number | null;
  items: TodayTodoItem[];
};

export async function getTodayTodo(
  companyId: string,
  viewer?: { owUserId: string; permission: "admin" | "member"; planType: PlanType | null; reviewed: boolean },
): Promise<TodayTodo> {
  const db = createAdminClient();
  const counts: TodayTodo["counts"] = { approach: null, unreplied: null, proposal: null, meetingRequest: null, meeting: null, savedSearch: null };
  const items: TodayTodoItem[] = [];
  let savedSearchPeople: number | null = null;

  const [approaches, conversations, proposals, meetings, upcoming] = await Promise.all([
    db.from("ow_company_approaches").select("id, accepted_at, conversation_id, candidate_user_id, sender_user_id")
      .eq("company_id", companyId).not("accepted_at", "is", null).is("company_seen_at", null)
      .order("accepted_at", { ascending: false }),
    db.from("ow_conversations").select("id, candidate_user_id, last_message_at")
      .eq("company_id", companyId).eq("kind", "company"),
    listOpenProposals("company", { companyId }),
    db.from("ow_casual_meetings").select("id, created_at, user_id")
      .eq("company_id", companyId).is("company_read_at", null).order("created_at", { ascending: false }),
    listCompanyMeetings(companyId, { upcoming: true }),
  ]);

  /* 会話の最後のメッセージが誰からか */
  let unrepliedRows: { id: string; candidate: string; at: string; body: string | null }[] | null = null;
  if (conversations.error) {
    console.error("[todayTodo] conversations:", conversations.error.message);
  } else {
    const convs = (conversations.data ?? []).filter((c) => c.last_message_at);
    unrepliedRows = [];
    if (convs.length > 0) {
      const ids = convs.map((c) => c.id as string);
      const [{ data: msgs, error: mErr }, { data: parts, error: pErr }] = await Promise.all([
        db.from("ow_conversation_messages").select("conversation_id, sender_participant_id, sent_at, body, kind")
          .in("conversation_id", ids).is("deleted_at", null).order("sent_at", { ascending: false }),
        db.from("ow_conversation_participants").select("id, user_id").in("conversation_id", ids),
      ]);
      if (mErr || pErr) {
        console.error("[todayTodo] messages:", mErr?.message ?? pErr?.message);
        unrepliedRows = null;
      } else {
        const userByPart = new Map((parts ?? []).map((p) => [p.id as string, (p.user_id as string | null) ?? null]));
        const last = new Map<string, { sender: string | null; at: string; body: string | null }>();
        for (const m of msgs ?? []) {
          const cid = m.conversation_id as string;
          if (!last.has(cid)) last.set(cid, { sender: userByPart.get(m.sender_participant_id as string) ?? null, at: m.sent_at as string, body: (m.kind ?? "text") === "text" ? (m.body as string | null) : null });
        }
        for (const c of convs) {
          const l = last.get(c.id as string);
          if (l && l.sender && l.sender === c.candidate_user_id) unrepliedRows.push({ id: c.id as string, candidate: c.candidate_user_id as string, at: l.at, body: l.body });
        }
      }
    }
  }

  /* 名前（声かけ・会話・面談申込）。⚠️ 提案は匿名なので引かない */
  const nameIds = new Set<string>();
  for (const a of approaches.data ?? []) {
    nameIds.add(a.candidate_user_id as string);
    if (a.sender_user_id) nameIds.add(a.sender_user_id as string);
  }
  for (const p of proposals ?? []) nameIds.add(p.candidateUserId);
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
        title: `${nameOf(a.candidate_user_id as string)} さんが声かけを受け入れました`,
        sub: [fmtMd(a.accepted_at as string), a.sender_user_id ? `送った人：${nameOf(a.sender_user_id as string)}` : null, "まだ誰も会話を開いていません"].filter(Boolean).join(" ・ "),
        action: "メッセージを開く",
        href: a.conversation_id ? `/biz/conversations/${a.conversation_id}` : "/biz/approaches",
      });
    }
  }
  if (unrepliedRows) {
    counts.unreplied = unrepliedRows.length;
    for (const u of unrepliedRows) {
      /* ⚠️ 本文は冒頭だけ（自社の会話なので見せてよい）。候補日などの種類つきのメッセージは出さない */
      const snippet = u.body ? `「${u.body.replace(/\s+/g, " ").slice(0, 40)}${u.body.length > 40 ? "…" : ""}」` : null;
      items.push({ kind: "unreplied", at: u.at, title: `${nameOf(u.candidate)} さんから返信があります`, sub: [relDays(u.at), snippet].filter(Boolean).join(" ・ "), action: "返信する", href: `/biz/conversations/${u.id}` });
    }
  }
  if (proposals) {
    counts.proposal = proposals.length;
    for (const p of proposals) {
      const left = proposalDaysLeft(p.respondBy);
      items.push({ kind: "proposal", at: p.createdAt, title: `${nameOf(p.candidateUserId)} さんの提案に回答してください`, sub: [left <= 1 ? "今日で終了" : `あと${left}日で終了`, `根拠${p.evidenceCount}つ`].join(" ・ "), action: "提案を見る", href: "/biz/proposals" });
    }
  }
  if (meetings.error) console.error("[todayTodo] meetings:", meetings.error.message);
  else {
    counts.meetingRequest = meetings.data?.length ?? 0;
    for (const m of meetings.data ?? []) {
      items.push({ kind: "meetingRequest", at: m.created_at as string, title: `${nameOf(m.user_id as string)} さんから面談の申し込み`, sub: fmtMd(m.created_at as string), action: "申し込みを見る", href: "/biz/meetings" });
    }
  }

  if (upcoming) {
    counts.meeting = upcoming.length;
    /* ⚠️ 並び順の日時は「決まった日」ではなく面談の日時なので、近い予定が上に来る */
    for (const m of upcoming) {
      items.push({ kind: "meeting", at: m.startsAt, title: `${m.candidateName} さんとの面談`, sub: [`${formatMeetingDateTime(m.startsAt)}（${m.duration}分）`, MEETING_FORMATS[m.format], m.attendees.length ? `同席：${m.attendees.join("、")}` : null].filter(Boolean).join(" ・ "), action: "予定を見る", href: `/biz/conversations/${m.conversationId}` });
    }
  }

  /* ★保存した条件の新着（段3）。⚠️ 候補者検索を使えない企業では数えない（画面と同じゲート） */
  if (viewer && viewer.reviewed && canUse(viewer.planType, "candidateSearch")) {
    const saved = await listSavedSearchesWithCounts({ companyId, viewerOwUserId: viewer.owUserId, viewerPermission: viewer.permission, planType: viewer.planType });
    if (saved) {
      const withNew = saved.filter((s) => (s.newCount ?? 0) > 0);
      counts.savedSearch = withNew.length;
      savedSearchPeople = withNew.reduce((n, s) => n + (s.newCount ?? 0), 0);
      for (const s of withNew) {
        /* ⚠️ 日付は「今日」（新着は今の時点の数）。前回見た日時を出すと、いつの新着か誤読される */
        items.push({ kind: "savedSearch", at: new Date().toISOString(), title: `保存した条件「${s.name}」に新着 ${s.newCount}名`, sub: "前回この条件を見たあとに登録・更新した方", action: "新着を見る", href: `/biz/candidates?saved=${s.id}&new=1` });
      }
    }
  }

  items.sort((a, b) => (a.kind === "meeting") !== (b.kind === "meeting") ? (a.kind === "meeting" ? -1 : 1)
    : a.kind === "meeting" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at));
  return { counts, savedSearchPeople, items };
}

/** 日本時間で「10月8日」 */
function fmtMd(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}
/** 「今日」「2日前」。⚠️ 7日を超えたら日付 */
function relDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return d <= 0 ? "今日" : d <= 7 ? `${d}日前` : fmtMd(iso);
}
