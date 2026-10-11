"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeetingApplication, MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";
import type { ApplicationStatus, BizApplication } from "@/lib/business/applications";
import { APPLICATION_STATUS_TABS } from "@/lib/business/applications";
import type { HistoryItem } from "@/lib/business/selectionHistory";
import { MeetingDetailPanel } from "@/components/business/MeetingDetailPanel";
import { MeetingEmptyState, type MeetingAcceptance } from "@/components/business/MeetingEmptyState";
import { DetailPanel as ApplicationDetailPanel } from "../applications/ApplicationsClient";
import { CandidateProfileDrawerButton } from "@/components/candidates/CandidateProfileDrawer";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { MESSAGES_SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";

/**
 * ★選考管理（/biz/meetings）の左右2画面（2026-10-11 / 柴さんの指示。メッセージ画面と同じ形）。
 *   左 … カジュアル面談と選考・応募を1本の一覧に（新しい順）。タブ すべて／カジュアル面談／選考・応募、その下で「対応中／終了」
 *         1行目 名前＋時刻 ／ 2行目 種類・ポジション ／ 3行目 灰色の状態（バッジにしない）
 *   右 … 上の段（固定）: 名前＋↗（プロフィール欄をドロワーで）・2行目の要約・「メッセージを開く」・種類とポジションと受付日
 *         中身: **今の詳細パネルをそのまま**（面談: 日程確定・見送りの確認・担当・社内メモ ／ 応募: 状態の変更・採用確定）
 *               ＋「この会社とのこれまで」（同じアカウントの応募・面談・送ったメッセージ・おすすめを時系列で）
 * ⚠️ 操作（状態の変更・メールが飛ぶ確認・担当・メモ）は以前の MeetingsClient / ApplicationsClient と同じ API・同じ流れ。ここで変えない。
 * ⚠️ 選択は URL の ?show=m:<id> / a:<id> に残す。1280px 以上で何も選んでいなければ一番上を選ぶ。1279px 以下は一覧だけ → 押すと右側を全幅。
 * ⚠️ 社員との共通点は今回は出さない（2026-10-11 / 柴さんの判断）。
 */

type CurrentUser = { owUserId: string; name: string; initial: string; gradient: string };
/** 決まった面談（ow_meetings。今日以降・取り消し除く）。上に並べる */
export type ScheduledMeetingRow = {
  id: string; conversationId: string; candidateName: string; whenText: string;
  formatLabel: string; duration: number; origin: "approach" | "proposal" | null;
};
type MemoSaveState = "idle" | "saving" | "saved";
export type SelectionTab = "all" | "meetings" | "applications";
type Item =
  | { kind: "meeting"; key: string; userId: string | null; name: string; at: string; jobTitle: string | null; closed: boolean; unread: boolean; conversationId?: string; m: MeetingApplication }
  | { kind: "application"; key: string; userId: string | null; name: string; at: string; jobTitle: string | null; closed: boolean; unread: boolean; conversationId?: string; a: BizApplication };

const MEETING_CLOSED: MeetingStatus[] = ["completed", "declined"];
const APP_CLOSED: ApplicationStatus[] = ["rejected", "hired"];
const meetingStatusLabel = (s: string) => STATUS_TABS.find((t) => t.status === s)?.label ?? (s === "scheduling" ? "日程調整中" : s);
const appStatusLabel = (s: string) => APPLICATION_STATUS_TABS.find((t) => t.status === s)?.labelJa ?? s;

function fmtListDate(iso: string, now: Date): string {
  const tz = { timeZone: "Asia/Tokyo" } as const;
  const part = (x: Date) => new Intl.DateTimeFormat("ja-JP", { ...tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(x);
  const v = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
  const d = new Date(iso);
  const pd = part(d), pn = part(now);
  if (v(pd, "year") === v(pn, "year") && v(pd, "month") === v(pn, "month") && v(pd, "day") === v(pn, "day")) {
    return new Intl.DateTimeFormat("ja-JP", { ...tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
  return `${v(pd, "year") === v(pn, "year") ? "" : `${v(pd, "year")}/`}${v(pd, "month")}/${v(pd, "day")}`;
}
function fmtDate(iso: string): string {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const v = (t: string) => ps.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}年${v("month")}月${v("day")}日`;
}

export function SelectionView({
  meetings: initialMeetings, applications: initialApplications, currentUser, acceptance = null, hasPublishedJobs = false,
  initialTab = "all", initialShow = null, autoSelect = true, linkBase = "/biz/meetings", now: nowIso, fixtures, scheduled = null,
}: {
  /** ★決まった面談（今日以降）。取れなければ null */
  scheduled?: ScheduledMeetingRow[] | null;
  meetings: MeetingApplication[];
  applications: BizApplication[];
  currentUser: CurrentUser;
  acceptance?: MeetingAcceptance | null;
  hasPublishedJobs?: boolean;
  initialTab?: SelectionTab;
  /** ?show= の値（`m:<id>` / `a:<id>`） */
  initialShow?: string | null;
  /** /dev/preview では false（URL を書き換えない） */
  autoSelect?: boolean;
  linkBase?: string;
  now: string;
  /** /dev/preview 用。候補者ごとの上の段の要約とこれまで（API を呼ばない） */
  fixtures?: Record<string, { meta: string | null; history: HistoryItem[] }>;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [applications, setApplications] = useState(initialApplications);
  const [tab, setTab] = useState<SelectionTab>(initialTab);
  const [closedView, setClosedView] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialShow);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(null), 4000); };

  const items: Item[] = useMemo(() => [
    ...meetings.map((m): Item => ({ kind: "meeting", key: `m:${m.id}`, userId: m.applicantUserId, name: m.applicantName, at: m.createdAt ?? "", jobTitle: m.jobTitle,
      closed: MEETING_CLOSED.includes(m.status), unread: m.isUnread, conversationId: m.conversationId, m })),
    ...applications.map((a): Item => ({ kind: "application", key: `a:${a.id}`, userId: a.userId, name: a.name, at: a.createdAt, jobTitle: a.jobTitle,
      closed: APP_CLOSED.includes(a.status), unread: false, conversationId: a.conversationId, a })),
  ].sort((x, y) => y.at.localeCompare(x.at)), [meetings, applications]);

  /* ★同じ人が複数並んでいるか（一覧の3行目に「ほかにも〇件」）。⚠️ 同じアカウントだけ */
  const perUser = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of items) if (it.userId) c.set(it.userId, (c.get(it.userId) ?? 0) + 1);
    return c;
  }, [items]);

  const inTab = items.filter((it) => tab === "all" || (tab === "meetings" ? it.kind === "meeting" : it.kind === "application"));
  const shown = inTab.filter((it) => it.closed === closedView);
  const counts = {
    all: items.filter((i) => !i.closed).length,
    meetings: items.filter((i) => i.kind === "meeting" && !i.closed).length,
    applications: items.filter((i) => i.kind === "application" && !i.closed).length,
  };
  const selected = items.find((it) => it.key === selectedKey) ?? null;

  const urlOf = useCallback((key: string | null, t: SelectionTab = tab) => {
    const q = new URLSearchParams();
    if (t !== "all") q.set("tab", t);
    if (key) q.set("show", key);
    const s = q.toString();
    return s ? `${linkBase}?${s}` : linkBase;
  }, [linkBase, tab]);

  const markMeetingRead = useCallback((id: string) => {
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, isUnread: false } : m)));
    fetch(`/api/biz/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_read" }) }).catch(console.error);
  }, []);

  const select = useCallback((key: string) => {
    setSelectedKey(key);
    if (autoSelect) router.replace(urlOf(key), { scroll: false });
    const it = items.find((i) => i.key === key);
    /* ⚠️ 既読は以前と同じ（開いたら mark_read。面談の申込だけ） */
    if (autoSelect && it?.kind === "meeting" && it.unread) markMeetingRead(it.m.id);
  }, [autoSelect, router, urlOf, items, markMeetingRead]);

  /* ★広い画面で何も選んでいなければ一番上を選ぶ。⚠️ 狭い画面では選ばない（一覧を出す） */
  const firstKey = shown[0]?.key ?? null;
  useEffect(() => {
    if (!autoSelect || selectedKey || !firstKey) return;
    if (!window.matchMedia(`(min-width: ${MESSAGES_SPLIT_MIN_WIDTH}px)`).matches) return;
    select(firstKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, firstKey]);

  /* ★URL で開いた面談の申込も既読にする（以前は一覧で押したときだけだった。開いた＝読んだ） */
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || !autoSelect || !initialShow) return;
    openedRef.current = true;
    const it = items.find((i) => i.key === initialShow);
    if (it?.kind === "meeting" && it.unread) markMeetingRead(it.m.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (t: SelectionTab) => {
    setTab(t);
    setSelectedKey(null);
    if (autoSelect) router.replace(urlOf(null, t), { scroll: false });
  };
  const changeClosed = (v: boolean) => { setClosedView(v); setSelectedKey(null); if (autoSelect) router.replace(urlOf(null), { scroll: false }); };

  // ── 面談の操作（以前の MeetingsClient と同じ API・同じ流れ） ──
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [memoSaveStates, setMemoSaveStates] = useState<Record<string, MemoSaveState>>({});
  const memoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const meetingStatus = async (id: string, next: MeetingStatus) => {
    const old = meetings.find((m) => m.id === id);
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: next } : m)));
    const res = await fetch(`/api/biz/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", value: next }) });
    if (!res.ok && old) {
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: old.status } : m)));
      showError("ステータス更新に失敗しました。再度お試しください。");
    }
  };
  const assignToMe = async (id: string) => {
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, assigneeId: currentUser.owUserId, assigneeName: currentUser.name, assigneeInitial: currentUser.initial, assigneeGradient: currentUser.gradient } : m)));
    const res = await fetch(`/api/biz/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign_to_me" }) });
    if (!res.ok) {
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, assigneeId: null, assigneeName: null, assigneeInitial: null, assigneeGradient: null } : m)));
      showError("担当者の設定に失敗しました。再度お試しください。");
    }
  };
  const memoChange = (id: string, text: string) => {
    setMemoDrafts((p) => ({ ...p, [id]: text }));
    setMemoSaveStates((p) => ({ ...p, [id]: "saving" }));
    if (memoTimers.current[id]) clearTimeout(memoTimers.current[id]);
    memoTimers.current[id] = setTimeout(async () => {
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, companyMemo: text } : m)));
      setMemoSaveStates((p) => ({ ...p, [id]: "saved" }));
      try {
        await fetch(`/api/biz/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "memo", value: text }) });
      } catch (err) { console.error("[selection] memo:", err); }
      setTimeout(() => setMemoSaveStates((p) => ({ ...p, [id]: "idle" })), 2000);
    }, 1500);
  };

  // ── 応募の操作（以前の ApplicationsClient と同じ API・同じ流れ） ──
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const appStatus = async (id: string, next: ApplicationStatus) => {
    const old = applications.find((a) => a.id === id);
    if (!old || old.status === next) return;
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)));
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/biz/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: old.status } : a)));
      showError("ステータス更新に失敗しました。再度お試しください。");
    } finally { setUpdatingId(null); }
  };
  const hireConfirm = async (id: string, salary: number | null) => {
    const res = await fetch(`/api/biz/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "hired", hired_salary: salary }) });
    if (res.ok) setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: "hired" } : a)));
    else showError("更新に失敗しました。再度お試しください。");
  };

  const messageHref = (convId?: string) => (convId ? `/biz/messages?show=${convId}` : null);
  const openMessage = (convId?: string) => router.push(messageHref(convId) ?? "/biz/messages");

  const emptyList = items.length === 0;

  return (
    <div className="sel-root">
      <style>{`
        .sel-root { display: flex; flex-direction: column; gap: 12px; padding: 16px 24px 20px; min-width: 0; }
        .sel-split { display: grid; grid-template-columns: minmax(0, 1fr); background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; min-width: 0; }
        .sel-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .sel-list-scroll { overflow-y: auto; min-height: 0; }
        .sel-pane { display: none; min-width: 0; min-height: 0; flex-direction: column; }
        .sel-split[data-selected=true] .sel-list { display: none; }
        .sel-split[data-selected=true] .sel-pane { display: flex; }
        .sel-tabs { display: flex; gap: 4px; padding: 0 8px; border-bottom: 1px solid var(--line); overflow-x: auto; flex-shrink: 0; }
        .sel-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .sel-tab[aria-selected=true] { border-bottom-color: var(--royal); color: var(--royal); font-weight: 700; }
        .sel-sub { display: flex; gap: 14px; padding: 8px 14px; border-bottom: 1px solid var(--line-soft); flex-shrink: 0; }
        .sel-sub button { background: none; border: 0; padding: 2px 0; font: inherit; font-size: 13px; color: var(--ink-mute); cursor: pointer; }
        .sel-sub button[aria-pressed=true] { color: var(--ink); font-weight: 700; }
        .sel-item { display: flex; gap: 10px; align-items: flex-start; width: 100%; padding: 12px 14px 12px 11px; border: 0; border-left: 3px solid transparent; border-top: 1px solid var(--line-soft); background: #fff; text-align: left; font: inherit; color: inherit; cursor: pointer; }
        .sel-item:hover { background: var(--bg-tint, #f6f7f9); }
        .sel-item[data-selected=true] { border-left-color: var(--royal); background: var(--royal-50); }
        .sel-pane-head { flex-shrink: 0; padding: 14px 20px 12px; border-bottom: 1px solid var(--line); background: #fff; }
        .sel-pane-back { display: inline-block; margin-bottom: 6px; background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--royal); cursor: pointer; }
        .sel-pane-body { flex: 1; min-height: 0; overflow-y: auto; background: var(--bg-tint, #f6f7f9); }
        @media (min-width: 1280px) {
          .sel-root { height: calc(100vh - var(--biz-header-h)); box-sizing: border-box; }
          .sel-split { grid-template-columns: 360px minmax(0, 1fr); flex: 1; min-height: 480px; }
          .sel-list { border-right: 1px solid var(--line); }
          .sel-split[data-selected=true] .sel-list { display: flex; }
          .sel-pane { display: flex; }
          .sel-pane-back { display: none; }
        }
        @media (max-width: 767px) {
          .sel-root { padding: 12px; }
          .sel-pane-head { padding-left: 14px; padding-right: 14px; }
        }
      `}</style>

      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>選考管理</h1>
      {errorMessage && (
        <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error-ink)", fontWeight: 600 }}>{errorMessage}</div>
      )}

      {/* ★決まった面談（今日以降）。以前と同じ並び。⚠️ 行き先はメッセージ画面の会話 */}
      {scheduled && scheduled.length > 0 && (
        <div data-state="scheduled-meetings" style={{ padding: "10px 16px", border: "1px solid var(--line)", borderRadius: 12, background: "#fff", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>決まった面談（今日以降）</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {scheduled.map((m) => (
              <li key={m.id}>
                <Link href={`/biz/messages?show=${m.conversationId}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", fontSize: 13, color: "var(--ink)", textDecoration: "none", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.whenText}</span>
                  <span style={{ minWidth: 0 }}>{m.candidateName} さん</span>
                  <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{m.formatLabel}・{m.duration}分{m.origin ? `・${m.origin === "approach" ? "メッセージから" : "おすすめから"}` : ""}</span>
                  <span aria-hidden="true" style={{ marginLeft: "auto", color: "var(--ink-mute)" }}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="sel-split" data-selected={selected ? "true" : "false"} data-state="selection-split">
        <div className="sel-list">
          <div role="tablist" aria-label="種類" className="sel-tabs">
            {([["all", "すべて"], ["meetings", "カジュアル面談"], ["applications", "選考・応募"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className="sel-tab btn-fixed-size" data-tab={k} onClick={() => changeTab(k)}>
                {label}{counts[k] > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{counts[k]}</span>}
              </button>
            ))}
          </div>
          <div className="sel-sub">
            <button type="button" aria-pressed={!closedView} data-state="filter-open" onClick={() => changeClosed(false)}>対応中 {inTab.filter((i) => !i.closed).length}</button>
            <button type="button" aria-pressed={closedView} data-state="filter-closed" onClick={() => changeClosed(true)}>終了 {inTab.filter((i) => i.closed).length}</button>
          </div>
          <div className="sel-list-scroll">
            {shown.length === 0 ? (
              emptyList ? (
                tab === "applications" ? (
                  <p data-state="selection-empty" style={{ margin: 0, padding: 20, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                    {hasPublishedJobs ? "まだ応募はありません。" : "まだ応募はありません。求人を公開すると、ここに応募が届きます。"}
                  </p>
                ) : <MeetingEmptyState isSearch={false} isAllEmpty acceptance={acceptance} />
              ) : (
                <p data-state="selection-empty" style={{ margin: 0, padding: 20, fontSize: 13, color: "var(--ink-mute)" }}>
                  {closedView ? "終了したものはありません。" : "対応中のものはありません。"}
                </p>
              )
            ) : shown.map((it) => {
              const others = it.userId ? (perUser.get(it.userId) ?? 1) - 1 : 0;
              const status = it.kind === "meeting" ? meetingStatusLabel(it.m.status) : appStatusLabel(it.a.status);
              return (
                <button key={it.key} type="button" className="sel-item" data-item={it.kind} data-selected={selectedKey === it.key ? "true" : "false"} aria-current={selectedKey === it.key ? "true" : undefined} onClick={() => select(it.key)}>
                  <InitialAvatar name={it.name} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span data-state={it.unread ? "item-name-unread" : "item-name"} style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: it.unread ? 800 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      {it.at && <span style={{ flexShrink: 0, fontSize: 12, color: "var(--ink-mute)" }}>{fmtListDate(it.at, now)}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.kind === "meeting" ? `カジュアル面談・${it.jobTitle ?? "ポジション指定なし"}` : `応募・${it.jobTitle ?? "求人"}`}
                    </div>
                    <div data-state="item-status" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                      {status}{others > 0 && <span data-state="item-others">・ほかにも{others}件</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sel-pane" aria-live="polite">
          {selected ? (
            <SelectedPane key={selected.key} it={selected} now={now} fixtures={fixtures}
              onBack={() => { setSelectedKey(null); if (autoSelect) router.replace(urlOf(null), { scroll: false }); }}
              messageHref={messageHref(selected.conversationId)}>
              {selected.kind === "meeting" ? (
                <MeetingDetailPanel
                  embedded
                  meeting={selected.m}
                  memoDraft={memoDrafts[selected.m.id] ?? selected.m.companyMemo}
                  memoSaveState={memoSaveStates[selected.m.id] ?? "idle"}
                  isPrevDisabled isNextDisabled onPrev={() => {}} onNext={() => {}}
                  onStatusChange={(s) => meetingStatus(selected.m.id, s)}
                  onAssignToMe={() => assignToMe(selected.m.id)}
                  onMemoChange={(t) => memoChange(selected.m.id, t)}
                  onReply={() => openMessage(selected.conversationId)}
                  onScheduleAdjust={() => openMessage(selected.conversationId)}
                  onProfileDetail={() => { if (selected.userId) window.open(`/u/${selected.userId}`, "_blank", "noopener,noreferrer"); }}
                />
              ) : (
                <div style={{ padding: "20px 24px" }}>
                  <ApplicationDetailPanel embedded app={selected.a} isUpdating={updatingId === selected.a.id} onStatusChange={appStatus} onHireConfirm={hireConfirm} />
                </div>
              )}
            </SelectedPane>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <p data-state="selection-none" style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>{emptyList ? "まだ申込・応募はありません" : "左の一覧から選んでください"}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** 右側。上の段（固定）＋中身（今の詳細パネル）＋この会社とのこれまで */
function SelectedPane({ it, now, fixtures, onBack, messageHref, children }: {
  it: Item; now: Date; fixtures?: Record<string, { meta: string | null; history: HistoryItem[] }>;
  onBack: () => void; messageHref: string | null; children: React.ReactNode;
}) {
  const fx = it.userId ? fixtures?.[it.userId] : undefined;
  const [data, setData] = useState<{ meta: string | null; history: HistoryItem[] } | null>(fx ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (fx || !it.userId) return;
    let alive = true;
    fetch(`/api/biz/selection/${encodeURIComponent(it.userId)}`)
      .then(async (r) => { const j = await r.json().catch(() => null); if (!alive) return; if (!r.ok || !j) setFailed(true); else setData(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [it.userId, fx]);

  const kindLine = it.kind === "meeting"
    ? `カジュアル面談・${it.jobTitle ?? "ポジション指定なし"}`
    : `応募・${it.jobTitle ?? "求人"}`;
  return (
    <>
      <div className="sel-pane-head" data-state="selection-pane-head">
        <button type="button" className="sel-pane-back" onClick={onBack}>← 一覧へ</button>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{it.name}</h2>
              {it.userId && (
                <CandidateProfileDrawerButton userId={it.userId} name={it.name} label="↗" ariaLabel={`${it.name}さんのプロフィールを見る`} title="プロフィールを見る"
                  style={{ fontSize: 15, padding: "2px 6px", color: "var(--ink-mute)" }} />
              )}
            </div>
            {data?.meta && <div data-state="pane-meta" style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>{data.meta}</div>}
            <div data-state="pane-kind" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
              {kindLine}{it.at ? `・${fmtDate(it.at)}に受付` : ""}
            </div>
          </div>
          {messageHref ? (
            <Link href={messageHref} data-state="open-message" className="btn-fixed-size" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>メッセージを開く</Link>
          ) : (
            <span data-state="no-message" style={{ flexShrink: 0, fontSize: 12.5, color: "var(--ink-mute)", paddingTop: 6 }}>メッセージのやり取りはまだありません</span>
          )}
        </div>
      </div>
      <div className="sel-pane-body">
        {children}
        <section data-state="selection-history" style={{ margin: "0 24px 24px", padding: "16px 0 0", borderTop: "1px solid var(--line)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>この会社とのこれまで</h3>
          {failed ? <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>読み込めませんでした</p>
            : !data ? <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>
            : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {data.history.map((h) => (
                  <li key={h.key} data-state="history-item" data-kind={h.kind} style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.6 }}>
                    <span style={{ flexShrink: 0, width: 78, color: "var(--ink-mute)" }}>{fmtListDate(h.at, now)}</span>
                    <span style={{ minWidth: 0, color: "var(--ink)" }}>{h.title}{h.sub && <span style={{ color: "var(--ink-mute)" }}>・{h.sub}</span>}</span>
                  </li>
                ))}
              </ol>
            )}
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>同じアカウントでのやり取りだけを表示しています。</p>
        </section>
      </div>
    </>
  );
}
