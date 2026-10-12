"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApproachBubble } from "@/components/approaches/ApproachBubble";
import { PaneThread, type PaneThreadPage } from "@/components/approaches/PaneThread";
import { ReplyForm } from "@/app/biz/messages/[id]/ReplyForm";
import type { Candidate } from "@/lib/business/candidates/model";
import {
  APPROACH_BODY_MAX, APPROACH_REASON_MAX, APPROACH_REASON_MIN, APPROACH_NOT_LOOKING_MESSAGE, APPROACH_TEST_COMPANY_MESSAGE,
  APPROACH_UNAVAILABLE_MESSAGE, approachDaysLeft, approachResendNotice, type CompanyApproachStatus,
} from "@/lib/constants/companyApproaches";

/**
 * ★候補者を探すの右欄の、下に固定するメッセージ欄（2026-10-12 / 柴さんの指示で「下の段」にした）。
 *
 * 閉じた状態（1〜2行）:
 *   未送信 …「メッセージを送る」（押すと送信フォームがこの欄の上に広がる）
 *   返信待ち …「返信を待っています（あと〇日）」 ／ 30日返信なし …「返信はありませんでした」
 *   送れない … 灰色の1行の理由（送り済み・検証用の会社・今は考えていない・上限・その他）
 * ★返信あり（やり取りがある人）は最初から開いた状態（2026-10-12 / 柴さんの指示。右欄の高さの最大50%・中身が少なければその分だけ）:
 *   最新10通の吹き出し（`PaneThread`。上へスクロールで前の10通）・右上に「広げる／元に戻す」・小さく「メッセージ画面で開く ›」・
 *   いちばん下に返信欄（`ReplyForm`）。参加者でない人は「メッセージ画面で参加する」
 *   ⚠️「これまでのやり取り（n件）を見る」は外した
 * 返信待ち・30日 … 閉じた1行。「開く」で送った内容（`ApproachBubble`）
 * ⚠️ やり取りは欄に出したときに読む（既読もそのときに付く）。
 * ⚠️ 送れるかの最終判断はサーバー（`sendApproach`）。ここは字数だけ見る。⚠️ 状態をバッジにしない（灰色の文字）。
 */
const GRAY: React.CSSProperties = { fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 };
const DOCK: React.CSSProperties = { padding: "12px 20px", minHeight: 0, display: "flex", flexDirection: "column" };
const TOGGLE: React.CSSProperties = { flexShrink: 0, background: "none", border: "none", padding: "4px 0", fontSize: 13, fontWeight: 700, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };

export function PreviewApproachArea({ candidate, jobs, limitLine, profileLink, expanded = false, onExpandChange }: {
  /** ★やり取りの欄を右欄いっぱいに広げているか（状態は CandidatePreview が持つ。CandidateProfilePanel の footerExpanded と対） */
  expanded?: boolean;
  onExpandChange?: (v: boolean) => void;
  candidate: Candidate;
  jobs: { id: string; title: string }[];
  /** 企業側の上限に当たっているときの1行（`approachCompanyLimitLine`）。当たっていなければ null */
  limitLine: string | null;
  profileLink?: React.ReactNode;
}) {
  const a = candidate.approach;
  const [open, setOpen] = useState(false);
  const [sentNow, setSentNow] = useState(false);
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{ label: string; href: string } | null>(null);

  const gray = (text: string, state: string) => (
    <div style={{ ...DOCK, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span data-state={state} style={GRAY}>{text}</span>
      {profileLink}
    </div>
  );

  /* ⚠️ メッセージが使えないプラン・判定が取れなかったとき（approach が undefined）は欄を出さない */
  if (!a) return profileLink ? <div style={DOCK}>{profileLink}</div> : null;
  if (sentNow) return gray("メッセージを送りました", "approach-sent-now");
  /* ⚠️ key で候補者ごとに作り直す（別の人の内容が一瞬残らないように。開閉もここで戻る） */
  if (a.sent) return <SentDock key={a.sent.id} sent={a.sent} expanded={expanded} onExpandChange={onExpandChange} />;
  if (!a.eligible) {
    const text = a.blocked === "test_company" ? APPROACH_TEST_COMPANY_MESSAGE
      : a.blocked === "not_looking" ? APPROACH_NOT_LOOKING_MESSAGE
      : APPROACH_UNAVAILABLE_MESSAGE;
    return gray(text, `approach-blocked-${a.blocked ?? "other"}`);
  }
  if (limitLine) return gray(limitLine, "approach-company-limit");

  const len = reason.trim().length;
  const ok = len >= APPROACH_REASON_MIN && len <= APPROACH_REASON_MAX;

  const send = async () => {
    if (!ok || sending) return;
    setSending(true); setError(null); setErrorAction(null);
    try {
      const res = await fetch("/api/biz/approaches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateUserId: candidate.id, reason, body: body.trim() || null, jobId: jobId || null }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setError(j?.error ?? "送信に失敗しました。もう一度お試しください。"); setErrorAction(j?.action ?? null); return; }
      setSentNow(true); setOpen(false);
    } catch {
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 };
  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, lineHeight: 1.7, fontFamily: "inherit", background: "#fff" };

  return (
    <div data-state={open ? "dock-open" : "dock-closed"} style={{ ...DOCK, overflowY: open ? "auto" : undefined }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} data-state="approach-button" className="tap-min-h"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
            メッセージを送る
          </button>
        )}
        {profileLink}
      </div>
      {open && (
        <div data-state="approach-inline-form" style={{ marginTop: 0, padding: "14px 14px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-tint)" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            貴社として届きます。{candidate.name}さんが返信すると、そのままメッセージでやり取りが始まります。
          </p>
          <label htmlFor="pv-reason" style={label}>
            送る理由<span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>（最初に表示されます）</span><span style={{ color: "var(--error)", marginLeft: 4 }}>必須</span>
          </label>
          <textarea id="pv-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} autoFocus
            placeholder="経歴のどこに惹かれたのか、具体的に書いてください" style={{ ...field, resize: "vertical" }} />
          {/* ⚠️ 色は送る画面と同じ（30字未満・200字超は赤、30〜200字は緑） */}
          <div data-state={ok ? "reason-ok" : "reason-ng"} style={{ fontSize: 12, fontWeight: 700, color: ok ? "#15803D" : "var(--error)", marginTop: 4 }}>
            {len} / {APPROACH_REASON_MAX}（{APPROACH_REASON_MIN}文字以上）
          </div>
          <label htmlFor="pv-body" style={{ ...label, marginTop: 12 }}>メッセージ<span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>任意</span></label>
          <textarea id="pv-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={APPROACH_BODY_MAX}
            placeholder="自己紹介や、話したいことを書いてください" style={{ ...field, resize: "vertical" }} />
          {jobs.length > 0 && (
            <>
              <label htmlFor="pv-job" style={{ ...label, marginTop: 12 }}>関連する求人<span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>任意</span></label>
              <select id="pv-job" value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ ...field, height: 36, padding: "0 10px" }}>
                <option value="">選ばない</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </>
          )}
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>理由と本文は、そのまま最初のメッセージとして会話に入ります。</div>
          {error && (
            <p role="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--error)" }}>
              {error}{errorAction && <> <Link href={errorAction.href} style={{ color: "var(--royal)", fontWeight: 700 }}>{errorAction.label} →</Link></>}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void send()} disabled={!ok || sending} data-state="approach-send" className="btn-fixed-size"
              style={{ height: 36, padding: "0 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: !ok || sending ? "default" : "pointer", opacity: !ok || sending ? 0.6 : 1 }}>
              {sending ? "送信中…" : "送る"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={sending} className="btn-fixed-size"
              style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ★送ってある場合。中身は /biz/messages と同じ取得（`GET /api/biz/approaches/[id]`）から。
 *   返信あり … 最初から開いた状態でやり取りを出す（`PaneThread`。最新10通・上へスクロールで前の10通）。
 *              欄の右上に「広げる／元に戻す」、いちばん下に返信欄（参加者でなければ「メッセージ画面で参加する」）。
 *   返信待ち・30日返信なし … 閉じた1行。「開く」で送った内容（`ApproachBubble`）
 * ⚠️ 既読は、やり取りを取りに行ったとき（＝欄に出したとき）に付く（`?thread=1`）。
 *    ホームの「返信していません」は最後に送ったのが候補者かで判定しているので、既読では消えない（actionItems.ts）。
 */
function SentDock({ sent, expanded = false, onExpandChange }: {
  sent: NonNullable<NonNullable<Candidate["approach"]>["sent"]>;
  expanded?: boolean;
  onExpandChange?: (v: boolean) => void;
}) {
  type Detail = { createdAt: string; senderName: string | null; jobTitle: string | null; reason: string; body: string | null;
    status: CompanyApproachStatus; conversationId: string | null };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`/api/biz/approaches/${encodeURIComponent(sent.id)}`)
      .then(async (res) => { const j = await res.json().catch(() => null); if (!alive) return; if (!res.ok || !j) setFailed(true); else setDetail(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [sent.id]);
  const accepted = detail?.status === "accepted";
  /* ★返信ありは最初からやり取りを取る（ここで既読が付く）。返信したあとは reloadKey で最新を取り直す */
  const [thread, setThread] = useState<PaneThreadPage | null>(null);
  const [threadFailed, setThreadFailed] = useState(false);
  useEffect(() => {
    if (!accepted) return;
    let alive = true;
    setThreadFailed(false);
    fetch(`/api/biz/approaches/${encodeURIComponent(sent.id)}?thread=1`)
      .then(async (res) => { const j = await res.json().catch(() => null); if (!alive) return; if (!res.ok || !j?.thread) setThreadFailed(true); else setThread(j.thread); })
      .catch(() => { if (alive) setThreadFailed(true); });
    return () => { alive = false; };
  }, [accepted, sent.id, reloadKey]);
  const loadOlder = useCallback(async (before: string) => {
    const res = await fetch(`/api/biz/approaches/${encodeURIComponent(sent.id)}?thread=1&before=${encodeURIComponent(before)}`);
    const j = await res.json().catch(() => null);
    return res.ok && j?.thread ? (j.thread as PaneThreadPage) : null;
  }, [sent.id]);

  if (failed) return <div style={DOCK}><span data-state="approach-detail-error" style={GRAY}>送った内容を読み込めませんでした</span></div>;
  if (!detail) return <div style={DOCK}><span data-state="approach-detail-loading" style={GRAY}>読み込み中…</span></div>;
  const action = approachResendNotice(sent).action;
  const threadHref = detail.conversationId ? `/biz/messages?show=${detail.conversationId}` : action?.href ?? "/biz/messages";

  /* ── 返信あり：最初から開いた状態 ── */
  if (accepted) {
    return (
      <div data-state={expanded ? "dock-expanded" : "dock-thread"} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: expanded ? 1 : "0 1 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px 4px", flexShrink: 0 }}>
          <Link href={threadHref} data-state="pane-open-messages" style={{ fontSize: 12.5, color: "var(--ink-mute)", textDecoration: "none" }}>
            メッセージ画面で開く ›
          </Link>
          <button type="button" onClick={() => onExpandChange?.(!expanded)} aria-expanded={expanded} data-state="dock-expand"
            style={{ ...TOGGLE, marginLeft: "auto" }}>{expanded ? "元に戻す" : "広げる"}</button>
        </div>
        {threadFailed ? (
          <div style={{ padding: "4px 20px 12px" }}><span style={GRAY}>やり取りを読み込めませんでした</span></div>
        ) : !thread ? (
          <div style={{ padding: "4px 20px 12px" }}><span style={GRAY}>読み込み中…</span></div>
        ) : (
          <PaneThread initial={thread} loadOlder={loadOlder}
            footer={thread.isParticipant ? (
              <ReplyForm conversationId={thread.conv.id} placeholder="返信を書く" compact onSent={() => setReloadKey((k) => k + 1)} />
            ) : (
              <div style={{ padding: "8px 20px 12px", borderTop: "1px solid var(--line)" }}>
                <Link href={threadHref} data-state="pane-thread-join" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
                  メッセージ画面で参加する →
                </Link>
              </div>
            )} />
        )}
      </div>
    );
  }

  /* ── 返信待ち・30日返信なし：閉じた1行（「開く」で送った内容） ── */
  return (
    <div data-state={open ? "dock-open" : "dock-closed"} style={{ ...DOCK, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 20px", flexShrink: 0 }}>
        <div data-state="dock-status" style={{ ...GRAY, minWidth: 0, flex: 1 }}>
          {detail.status === "pending" ? `返信を待っています（あと${approachDaysLeft(detail.createdAt)}日）` : "返信はありませんでした"}
        </div>
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} data-state="dock-toggle" style={TOGGLE}>{open ? "閉じる" : "開く"}</button>
      </div>
      {open && (
        <div data-state="dock-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 12px" }}>
          <ApproachBubble senderName={detail.senderName} sentAt={detail.createdAt} jobTitle={detail.jobTitle} reason={detail.reason} body={detail.body}
            status={detail.status} reply={null} />
        </div>
      )}
    </div>
  );
}
