import type { CompanyRole } from "@/lib/auth/roles";
/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMessageTodoIds } from "@/lib/business/navBadges";
import { listSavedSearchesWithCounts } from "@/lib/business/savedSearchServer";
import { countUnconfirmedMaterialItems } from "@/lib/companyMaterials/server";
import { canUse, type PlanType } from "@/lib/constants/plans";
import { listCompanyMeetings } from "@/lib/meetings/server";
import { MEETING_FORMATS } from "@/lib/constants/meetings";
import type { HomeActionItem, HomeActions, HomeMeeting } from "@/lib/business/homeTypes";

/**
 * ★企業ホームの「対応が必要なもの」（2026-10-12 / 柴さんの指示。旧 `todayTodo.ts` と上の数字タイルを1つにした）。
 *   **件数はこの関数の items の数だけ。** 画面で別に数えない。
 *
 * | 行 | 数え方（どこと同じか） |
 * |---|---|
 * | メッセージ | `companyMessageTodoIds`（サイドバーの「メッセージ」バッジ・メッセージ画面の「未読」と同じ関数） |
 * | 返信していない | ★最後のメッセージが候補者から（開いたかどうかは問わない。2026-10-12）。⚠️ 上の未読に入っている会話は出さない（未読の行を優先） |
 * | 面談の申込 | `ow_casual_meetings.company_read_at` が空（選考管理の未読の太字と同じ） |
 * | 応募 | `ow_job_applications.status = 'pending'`（選考管理の「新着」） |
 * | 保存した条件の新着 | `listSavedSearchesWithCounts`（保存した条件の画面と同じ。候補者検索を使える企業だけ） |
 * | 運営が停止した求人 | 呼び出し側の `getJobStatusCounts().stoppedByOps`（求人管理の「停止中（運営が停止）」と同じ `jobState`） |
 * | 企業資料の未確定 | `countUnconfirmedMaterialItems` |
 *
 * ⚠️★旧ホームで「新しい返信 0」と「〇〇さんから返信があります」が食い違っていたのは、前者が「返信を誰もまだ開いていない」、
 *    後者が「最後のメッセージが求職者から（＝こちらがまだ返していない）」を数えていたため。いまはメッセージ画面の
 *    「未読」と同じ定義に、★「返信していない」を足した（2026-10-12 / 柴さんの指示）。同じ会話は1行だけ。
 * ⚠️ サイドバーの「メッセージ」の数字は未読だけのまま（返信していないものは数えない）。
 * ★今日・明日の面談は件数に入れない（`meetings` に別に返す。選考管理の「決まった面談」と同じ `listCompanyMeetings`）。
 * ⚠️ 種類ごとに取得に失敗したら `failed` に名前を入れる（行を出さず、0件を装わない）。
 * ⚠️ 在籍報告の結果・再開依頼の結果は「企業が見たか」の記録が無いので行にしていない（運営が停止した求人は上の行に出る）。
 */
