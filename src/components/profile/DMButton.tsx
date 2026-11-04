"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadMessageAvailability, type MessageAvailability } from "@/lib/conversations/messageAvailabilityClient";
import {
  ConsultAboutChips,
  ConsultDetailFields,
  ConsultPurposeNote,
  consultDraftBody,
  emptyConsultDraft,
  isConsultDraftReady,
  type ConsultDraft,
} from "@/components/messages/Consult";
import type { ConsultAboutOption } from "@/lib/constants/careerConsult";

type Props = {
  targetUserId: string;
  targetName: string;
  targetAvatarUrl?: string | null;
  /**
   * ボタンの文言。既定は「〇〇 にDMを送る」。
   * ⚠️ `/u/[id]` のヘッダーは `label="メッセージ"` を渡す（2026-08-23）。
   */
  label?: string;
  /**
   * button   … 既定（薄い青）
   * primary  … ★塗りの主ボタン「メッセージ」（2026-11-05 / /people のカード・行）
   * iconPrimary … ★塗りの丸いアイコンだけ（/people のスマホの行）
   * link     … ★文字だけ（職歴の「この経験について聞く」。2026-11-05）
   * menuItem … 「…」メニューの中（企業の担当者が /u/[id] を見たとき。「個人としてメッセージを送る」）
   * card / icon / action … 白い枠のボタン・白い丸・フィードの操作行
   */
  variant?: "button" | "primary" | "iconPrimary" | "link" | "menuItem" | "card" | "icon" | "action";
  /** ★企業ページの社員の行から送るとき、その会社の id（2026-10-18）。相談の「聞きたい話」でその会社を選んだ状態にする */
  aboutCompanyId?: string | null;
  /** ★「この経験について聞く」から開くとき、その職歴の id（2026-11-05）。相談の「聞きたい話」でその会社を選んだ状態にする */
  aboutExperienceId?: string | null;
};

const ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

type Compose = {
  connected: boolean;
  options: ConsultAboutOption[];
  selectedAbout: string | null;
  maxLength: number;
};

/**
 * ★メッセージの入口（2026-10-09 に「メッセージのお願い」へ作り替え、2026-11-05 に相談メニューを足した）。
 *
 * 押すと `GET /api/dm/start` で相手とのあいだの段を聞き、
 *   - 既にある会話 … その会話を開く（「この経験について聞く」から来たら、相談の画面をその会社で開く）
 *   - 職歴が無い   … ★送る前に職歴の登録を案内する（登録後は元の画面に戻れる）
 *   - これから送る … この画面の上で書いて送る（`POST /api/dm/start`）。文章だけでも、相談でも送れる
 *   - 送れない     … ボタンの横に文言を出す
 *
 * ⚠️★止まったときに会話一覧へ移らないこと。空の会話を作らないこと（本文か相談が無ければ送らない）。
 * ⚠️ 2026-11-03〜11-05 は、相手の「話を聞ける」設定でボタンを出し分け、文言も「話を聞く」にしていた。外した（柴さんの指示）。
 */
