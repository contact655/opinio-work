"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirstMessageComposer } from "@/components/messages/FirstMessage";
import type { MessageTopic, TopicSection } from "@/lib/constants/messageTopics";

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
  variant?: "button" | "menuItem";
};

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
export function DMButton({ targetUserId, targetName, label, variant = "button" }: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; requestsLink?: boolean } | null>(null);
  const [composing, setComposing] = useState(false);
  const [topicSections, setTopicSections] = useState<TopicSection[]>([]);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const toAuth = () =>
    router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);

  async function handleClick() {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/dm/start?targetUserId=${targetUserId}`);
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
      if (data.action === "compose") {
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
  async function handleSend(topic: MessageTopic, note: string): Promise<string | null> {
    if (sending) return null;
    setSending(true);
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, topic, message: note }),
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

  return (
    <>
      {variant === "menuItem" ? (
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
      {notice && (
        <span data-state="dm-notice" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {notice.text}
          {notice.requestsLink && (
            <>{" "}<Link href="/mypage/conversations?tab=unreplied" style={{ color: "var(--royal)", fontWeight: 700 }}>未返信のメッセージを見る →</Link></>
          )}
        </span>
      )}

      {composing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dm-request-title"
          onClick={(e) => { if (e.target === e.currentTarget && !sending) setComposing(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "100%", overflowY: "auto", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <FirstMessageComposer titleId="dm-request-title" recipientName={targetName} recipientLine={null}
              sections={topicSections} onSend={handleSend} onCancel={() => { if (!sending) setComposing(false); }} />
          </div>
        </div>
      )}
    </>
  );
}
