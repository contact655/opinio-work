"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirstMessageComposer } from "@/components/messages/FirstMessage";
import type { MessageFormat, MessageTopic, TopicSection } from "@/lib/constants/messageTopics";

type Props = {
  targetUserId: string;
  targetName: string;
  targetAvatarUrl?: string | null;
  /**
   * ボタンの文言。既定は「〇〇 にDMを送る」。
   * ⚠️ `/u/[id]` のヘッダーは `label="メッセージ"` を渡す（2026-08-23）。
   *    CTA 群をメタ行の下へ移したとき、氏名入りだと行が長くなりすぎたため。
   *    氏名は同じカードの見出しに大きく出ているので、繰り返す必要が無い。
   */
  label?: string;
  /** ★「…」メニューの中に置く形（2026-10-11 / 企業の担当者が /u/[id] を見たとき。「個人としてメッセージを送る」） */
  /** ★action … フィードの投稿の下の操作行（いいね・コメントと並ぶ。2026-10-20） */
  variant?: "button" | "menuItem" | "card" | "icon" | "action";
  /** ★企業ページの社員の行から送るとき、その会社の id（2026-10-18）。「会社のこと」のテーマがこの会社になる */
  aboutCompanyId?: string | null;
};

/* ★一覧のカードに置く形（2026-10-17 / /people）。
   card … カードの CTA 行の「プロフィール」と同じ見た目（白・細い枠・幅いっぱい）
   icon … スマホの行の右に置く丸いアイコンだけの形
   ⚠️ カードは全体がクリックでプロフィールへ飛ぶ。押した操作・ダイアログの中の操作が
      カードまで伝わらないよう、ここで伝播を止めている（呼び出し側で包まなくてよい）。 */
const ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * ★DM の入口。2026-10-09 に「メッセージのお願い」へ作り替えた（段階3）。
 *
 * 押すと `GET /api/dm/start` で相手とのあいだの段を聞き、
 *   - 承認済み・自分が送ったお願い … その会話を開く
 *   - これから送る             … この画面の上で本文を書いて送る（`POST /api/dm/start`）
 *   - 送れない（止まった・上限・相手からのお願いが届いている） … **ボタンの横に文言を出す**
 *
 * ⚠️★**止まったときに会話一覧へ移らないこと。** 2026-10-09 までは、403 でも黙って
 *    `/mypage/conversations` へ移っていた（何が起きたか分からない）。
 * ⚠️★**空の会話を作らない。** 本文が無ければ送らない（以前は押しただけで空の会話ができた）。
 * ⚠️ 文言はサーバーが返したものをそのまま出す。相手に関わる理由は返ってこない。
 * ★2026-10-17: 書く画面は「聞きたいテーマ＋ひとこと（100字）」（FirstMessageComposer）。
 *   テーマは GET /api/dm/start が相手ごとに返すもの（送信の検証と同じ関数 dmTopicSections）。
 */