export async function getBizActionItems(params: {
  companyId: string;
  owUserId: string;
  permission: CompanyRole;
  planType: PlanType | null;
  reviewed: boolean;
  /** `getJobStatusCounts().stoppedByOps`。取れなければ null */
  stoppedByOps: number | null;
}): Promise<HomeActions> {
  const db = createAdminClient();
  const items: HomeActionItem[] = [];
  const failed: string[] = [];
  const now = new Date().toISOString();

  const [msg, meetings, applications, materials, companyConvs, upcoming] = await Promise.all([
    companyMessageTodoIds({ owUserId: params.owUserId, companyId: params.companyId }).catch((e) => { console.error("[actionItems] messages:", e); return null; }),
    db.from("ow_casual_meetings").select("id, created_at, user_id")
      .eq("company_id", params.companyId).is("company_read_at", null).order("created_at", { ascending: false }),
    db.from("ow_job_applications").select("id, created_at, user_id, name, status, ow_jobs!inner(title, company_id)")
      .eq("ow_jobs.company_id", params.companyId).eq("status", "pending").order("created_at", { ascending: false }),
    countUnconfirmedMaterialItems(params.companyId),
    /* ★返信していない会話の材料（企業との会話すべて） */
    db.from("ow_conversations").select("id, candidate_user_id, last_message_at").eq("company_id", params.companyId).eq("kind", "company").not("last_message_at", "is", null),
    listCompanyMeetings(params.companyId, { upcoming: true }),
  ]);

  /* ★返信していない会話: 最後のメッセージを送ったのが候補者本人。⚠️ 送った人の無い行（提案の案内）は数えない */
  let unanswered: { id: string; candidate: string; at: string }[] | null = null;
  if (companyConvs.error) console.error("[actionItems] company conversations:", companyConvs.error.message);
  else {
    unanswered = [];
    const rows = companyConvs.data ?? [];
    if (rows.length > 0) {
      const ids = rows.map((c) => c.id as string);
      const [{ data: lastMsgs, error: mErr }, { data: parts, error: pErr }] = await Promise.all([
        db.from("ow_conversation_messages").select("conversation_id, sender_participant_id, sent_at")
          .in("conversation_id", ids).is("deleted_at", null).order("sent_at", { ascending: false }),
        db.from("ow_conversation_participants").select("id, user_id").in("conversation_id", ids),
      ]);
      if (mErr || pErr) { console.error("[actionItems] last messages:", mErr?.message ?? pErr?.message); unanswered = null; }
      else {
        const userByPart = new Map((parts ?? []).map((p) => [p.id as string, (p.user_id as string | null) ?? null]));
        const last = new Map<string, { sender: string | null; at: string }>();
        for (const m of lastMsgs ?? []) {
          const cid = m.conversation_id as string;
          if (!last.has(cid)) last.set(cid, { sender: m.sender_participant_id ? userByPart.get(m.sender_participant_id as string) ?? null : null, at: m.sent_at as string });
        }
        for (const c of rows) {
          const l = last.get(c.id as string);
          if (l?.sender && l.sender === c.candidate_user_id) unanswered.push({ id: c.id as string, candidate: c.candidate_user_id as string, at: l.at });
        }
      }
    }
  }

  /* 会話（対応が必要なメッセージ）の相手と日時。⚠️ 自社の会話だけ（company_id で絞る） */
  const convIds = msg ? Array.from(msg.all) : [];
  const convs = convIds.length > 0
    ? await db.from("ow_conversations").select("id, candidate_user_id, last_message_at, created_at").in("id", convIds).eq("company_id", params.companyId)
    : { data: [], error: null };
  if (convs.error) console.error("[actionItems] conversations:", convs.error.message);

  /* 名前 */
  const nameIds = new Set<string>();
  for (const c of convs.data ?? []) if (c.candidate_user_id) nameIds.add(c.candidate_user_id as string);
  for (const u of unanswered ?? []) nameIds.add(u.candidate);
  for (const m of meetings.data ?? []) if (m.user_id) nameIds.add(m.user_id as string);
  const names = new Map<string, string>();
  if (nameIds.size > 0) {
    const { data, error } = await db.from("ow_users").select("id, name").in("id", Array.from(nameIds));
    if (error) console.error("[actionItems] names:", error.message);
    for (const u of data ?? []) names.set(u.id as string, (u.name as string) || "名前未設定");
  }
  const nameOf = (id: string | null | undefined) => (id && names.get(id)) || "求職者";

  if (!msg || convs.error) failed.push("メッセージ");
  else {
    for (const c of convs.data ?? []) {
      const id = c.id as string;
      const who = nameOf(c.candidate_user_id as string | null);
      const at = (c.last_message_at as string | null) ?? (c.created_at as string);
      const kind = msg.fromProposals.has(id) ? "interest" : msg.replied.has(id) ? "reply" : "message";
      const title = kind === "interest" ? `${who}さんが、貴社の話を聞いてみたいそうです`
        : kind === "reply" ? `${who}さんから返信がありました`
        : `${who}さんから新しいメッセージがあります`;
      items.push({ kind, at, title, sub: relDays(at), action: "返信する", href: `/biz/messages?show=${id}` });
    }
  }

  /* ★返信していない（未読の会話は上で1行出したので出さない）。⚠️ 未読の取得に失敗したときは、二重に出さないよう出さない */
  if (unanswered === null) failed.push("返信していない会話");
  else if (msg) {
    for (const u of unanswered.filter((x) => !msg.all.has(x.id))) {
      items.push({ kind: "unanswered", at: u.at, title: `${nameOf(u.candidate)}さんに返信していません（${jstDateTime(u.at)}〜）`, action: "返信する", href: `/biz/messages?show=${u.id}` });
    }
  }

  if (meetings.error) { console.error("[actionItems] meetings:", meetings.error.message); failed.push("面談の申込"); }
  else for (const m of meetings.data ?? []) {
    items.push({ kind: "meetingRequest", at: m.created_at as string, title: `${nameOf(m.user_id as string | null)}さんから面談の申し込み`, sub: relDays(m.created_at as string), action: "確認する", href: `/biz/meetings?show=m:${m.id}` });
  }

  if (applications.error) { console.error("[actionItems] applications:", applications.error.message); failed.push("応募"); }
  else for (const a of applications.data ?? []) {
    const job = Array.isArray(a.ow_jobs) ? a.ow_jobs[0] : a.ow_jobs;
    items.push({ kind: "application", at: a.created_at as string, title: `${(a.name as string) || "応募者"}さんから応募がありました`,
      sub: [relDays(a.created_at as string), job?.title ? `求人：${job.title as string}` : null].filter(Boolean).join(" ・ "), action: "確認する", href: `/biz/meetings?show=a:${a.id}` });
  }

  /* ★保存した条件の新着。⚠️ 候補者検索を使えない企業では数えない（画面と同じゲート） */
  if (params.reviewed && canUse(params.planType, "candidateSearch")) {
    const saved = await listSavedSearchesWithCounts({ companyId: params.companyId, viewerOwUserId: params.owUserId, viewerPermission: params.permission, planType: params.planType });
    if (!saved) failed.push("保存した条件");
    else for (const s of saved.filter((x) => (x.newCount ?? 0) > 0)) {
      items.push({ kind: "savedSearch", at: now, title: `保存した条件「${s.name}」に新着 ${s.newCount}名`,
        sub: typeof s.newApproachableCount === "number" ? `うちメッセージを送れる方 ${s.newApproachableCount}名` : undefined,
        action: "確認する", href: `/biz/candidates?saved=${s.id}&new=1` });
    }
  }

  if (params.stoppedByOps === null) failed.push("求人");
  else if (params.stoppedByOps > 0) {
    items.push({ kind: "stoppedJobs", at: now, title: `運営が停止した求人 ${params.stoppedByOps}件`, sub: "内容を直して、再開を依頼できます", action: "確認する", href: "/biz/jobs?status=stopped" });
  }

  if (materials === null) failed.push("企業資料");
  else if (materials > 0) {
    items.push({ kind: "materials", at: now, title: `企業資料の未確定の項目 ${materials}件`, sub: "確定するまで求職者には出ません", action: "確認する", href: "/biz/materials" });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  /* ★今日・明日の面談（日本時間）。⚠️ 取れなければ null（枠を出さない。0件とは言わない） */
  let todayMeetings: HomeMeeting[] | null = null;
  if (upcoming) {
    const today = jstDateKey(new Date());
    const tomorrow = jstDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
    todayMeetings = upcoming
      .filter((m) => { const k = jstDateKey(new Date(m.startsAt)); return k === today || k === tomorrow; })
      .map((m) => ({
        id: m.id, dayLabel: jstDateKey(new Date(m.startsAt)) === today ? "今日" as const : "明日" as const,
        time: jstTime(m.startsAt), name: m.candidateName, detail: `${MEETING_FORMATS[m.format]}・${m.duration}分`,
        href: `/biz/messages?show=${m.conversationId}`,
      }));
  }
  return { items, failed, meetings: todayMeetings };
}

const JST = "Asia/Tokyo";
/** 「2026-10-12」（日本時間） */
function jstDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JST, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** 「15:00」（日本時間） */
function jstTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: JST, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
/** 「10月12日 03:00」（日本時間） */
function jstDateTime(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("ja-JP", { timeZone: JST, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}月${p.day}日 ${p.hour}:${p.minute}`;
}

/** 「今日」「2日前」。⚠️ 7日を超えたら日付（日本時間） */
function relDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (d <= 0) return "今日";
  if (d <= 7) return `${d}日前`;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}
