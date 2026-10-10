"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApproachLetter } from "@/components/approaches/ApproachLetter";
import { approachQuotaTexts } from "@/lib/constants/companyApproaches";
import {
  APPROACH_BODY_MAX, APPROACH_EXPIRE_DAYS, APPROACH_REASON_MAX, APPROACH_REASON_MIN, APPROACH_RESEND_DAYS,
} from "@/lib/constants/companyApproaches";
import type { ApproachQuota } from "@/lib/approaches/server";

/**
 * ★声かけを書く（2026-10-10 / 候補者探し 段4・キャンバス3）。左が入力、右が枠・見え方・充実度・注意。
 * ⚠️★「〇〇さんにはこう見えます」は求職者の画面と同じ部品（ApproachLetter）。入力に合わせてその場で変わる。
 * ⚠️ 送れるかの最終判断はサーバー（`sendApproach`）。ここでは字数だけ見る。
 * ⚠️ 送ったら /biz/approaches に移り、上にお知らせを出す（`?sent=<声かけの id>`。名前は URL に入れない）。
 * ⚠️ 本文のテンプレートは今回は作らない（柴さんの指示）。
 */
type Props = {
  candidate: { id: string; name: string; headline: string | null; currentRole: string | null; currentCompany: string | null };
  quotes: { label: string; text: string }[];
  quota: ApproachQuota | null;
  senders: { id: string; name: string }[];
  defaultSenderId: string;
  jobs: { id: string; title: string }[];
  company: { name: string; logoUrl: string | null; logoLetter: string | null; logoGradient: string | null; isOwnCompany: boolean };
  disclosure: { biz: number; max: number; missing: { label: string; href: string }[] } | null;
};