export function DMButton({ targetUserId, targetName, label, variant = "button", aboutCompanyId = null }: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; requestsLink?: boolean } | null>(null);
  const [composing, setComposing] = useState(false);
  const [topicSections, setTopicSections] = useState<TopicSection[]>([]);
  /* ★書く画面の段（2026-10-20 / 柴さんの判断）。
       connected … つながっている（相互フォロー）相手。テーマを聞かずにふつうのメッセージ欄。送るとすぐ会話になる
       choose    … それ以外の相手。最初に「キャリアの相談をする」「メッセージを送る」を選ぶ
       consult   … キャリア相談（テーマ＋ひとこと）／ message … メッセージ（テーマなし）。返信が無くても続けて送れる（2026-10-23。lib/constants/messages.ts） */
  const [mode, setMode] = useState<"connected" | "choose" | "consult" | "message">("choose");
  const [maxLength, setMaxLength] = useState(2000);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const toAuth = () =>
    router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);

  async function handleClick(e?: React.MouseEvent) {
    e?.stopPropagation();
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/dm/start?targetUserId=${targetUserId}${aboutCompanyId ? `&aboutCompanyId=${encodeURIComponent(aboutCompanyId)}` : ""}`);
      if (res.status === 401) { toAuth(); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setNotice({ text: data?.error ?? "現在メッセージを送れません" });
        return;
      }
      if (data.action === "open" && data.conversationId) {
        router.push(`/mypage/conversations?open=${data.conversationId}`);
        return;
      }
      if (data.action === "compose" && data.connected === true) {
        setMode("connected");
        setMaxLength(typeof data.maxLength === "number" ? data.maxLength : 2000);
        setComposing(true);
        return;
      }
      if (data.action === "compose") {
        setMode("choose");
        setMaxLength(typeof data.messageMaxLength === "number" ? data.messageMaxLength : 500);
        /* ⚠️ テーマが取れなければ書かせない（選べないまま送れない画面になる） */
        if (!Array.isArray(data.topicSections) || data.topicSections.length === 0) {
          setNotice({ text: "現在メッセージを送れません" });
          return;
        }
        setTopicSections(data.topicSections as TopicSection[]);
        setComposing(true);
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
  async function handleSend(topic: MessageTopic, note: string, format: MessageFormat): Promise<string | null> {
    return post({ targetUserId, topic, format, aboutCompanyId, message: note });
  }
  /** つながっている相手へ（テーマなし。すぐ会話になる） */
  async function handleSendConnected(message: string): Promise<string | null> {
    return post({ targetUserId, connected: true, message });
  }
  /** メッセージ（テーマなし。返信までは1通だけ） */
  async function handleSendMessage(message: string): Promise<string | null> {
    return post({ targetUserId, kind: "message", message });
  }
  async function post(payload: Record<string, unknown>): Promise<string | null> {
    if (sending) return null;
    setSending(true);
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { toAuth(); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.conversationId) {
        /* ⚠️ 止まったときは移らない。理由をここに出す */
        return data?.error ?? "送信に失敗しました。もう一度お試しください";
      }
      router.push(`/mypage/conversations?open=${data.conversationId}`);
      return null;
    } catch {
      return "送信に失敗しました。もう一度お試しください";
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!composing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !sending) setComposing(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing, sending]);

  /* ★一覧の形では、止まった理由をボタンの横ではなく画面下の小さな帯で出す（カードの高さを崩さない）。4秒で消す */
  const floatingNotice = variant === "card" || variant === "icon" || variant === "action";
  useEffect(() => {
    if (!notice || !floatingNotice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, floatingNotice]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      {variant === "action" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-post-author" title={`${targetName}さんにメッセージを送る`} aria-label={`${targetName}さんにメッセージを送る`}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: loading ? "default" : "pointer",
            padding: "6px 12px", borderRadius: 8, color: "var(--ink-soft)", fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 500 }}>
          {ICON}<span className="dm-action-label">{loading ? "準備中..." : (label ?? "メッセージ")}</span>
        </button>
      ) : variant === "card" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-card"
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 10px", background: "#fff",
            color: loading ? "var(--ink-mute)" : "var(--royal)", borderRadius: 9, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            border: "1.5px solid var(--royal-100)", whiteSpace: "nowrap", cursor: loading ? "default" : "pointer" }}>
          {ICON}{loading ? "準備中..." : (label ?? "メッセージ")}
        </button>
      ) : variant === "icon" ? (
        <button type="button" onClick={handleClick} disabled={loading} data-action="dm-icon" aria-label={`${targetName}さんにメッセージを送る`} className="btn-fixed-size"
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
      <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 8,
            border: "1.5px solid var(--royal-100)",
            background: loading ? "var(--line)" : "var(--royal-50)",
            color: loading ? "var(--ink-mute)" : "var(--royal)",
            fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
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

      {composing && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dm-request-title"
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && !sending) setComposing(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "100%", overflowY: "auto", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            {mode === "connected" ? (
              <PlainComposer titleId="dm-request-title" recipientName={targetName} maxLength={maxLength} state="connection-composer"
                note="つながっている方なので、送るとすぐにやり取りを始められます。"
                onSend={handleSendConnected} onCancel={() => { if (!sending) setComposing(false); }} />
            ) : mode === "choose" ? (
              <ChooseKind titleId="dm-request-title" recipientName={targetName} onChoose={setMode} onCancel={() => setComposing(false)} />
            ) : mode === "message" ? (
              <PlainComposer titleId="dm-request-title" recipientName={targetName} maxLength={maxLength} state="message-composer"
                note="あいさつ・お礼・連絡など。返信が無くても、続けて送れます。"
                onBack={() => { if (!sending) setMode("choose"); }}
                onSend={handleSendMessage} onCancel={() => { if (!sending) setComposing(false); }} />
            ) : (
              <FirstMessageComposer titleId="dm-request-title" recipientName={targetName} recipientLine={null}
                sections={topicSections} onSend={handleSend} onCancel={() => { if (!sending) setComposing(false); }}
                onBack={() => { if (!sending) setMode("choose"); }} />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * ★最初に用件の種類を選ぶ（2026-10-20 / 柴さんの判断）。
 *   キャリア相談は「聞く側だけが相手の時間をもらう」ので、テーマとひとことを添えてもらう。
 *   それ以外（あいさつ・お礼・連絡）はテーマを選ばずに書ける。
 * ⚠️ どちらも返信までは1通だけ。種類で決まりを変えない（決まりは lib/conversations/messageRequest.ts）
 */
function ChooseKind({ recipientName, onChoose, onCancel, titleId }: {
  recipientName: string;
  onChoose: (m: "consult" | "message") => void;
  onCancel: () => void;
  titleId: string;
}) {
  const option = (m: "consult" | "message", title: string, desc: string) => (
    <button type="button" data-kind={m} onClick={() => onChoose(m)}
      style={{ display: "block", width: "100%", textAlign: "left", border: "1.5px solid var(--line)", borderRadius: 10, padding: "12px 14px", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
      <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 3, lineHeight: 1.6 }}>{desc}</span>
    </button>
  );
  return (
    <div data-state="dm-choose-kind" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", background: "#fff", display: "grid", gap: 10, minWidth: 0 }}>
      <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{recipientName}さんにメッセージを送る</div>
      {option("consult", "キャリアの相談をする", "聞きたいことを選んで、ひとこと添えて送ります。")}
      {option("message", "メッセージを送る", "あいさつ・お礼・連絡など、相談以外の用件です。")}
      <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>どちらも、返信があるとやり取りが始まります。</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          やめる
        </button>
      </div>
    </div>
  );
}

/**
 * ★テーマを選ばずに書く画面（2026-10-20）。つながっている相手へ／「メッセージを送る」を選んだときに使う。
 * ⚠️ `note` で、送ったあとどうなるか（すぐ会話になる／返信までは1通だけ）を一言で伝える。
 */
function PlainComposer({ recipientName, maxLength, note, state, onSend, onCancel, onBack, titleId }: {
  recipientName: string;
  maxLength: number;
  note: string;
  state: string;
  onSend: (message: string) => Promise<string | null>;
  onCancel: () => void;
  onBack?: () => void;
  titleId: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = text.length > maxLength;
  const canSend = text.trim().length > 0 && !tooLong && !busy;
  const send = async () => {
    if (!canSend) return;
    setBusy(true); setError(null);
    try { const e = await onSend(text.trim()); if (e) setError(e); } finally { setBusy(false); }
  };
  return (
    <div data-state={state} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", background: "#fff", display: "grid", gap: 12, minWidth: 0 }}>
      {onBack && (
        <button type="button" onClick={onBack} data-action="dm-back"
          style={{ justifySelf: "start", background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}>
          ← 種類を選び直す
        </button>
      )}
      <div style={{ minWidth: 0 }}>
        <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{recipientName}さんにメッセージを送る</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.6 }}>{note}</div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        aria-label="メッセージ"
        placeholder="メッセージを入力"
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: tooLong ? "var(--danger-ink, #b91c1c)" : "var(--ink-mute)" }}>{text.length} / {maxLength}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} disabled={busy}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          やめる
        </button>
        <button type="button" onClick={send} disabled={!canSend} data-action="plain-send"
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: canSend ? "var(--royal)" : "var(--line)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canSend ? "pointer" : "default" }}>
          {busy ? "送信中…" : "送る"}
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: "var(--danger-ink, #b91c1c)" }}>{error}</div>}
    </div>
  );
}
