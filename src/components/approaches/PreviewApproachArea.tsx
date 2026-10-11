"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApproachBubble } from "@/components/approaches/ApproachBubble";
import type { Candidate } from "@/lib/business/candidates/model";
import {
  APPROACH_BODY_MAX, APPROACH_REASON_MAX, APPROACH_REASON_MIN, APPROACH_NOT_LOOKING_MESSAGE, APPROACH_TEST_COMPANY_MESSAGE,
  APPROACH_UNAVAILABLE_MESSAGE, approachResendNotice, type CompanyApproachStatus,
} from "@/lib/constants/companyApproaches";

/**
 * ★候補者検索の右のプレビューから、その場でメッセージを送る（2026-10-11 / 柴さんの指示）。
 *
 * - 送れる人: 主ボタン「メッセージを送る」。押すとプレビューの中に送信フォームが開く（画面は移らない）。
 *   送る先・文面の決まりは /biz/messages/new と同じ（`POST /api/biz/approaches`。理由は30〜200字必須）。
 *   送ったらボタンの位置に灰色の「メッセージを送りました」（バッジにしない）。
 * - 送れない人: ボタンの代わりに灰色の1行で理由だけ。
 *   送り済み → 「〇月〇日に送っています」／検証用の会社 → APPROACH_TEST_COMPANY_MESSAGE ／
 *   今は考えていない → APPROACH_NOT_LOOKING_MESSAGE ／ 企業側の上限 → `limitLine` ／ それ以外 → APPROACH_UNAVAILABLE_MESSAGE
 * ⚠️ 送れるかの最終判断はサーバー（`sendApproach`）。ここは字数だけ見る。
 * ★送ってある場合は、最初から送った内容を吹き出しで出す（2026-10-11 / 柴さんの指示。開閉はやめた）。
 *   /biz/messages のカードと同じ部品（`ApproachBubble`）。返信があれば冒頭と「メッセージを開く」（これだけは画面を移る）。
 * ⚠️ `profileLink` は任意（2026-10-11 に「プロフィール全体を見る」ボタンをやめ、名前の横の新しいタブのアイコンにした）。
 */
export function PreviewApproachArea({ candidate, jobs, limitLine, profileLink }: {
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

  const gray = (text: string, state: string, extra?: React.ReactNode) => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
      <span data-state={state} style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>{text}</span>
      {extra}
      {profileLink}
    </div>
  );

  /* ⚠️ 声かけが使えないプラン・判定が取れなかったとき（approach が undefined）は、プロフィールへの入口だけ */
  if (!a) return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{profileLink}</div>;
  if (sentNow) return gray("メッセージを送りました", "approach-sent-now");
  if (a.sent) return <SentBubble sent={a.sent} />;
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
    <div style={{ marginTop: 14 }}>
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
        <div data-state="approach-inline-form" style={{ marginTop: 12, padding: "14px 14px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-tint)" }}>
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

/** ★送ってある場合の吹き出し。中身は /biz/messages と同じ取得（`GET /api/biz/approaches/[id]`）から */
function SentBubble({ sent }: { sent: NonNullable<NonNullable<Candidate["approach"]>["sent"]> }) {
  type Detail = { createdAt: string; senderName: string | null; jobTitle: string | null; reason: string; body: string | null;
    status: CompanyApproachStatus; conversationId: string | null; replyExcerpt: string | null };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setDetail(null); setFailed(false);
    fetch(`/api/biz/approaches/${encodeURIComponent(sent.id)}`)
      .then(async (res) => { const j = await res.json().catch(() => null); if (!alive) return; if (!res.ok || !j) setFailed(true); else setDetail(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [sent.id]);
  const wrap: React.CSSProperties = { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" };
  if (failed) return <p data-state="approach-detail-error" style={{ ...wrap, margin: "12px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>送った内容を読み込めませんでした</p>;
  if (!detail) return <p data-state="approach-detail-loading" style={{ ...wrap, margin: "12px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>;
  const action = approachResendNotice(sent).action;
  return (
    <ApproachBubble senderName={detail.senderName} sentAt={detail.createdAt} jobTitle={detail.jobTitle} reason={detail.reason} body={detail.body}
      status={detail.status}
      reply={detail.status === "accepted" ? { excerpt: detail.replyExcerpt, href: action?.href ?? (detail.conversationId ? `/biz/messages/${detail.conversationId}` : "/biz/messages") } : null}
      style={wrap} />
  );
}
