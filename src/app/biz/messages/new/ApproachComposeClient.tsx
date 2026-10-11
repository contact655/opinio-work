"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApproachLetter } from "@/components/approaches/ApproachLetter";
import { RequestReplyBox } from "@/components/approaches/RequestReplyBox";
import { approachQuotaTexts } from "@/lib/constants/companyApproaches";
import {
  APPROACH_BODY_MAX, APPROACH_EXPIRE_DAYS, APPROACH_REASON_MAX, APPROACH_REASON_MIN, APPROACH_RESEND_DAYS,
} from "@/lib/constants/companyApproaches";
import type { ApproachQuota } from "@/lib/approaches/server";

/**
 * ★声かけを書く（2026-10-10 / 候補者探し 段4・キャンバス3）。左が入力、右が枠・見え方・充実度・注意。
 * ⚠️★「〇〇さんにはこう見えます」は求職者の画面と同じ部品（ApproachLetter）。入力に合わせてその場で変わる。
 * ⚠️ 送れるかの最終判断はサーバー（`sendApproach`）。ここでは字数だけ見る。
 * ⚠️ 送ったら /biz/messages の返事待ちタブに移り、上にお知らせを出す（`?tab=pending&sent=<id>`。名前は URL に入れない）。
 * ⚠️ 画面の語は「メッセージ」（2026-10-11 / 柴さんの指示）。「リクエスト」「受け入れ」「確認する」と書かない。
 * ⚠️ 本文のテンプレートは今回は作らない（柴さんの指示）。
 */
type Props = {
  candidate: { id: string; name: string; headline: string | null; currentRole: string | null; currentCompany: string | null };
  quotes: { label: string; text: string }[];
  quota: ApproachQuota | null;
  senders: { id: string; name: string; role: string | null }[];
  defaultSenderId: string;
  jobs: { id: string; title: string }[];
  company: { name: string; logoUrl: string | null; logoLetter: string | null; logoGradient: string | null; isOwnCompany: boolean };
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
  /* ★送り済みと分かったときの案内（「送った内容を見る」「メッセージを開く」。2026-10-11） */
  const [errorAction, setErrorAction] = useState<{ label: string; href: string } | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const len = reason.trim().length;
  const ok = len >= APPROACH_REASON_MIN && len <= APPROACH_REASON_MAX;
  /* ⚠️ 色は柴さんの指示（30字未満は赤、30〜200字は緑）。200字を超えたら赤 */
  const counterColor = ok ? "#15803D" : "var(--error)";
  const senderName = p.senders.find((s) => s.id === senderId)?.name ?? null;
  const senderRole = p.senders.find((s) => s.id === senderId)?.role ?? null;
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
    setSending(true); setError(null); setErrorAction(null);
    try {
      const res = await fetch("/api/biz/approaches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateUserId: p.candidate.id, reason, body: body.trim() || null, jobId: jobId || null, senderUserId: senderId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setError(j?.error ?? "送信に失敗しました。もう一度お試しください。"); setErrorAction(j?.action ?? null); return; }
      router.push(`/biz/messages?tab=pending&sent=${encodeURIComponent(j.id)}`);
    } catch {
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 };

  return (
    <div className="ac-wrap">
      <div style={{ marginBottom: 14 }}>
        <Link href="/biz/candidates" style={{ fontSize: 12.5, color: "var(--ink-soft)", textDecoration: "none" }}>← 候補者を探す</Link>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "6px 0 2px" }}>{p.candidate.name} さんにメッセージを送る</h1>
        {(p.candidate.currentRole || p.candidate.currentCompany) && (
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{[p.candidate.currentRole, p.candidate.currentCompany].filter(Boolean).join(" · ")}</div>
        )}
        {/* ★見出しの下の1文（2026-10-11 / モックに合わせた）。⚠️ 今月の残りは右の①に出すので、ここには出さない（同じ数字を2回出さない） */}
        <p data-state="compose-lead" style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.7, color: "var(--ink-soft)" }}>
          貴社として届きます。{p.candidate.name}さんが返信すると、そのままメッセージでやり取りが始まります。
        </p>
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
                送る理由<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 4 }}>（最初に表示されます）</span><span style={{ color: "var(--error)", marginLeft: 4 }}>必須</span>
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
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>この文が最初に{p.candidate.name}さんに表示されます。</div>
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
            <div data-state="compose-body-note" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>理由と本文は、そのまま最初のメッセージとして会話に入ります。</div>
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
          {error && errorAction && (
            <Link href={errorAction.href} data-state="approach-resend-action" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>{errorAction.label} →</Link>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void send()} disabled={!ok || sending} data-state="send-approach"
              style={{ padding: "10px 22px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                background: ok ? "var(--royal)" : "var(--line)", color: ok ? "#fff" : "var(--ink-mute)", cursor: ok && !sending ? "pointer" : "default" }}>
              {sending ? "送信中…" : "送る"}
            </button>
            <Link href="/biz/candidates" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none" }}>やめる</Link>
          </div>
        </div>

        {/* ── 右: 枠・見え方・充実度・注意 ── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* ① 今月の残りと返事待ち（2026-10-11 / モックに合わせた）。言い方は /biz/messages と同じ */}
          <div style={card} data-state="approach-quota">
            {p.quota ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>今月あと{approachQuotaTexts(p.quota, new Date()).remaining}通送れます</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>{approachQuotaTexts(p.quota, new Date()).remainingSub}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-soft)", marginTop: 12 }}>
                  <span>返事待ち</span><span data-state="compose-open-count">{p.quota.openCount}件／{p.quota.openLimit}件</span>
                </div>
                <div aria-hidden style={{ height: 6, borderRadius: 999, background: "var(--line-soft, #eef0f3)", marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, Math.round((p.quota.openCount / Math.max(1, p.quota.openLimit)) * 100))}%`, height: "100%", background: "var(--royal)" }} />
                </div>
              </>
            ) : <div style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>送れる数を確認できませんでした</div>}
          </div>

          {/* ② 見え方。⚠️ 求職者の画面と同じ部品（手紙＋返信欄）。返信欄は見本で押せない */}
          <div style={card} data-state="approach-preview">
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>{p.candidate.name}さんにはこう見えます</div>
            <ApproachLetter companyName={p.company.name} companyHref={null} logoUrl={p.company.logoUrl} logoLetter={p.company.logoLetter}
              logoGradient={p.company.logoGradient} senderName={senderName} senderRole={senderRole} dateText="今日" reason={reason} body={body}
              job={job ? { title: job.title, href: `/jobs/${job.id}` } : null}
              placeholder={{ reason: "（ここに、送る理由が入ります）" }} isOwnCompany={p.company.isOwnCompany} />
            <RequestReplyBox sample declineNote="見送っても企業には伝わりません。" />
          </div>

          {/* ③ 送る前に（2026-10-11 / モックの3項目） */}
          <div style={card} data-state="approach-notes">
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>送る前に</div>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8 }}>
              <li>返信があると、メールでお知らせします。</li>
              <li>返事がない場合、その理由は表示されません。{APPROACH_EXPIRE_DAYS}日たつと「返信はありませんでした」になり、返事待ちの枠に戻ります。</li>
              <li>同じ方には、{APPROACH_RESEND_DAYS}日間もう一度送れません。</li>
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
