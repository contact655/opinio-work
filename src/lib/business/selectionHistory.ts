import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSentApproaches } from "@/lib/approaches/server";
import { listCompanyProposals } from "@/lib/evidence/companyProposals";
import { APPLICATION_STATUS_TABS } from "@/lib/business/applications";
import { STATUS_TABS } from "@/lib/business/mockMeetings";

/**
 * ★この会社とのこれまで（2026-10-11 / 選考管理の二重応募チェック）。
 *   同じ候補者 × 同じ会社の、応募・カジュアル面談・送ったメッセージ・OPINIO のおすすめ・面談を時系列（新しい順）に。
 *
 * ⚠️★**同じアカウントだけ**（柴さんの判断）。名前・メール・電話で別アカウントを突き合わせない（推測になり、横断の記録を作ることにもなる）。
 * ⚠️★見せてはいけないものを混ぜない:
 *    - 送ったメッセージの「見送り」は出さない（`listSentApproaches` は declined_at を読まない。状態は返信あり／なしだけ）
 *    - OPINIO のおすすめは `listCompanyProposals` だけ（求職者が「話を聞いてみたい」と答え、いま見せてよいものだけ）
 * ⚠️ 自社のもの（company_id = 呼び出し側で getTenantContext 済みの会社）だけ。
 */
export type HistoryItem = {
  key: string;
  at: string;
  kind: "application" | "meeting_request" | "approach_sent" | "approach_reply" | "proposal" | "meeting";
  title: string;
  sub: string | null;
};

const meetingLabel = (s: string) => STATUS_TABS.find((t) => t.status === s)?.label ?? (s === "scheduling" ? "日程調整中" : null);
const appLabel = (s: string) => APPLICATION_STATUS_TABS.find((t) => t.status === s)?.labelJa ?? null;

export async function getSelectionHistory(companyId: string, candidateUserId: string): Promise<HistoryItem[] | null> {
  const db = createAdminClient();
  const [apps, meetings, booked, sent, proposals] = await Promise.all([
    db.from("ow_job_applications").select("id, created_at, status, ow_jobs!inner(title, company_id)")
      .eq("user_id", candidateUserId).eq("ow_jobs.company_id", companyId),
    db.from("ow_casual_meetings").select("id, created_at, status, ow_jobs!job_id(title)")
      .eq("user_id", candidateUserId).eq("company_id", companyId),
    db.from("ow_meetings").select("id, starts_at, status, created_at")
      .eq("candidate_user_id", candidateUserId).eq("company_id", companyId),
    listSentApproaches(companyId),
    listCompanyProposals(companyId),
  ]);
  for (const r of [apps, meetings, booked]) {
    if (r.error) { console.error("[selectionHistory]", r.error.message); return null; }
  }
  if (sent === null || proposals === null) return null;

  const title = (j: unknown) => {
    const x = Array.isArray(j) ? j[0] : j;
    return (x as { title?: string } | null)?.title ?? null;
  };
  const items: HistoryItem[] = [];
  for (const a of apps.data ?? []) {
    items.push({ key: `a:${a.id}`, at: a.created_at as string, kind: "application",
      title: `応募：${title(a.ow_jobs) ?? "求人"}`, sub: appLabel(a.status as string) });
  }
  for (const m of meetings.data ?? []) {
    items.push({ key: `m:${m.id}`, at: m.created_at as string, kind: "meeting_request",
      title: `カジュアル面談の申込：${title(m.ow_jobs) ?? "ポジション指定なし"}`, sub: meetingLabel(m.status as string) });
  }
  for (const b of booked.data ?? []) {
    const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(b.starts_at as string));
    const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
    items.push({ key: `b:${b.id}`, at: b.created_at as string, kind: "meeting",
      title: `面談：${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")}`, sub: b.status === "canceled" ? "取り消し" : null });
  }
  for (const s of sent.filter((r) => r.candidate.id === candidateUserId)) {
    items.push({ key: `s:${s.id}`, at: s.createdAt, kind: "approach_sent",
      title: `メッセージを送信${s.senderName ? `（${s.senderName}）` : ""}`, sub: s.status === "accepted" ? null : s.status === "pending" ? "返信を待っています" : "返信はありませんでした" });
    if (s.acceptedAt) items.push({ key: `r:${s.id}`, at: s.acceptedAt, kind: "approach_reply", title: "メッセージに返信がありました", sub: null });
  }
  for (const p of proposals.filter((r) => r.candidateUserId === candidateUserId)) {
    items.push({ key: `p:${p.id}`, at: p.raisedAt, kind: "proposal",
      title: `OPINIO のおすすめから「話を聞いてみたい」${p.jobTitle ? `：${p.jobTitle}` : ""}`, sub: null });
  }
  return items.sort((x, y) => y.at.localeCompare(x.at));
}