export default function ApproachComposeClient(p: Props) {
  const router = useRouter();
  const [senderId, setSenderId] = useState(p.senders.some((s) => s.id === p.defaultSenderId) ? p.defaultSenderId : (p.senders[0]?.id ?? p.defaultSenderId));
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const len = reason.trim().length;
  const ok = len >= APPROACH_REASON_MIN && len <= APPROACH_REASON_MAX;
  /* ⚠️ 色は柴さんの指示（30字未満は赤、30〜200字は緑）。200字を超えたら赤 */
  const counterColor = ok ? "#15803D" : "var(--error)";
  const senderName = p.senders.find((s) => s.id === senderId)?.name ?? null;
  const job = p.jobs.find((j) => j.id === jobId) ?? null;

  /** 引用を理由の欄に差し込む（カーソルの位置。無ければ末尾）。⚠️ 200字を超えても止めない（字数の色で知らせる） */
  const insertQuote = (text: string) => {
    const el = reasonRef.current;
    const start = el?.selectionStart ?? reason.length;
    const end = el?.selectionEnd ?? reason.length;
    const next = reason.slice(0, start) + text + reason.slice(end);
    setReason(next);
    setQuoteOpen(false);
    setTimeout(() => { el?.focus(); const pos = start + text.length; el?.setSelectionRange(pos, pos); }, 0);
  };

  const send = async () => {
    if (!ok || sending) return;
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/biz/approaches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateUserId: p.candidate.id, reason, body: body.trim() || null, jobId: jobId || null, senderUserId: senderId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setError(j?.error ?? "送信に失敗しました。もう一度お試しください。"); return; }
      router.push(`/biz/approaches?sent=${encodeURIComponent(j.id)}`);
    } catch {
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 };
  const remaining = p.quota ? Math.max(0, p.quota.monthlyLimit - p.quota.monthlyUsed - 1) : null;

  return (
    <div className="ac-wrap">
      <div style={{ marginBottom: 14 }}>
        <Link href="/biz/candidates" style={{ fontSize: 12.5, color: "var(--ink-soft)", textDecoration: "none" }}>← 候補者を探す</Link>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "6px 0 2px" }}>{p.candidate.name} さんに声をかける</h1>
        {(p.candidate.currentRole || p.candidate.currentCompany) && (
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{[p.candidate.currentRole, p.candidate.currentCompany].filter(Boolean).join(" · ")}</div>
        )}
      </div>

      <div className="ac-grid">
        {/* ── 左: 入力 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={card}>
            <label htmlFor="ac-sender" style={label}>送る担当者</label>
            {/* ⚠️ 選べるのは自社の有効な担当者だけ（サーバーも同じ関数で確かめる） */}
            <select id="ac-sender" value={senderId} onChange={(e) => setSenderId(e.target.value)}
              style={{ width: "100%", maxWidth: 320, height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
              {p.senders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <label htmlFor="ac-reason" style={{ ...label, marginBottom: 0 }}>
                この方に声をかけたい理由<span style={{ color: "var(--error)", marginLeft: 4 }}>必須</span>
              </label>
              {p.quotes.length > 0 && (
                <div style={{ position: "relative", marginLeft: "auto" }}>
                  <button type="button" onClick={() => setQuoteOpen((v) => !v)} aria-expanded={quoteOpen} data-state="quote-button"
                    style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "5px 12px", borderRadius: 999, border: "1px solid var(--royal-100)", background: "var(--royal-50)", color: "var(--royal)", cursor: "pointer" }}>
                    プロフィールから引用
                  </button>
                  {quoteOpen && (
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, width: 300, maxWidth: "calc(100vw - 48px)", maxHeight: 280, overflowY: "auto", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,35,102,0.12)", padding: 6 }}>
                      {p.quotes.map((q) => (
                        <button key={q.label} type="button" onClick={() => insertQuote(q.text)} data-quote={q.label}
                          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", color: "var(--ink)", cursor: "pointer", overflowWrap: "anywhere" }}>
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <textarea id="ac-reason" ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} rows={5}
              placeholder="経歴のどこに惹かれたのか、具体的に書いてください"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }} />
            <div data-state={ok ? "reason-ok" : "reason-ng"} style={{ fontSize: 12, fontWeight: 700, color: counterColor, marginTop: 4 }}>
              {len} / {APPROACH_REASON_MAX}（{APPROACH_REASON_MIN}文字以上）
            </div>
          </div>

          <div style={card}>
            <label htmlFor="ac-body" style={label}>メッセージ<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>任意</span></label>
            <textarea id="ac-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={APPROACH_BODY_MAX}
              placeholder="自己紹介や、話したいことを書いてください"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>{body.length} / {APPROACH_BODY_MAX}</div>
          </div>

          {p.jobs.length > 0 && (
            <div style={card}>
              <label htmlFor="ac-job" style={label}>関連する求人<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>任意</span></label>
              <select id="ac-job" value={jobId} onChange={(e) => setJobId(e.target.value)}
                style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                <option value="">添えない</option>
                {p.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}

          {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--error)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void send()} disabled={!ok || sending} data-state="send-approach"
              style={{ padding: "10px 22px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                background: ok ? "var(--royal)" : "var(--line)", color: ok ? "#fff" : "var(--ink-mute)", cursor: ok && !sending ? "pointer" : "default" }}>
              {sending ? "送信中…" : "声をかける"}
            </button>
            <Link href="/biz/candidates" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none" }}>やめる</Link>
          </div>
        </div>

        {/* ── 右: 枠・見え方・充実度・注意 ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={card} data-state="approach-quota">
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>今月の枠</div>
            {p.quota ? (
              /* ★言い方は /biz/approaches・ホームと同じ（`approachQuotaTexts`）。2026-10-11 */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, fontSize: 12, color: "var(--ink-soft)" }}>
                <div>今月の残り<div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{approachQuotaTexts(p.quota, new Date()).remaining}通</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{approachQuotaTexts(p.quota, new Date()).remainingSub}</div></div>
                <div>返事待ち<div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{p.quota.openCount}件</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{approachQuotaTexts(p.quota, new Date()).openSub}</div></div>
                <div style={{ gridColumn: "1 / -1" }}>送ったあとの今月の残り：<strong style={{ color: "var(--ink)" }}>{remaining}通</strong></div>
              </div>
            ) : <div style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>枠を確認できませんでした（—）</div>}
          </div>

          <div style={card} data-state="approach-preview">
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>{p.candidate.name} さんにはこう見えます</div>
            <ApproachLetter companyName={p.company.name} companyHref={null} logoUrl={p.company.logoUrl} logoLetter={p.company.logoLetter}
              logoGradient={p.company.logoGradient} senderName={senderName} dateText="今日" reason={reason} body={body}
              job={job ? { title: job.title, href: `/jobs/${job.id}` } : null}
              placeholder={{ reason: "（ここに、声をかけた理由が入ります）" }} isOwnCompany={p.company.isOwnCompany} />
          </div>

          {p.disclosure && (
            <div style={card} data-state="approach-disclosure">
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>企業ページの充実度</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                企業入力 {p.disclosure.biz} / {p.disclosure.max}。声をかけられた方は、まず企業ページを見ます。
              </div>
              {p.disclosure.missing.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>自分で入力できる項目はすべて入っています</div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                  まだ入れていない項目：
                  {p.disclosure.missing.map((m, i) => (
                    <span key={m.label}>{i > 0 && "・"}<Link href={m.href} style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>{m.label}</Link></span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={card} data-state="approach-notes">
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>送る前に</div>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8 }}>
              <li>受け入れられると、メールでお知らせします。</li>
              <li>見送られても、お知らせはしません。</li>
              <li>返事がないまま{APPROACH_EXPIRE_DAYS}日たつと、返事待ちの枠に戻ります。</li>
              <li>同じ方へは、送ってから{APPROACH_RESEND_DAYS}日間は再び声をかけられません。</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* ⚠️ style タグの中に山かっこや引用符を書かないこと */}
      <style>{`
        .ac-wrap { padding: 16px clamp(16px, 3vw, 32px); max-width: 1200px; margin: 0 auto; }
        .ac-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 1024px) { .ac-grid { grid-template-columns: minmax(0, 1fr) 380px; } }
      `}</style>
    </div>
  );
}