export function DMButton({ targetUserId, targetName, label: labelProp, variant = "button", aboutCompanyId = null, aboutExperienceId = null }: Props) {
  const [avail, setAvail] = useState<MessageAvailability | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMessageAvailability(targetUserId).then((a) => { if (alive) setAvail(a); });
    return () => { alive = false; };
  }, [targetUserId]);
  const label = labelProp;
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; requestsLink?: boolean } | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [needExperience, setNeedExperience] = useState<string | null>(null);
  const router = useRouter();

  const here = () => (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);
  const toAuth = () => router.push(`/auth?next=${encodeURIComponent(here())}`);

  async function handleClick(e?: React.MouseEvent) {
    e?.stopPropagation();
    setLoading(true);
    setNotice(null);
    try {
      const q = new URLSearchParams({ targetUserId });
      if (aboutExperienceId) q.set("aboutExperienceId", aboutExperienceId);
      const res = await fetch(`/api/dm/start?${q.toString()}`);
      if (res.status === 401) { toAuth(); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setNotice({ text: data?.error ?? "現在メッセージを送れません" });
        return;
      }
      if (data.action === "open" && data.conversationId) {
        /* ★「この経験について聞く」から来たら、会話を開いて相談の画面をその職歴で開く */
        router.push(`/mypage/conversations?open=${data.conversationId}${aboutExperienceId ? `&consult=${encodeURIComponent(aboutExperienceId)}` : ""}`);
        return;
      }
      if (data.action === "need_experience") {
        setNeedExperience(typeof data.message === "string" ? data.message : "メッセージを送る前に、職歴を1件登録してください");
        return;
      }
      if (data.action === "compose") {
        const options = Array.isArray(data.consultOptions) ? (data.consultOptions as ConsultAboutOption[]) : [];
        /* ⚠️ 選択肢が取れなければ書かせない（相談を選べないまま送る画面になる）。「キャリア全般」は必ずある */
        if (options.length === 0) { setNotice({ text: "現在メッセージを送れません" }); return; }
        const fromCompany = aboutCompanyId ? options.find((o) => o.companyId === aboutCompanyId)?.key ?? null : null;
        setCompose({
          connected: data.connected === true,
          options,
          selectedAbout: (data.selectedAbout as string | null) ?? fromCompany,
          maxLength: typeof data.maxLength === "number" ? data.maxLength : 500,
        });
        return;
      }
      setNotice({ text: data.message ?? "現在メッセージを送れません", requestsLink: data.action === "incoming" });
    } catch {
      setNotice({ text: "エラーが発生しました。もう一度お試しください" });
    } finally {
      setLoading(false);
    }
  }

  /** 送る。エラーの文言を返す（成功したら会話へ移る） */
  async function post(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, ...payload }),
      });
      if (res.status === 401) { toAuth(); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.conversationId) return data?.error ?? "送信に失敗しました。もう一度お試しください";
      router.push(`/mypage/conversations?open=${data.conversationId}`);
      return null;
    } catch {
      return "送信に失敗しました。もう一度お試しください";
    }
  }

  const floatingNotice = variant === "card" || variant === "icon" || variant === "action" || variant === "primary" || variant === "iconPrimary";
  useEffect(() => {
    if (!notice || !floatingNotice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, floatingNotice]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* ★確かめ終わるまで・送れない相手には出さない（押しても送れないボタンを出さない） */
  if (!avail || !avail.show) return null;
  const text = loading ? "準備中..." : (label ?? "メッセージ");

  return (
    <>
      {variant === "action" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-post-author" title={`${targetName}さんにメッセージを送る`} aria-label={`${targetName}さんにメッセージを送る`}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: loading ? "default" : "pointer",
            padding: "6px 12px", borderRadius: 8, color: "var(--ink-soft)", fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 500 }}>
          {ICON}<span className="dm-action-label">{text}</span>
        </button>
      ) : variant === "primary" ? (
        /* ★塗りの主ボタン（2026-11-05 / 柴さんの指示。/people では「メッセージ」が主、「フォロー」が副） */
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-primary" className="btn-fixed-size"
          style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", minHeight: 34,
            background: loading ? "var(--line)" : "var(--royal)", color: loading ? "var(--ink-mute)" : "#fff", borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
            border: "1.5px solid var(--royal)", whiteSpace: "nowrap", cursor: loading ? "default" : "pointer", boxSizing: "border-box" }}>
          {ICON}{text}
        </button>
      ) : variant === "iconPrimary" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-icon-primary" aria-label={`${targetName}さんにメッセージを送る`} title="メッセージを送る" className="btn-fixed-size"
          style={{ width: 34, height: 34, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
            background: loading ? "var(--line)" : "var(--royal)", color: "#fff", border: "none", cursor: loading ? "default" : "pointer", padding: 0 }}>
          {ICON}
        </button>
      ) : variant === "link" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="ask-experience"
          style={{ background: "none", border: "none", padding: "2px 0", fontSize: 12.5, fontWeight: 600, color: loading ? "var(--ink-mute)" : "var(--royal)", fontFamily: "inherit", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" }}>
          {loading ? "準備中..." : (label ?? "この経験について聞く")}
        </button>
      ) : variant === "card" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-card"
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", background: "#fff",
            color: loading ? "var(--ink-mute)" : "var(--royal)", borderRadius: 9, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            border: "1.5px solid var(--royal-100)", whiteSpace: "nowrap", cursor: loading ? "default" : "pointer" }}>
          {ICON}{text}
        </button>
      ) : variant === "icon" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-icon" aria-label={`${targetName}さんにメッセージを送る`} title="メッセージを送る" className="btn-fixed-size"
          style={{ width: 34, height: 34, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#fff",
            color: loading ? "var(--ink-mute)" : "var(--royal)", border: "1.5px solid var(--royal-100)", cursor: loading ? "default" : "pointer", padding: 0 }}>
          {ICON}
        </button>
      ) : variant === "menuItem" ? (
        <button type="button" role="menuitem" onClick={handleClick} disabled={loading} data-action="personal-dm"
          style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: loading ? "var(--ink-mute)" : "var(--ink)", cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" }}>
          {loading ? "準備中..." : (label ?? "個人としてメッセージを送る")}
        </button>
      ) : (
        <button type="button" onClick={handleClick} disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8,
            border: "1.5px solid var(--royal-100)", background: loading ? "var(--line)" : "var(--royal-50)",
            color: loading ? "var(--ink-mute)" : "var(--royal)", fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}>
          {ICON}
          {loading ? "準備中..." : (label ?? `${targetName} にDMを送る`)}
        </button>
      )}
      {notice && floatingNotice && mounted && createPortal(
        <div data-state="dm-notice" role="status" onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: "50%", bottom: 88, transform: "translateX(-50%)", zIndex: 1100, maxWidth: "calc(100vw - 32px)", padding: "10px 14px",
            borderRadius: 10, background: "var(--ink)", color: "#fff", fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          {notice.text}
          {notice.requestsLink && (
            <>{" "}<Link href="/mypage/conversations?tab=unreplied" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>未返信のメッセージを見る →</Link></>
          )}
        </div>,
        document.body,
      )}
      {notice && !floatingNotice && (
        <span data-state="dm-notice" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {notice.text}
          {notice.requestsLink && (
            <>{" "}<Link href="/mypage/conversations?tab=unreplied" style={{ color: "var(--royal)", fontWeight: 700 }}>未返信のメッセージを見る →</Link></>
          )}
        </span>
      )}

      {needExperience && mounted && (
        <Modal titleId="dm-need-experience-title" onClose={() => setNeedExperience(null)}>
          <div data-state="dm-need-experience" style={{ display: "grid", gap: 12 }}>
            <div id="dm-need-experience-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>先に職歴を登録してください</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>{needExperience}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setNeedExperience(null)} className="tap-min-h"
                style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                あとで
              </button>
              <a href={`/mypage?add=career&return=${encodeURIComponent(here())}`} data-action="dm-add-career" className="tap-min-h"
                style={{ display: "inline-flex", alignItems: "center", padding: "10px 18px", borderRadius: 10, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                職歴を登録する
              </a>
            </div>
          </div>
        </Modal>
      )}

      {compose && mounted && (
        <Modal titleId="dm-request-title" onClose={() => setCompose(null)}>
          <NewMessageComposer titleId="dm-request-title" recipientName={targetName} compose={compose}
            onSendMessage={(message) => post(compose.connected ? { connected: true, message } : { kind: "message", message })}
            onSendConsult={(d) => post(compose.connected ? { connected: true, consult: consultDraftBody(d) } : { consult: consultDraftBody(d) })}
            onCancel={() => setCompose(null)} />
        </Modal>
      )}
    </>
  );
}

function Modal({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "100%", overflowY: "auto", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.2)", background: "#fff", padding: "16px 18px", boxSizing: "border-box", minWidth: 0 }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * ★最初の1通を書く画面（2026-11-05）。文章だけのメッセージでも、相談でも送れる。
 *   入力欄の近くに「相談テーマ」（聞きたい話）を出す。選ばなくても送れる。選ぶと相談の項目が開き、送ると相談として届く。
 *   ⚠️ 書いた文章は、相談に切り替えると「ひとこと」に引き継ぐ（打ち直させない）
 */
export function NewMessageComposer({ recipientName, compose, onSendMessage, onSendConsult, onCancel, titleId, sample = false }: {
  recipientName: string;
  compose: Compose;
  onSendMessage?: (message: string) => Promise<string | null>;
  onSendConsult?: (d: ConsultDraft) => Promise<string | null>;
  onCancel?: () => void;
  titleId: string;
  sample?: boolean;
}) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ConsultDraft>(emptyConsultDraft(compose.selectedAbout));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consulting = !!draft.about;
  const tooLong = text.length > compose.maxLength;
  const ready = consulting ? isConsultDraftReady(draft) : text.trim().length > 0 && !tooLong;
  const canSend = ready && !busy && !sample;

  const pickAbout = (about: string | null) => {
    if (about && !draft.about) setDraft({ ...draft, about, note: draft.note || text });
    else if (!about && draft.about) { setText(text || draft.note); setDraft({ ...draft, about: null }); }
    else setDraft({ ...draft, about });
  };
  const send = async () => {
    if (!canSend) return;
    setBusy(true); setError(null);
    try {
      const e = consulting ? await onSendConsult?.(draft) : await onSendMessage?.(text.trim());
      if (e) setError(e);
    } finally { setBusy(false); }
  };

  return (
    <div data-state="new-message-composer" style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{recipientName}さんにメッセージを送る</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.6 }}>
          {compose.connected ? "つながっている方なので、送るとすぐにやり取りを始められます。" : "返信があるとやり取りが始まります。返信が無くても、続けて送れます。"}
        </div>
      </div>

      {!consulting && (
        <div style={{ minWidth: 0 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="メッセージ" placeholder="メッセージを入力（あいさつ・お礼・連絡など）" disabled={busy}
            style={{ display: "block", width: "100%", boxSizing: "border-box", border: `1px solid ${tooLong ? "var(--error)" : "var(--line)"}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, color: tooLong ? "var(--error)" : "var(--ink-mute)", marginTop: 4 }}>{text.length} / {compose.maxLength}</div>
        </div>
      )}

      <div data-state="new-message-topics" style={{ display: "grid", gap: 12, padding: "12px 14px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)", minWidth: 0 }}>
        <ConsultAboutChips options={compose.options} value={draft.about} onChange={pickAbout} disabled={busy}
          label={consulting ? "聞きたい話" : "相談テーマ（選ばなくても送れます）"} />
        {consulting && <ConsultDetailFields draft={draft} onChange={setDraft} disabled={busy} />}
      </div>

      <ConsultPurposeNote />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {!ready && !sample && (
          <span data-state="new-message-missing" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
            {consulting ? "ひとことが長すぎます。" : tooLong ? `メッセージは${compose.maxLength}字までです。` : "メッセージを書くか、相談テーマを選んでください。"}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="tap-min-h"
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
            やめる
          </button>
        )}
        <button type="button" onClick={() => void send()} disabled={!canSend} data-action={consulting ? "send-consult" : "send-message"} className="tap-min-h"
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
            background: ready ? "var(--royal)" : "var(--line)", color: ready ? "#fff" : "var(--ink-mute)", cursor: canSend ? "pointer" : "default" }}>
          {busy ? "送信中…" : consulting ? "相談を送る" : "送る"}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--error)" }}>{error}</p>}
    </div>
  );
}
