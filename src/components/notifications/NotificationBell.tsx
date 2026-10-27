"use client";

import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  type: "like" | "comment" | "reply" | "comment_like" | "message" | "proposal" | "introduction" | "message_request" | "message_request_accepted" | "company_approach" | "meeting_canceled" | "follow" | "interest_delivered" | "interest_no_reply" | "interest_reask";
  /** フォロー通知のときだけ入る。自分がその人を既にフォローしているか（2026-10-20） */
  followingBack?: boolean;
  /** ⚠️ スカウト・メッセージの通知には投稿が無いので null になる */
  postId: string | null;
  postPreview: string | null;
  /** スカウトのときだけ入る */
  /** メッセージ・紹介のときだけ入る（2026-09-16 / 2026-09-21） */
  conversationId: string | null;
  /** 提案・紹介のときだけ入る（2026-09-21） */
  proposalId: string | null;
  isRead: boolean;
  createdAt: string;
  /** いいね・コメントの送り主（ユーザー） */
  actor: {
    id: string;
    name: string;
    avatarColor: string | null;
    avatarUrl: string | null;
  } | null;
  /** スカウトの送り主（企業） */
  actorCompany: {
    id: string;
    name: string;
    slug: string | null;
    logoLetter: string | null;
    logoGradient: string | null;
  } | null;
};

/** 通知を押したときの遷移先。⚠️ 種別ごとに違う */
function notifHref(notif: NotificationItem): string {
  /* ⚠️ 会話の詳細は参加者しか開けない（page.tsx が `ow_conversation_participants` を
        照合して notFound する）ので、id をそのまま渡してよい。 */
  if (notif.type === "message") return `/mypage/conversations/${notif.conversationId}`;
  /* ★メッセージのお願い（段階3）。⚠️ 受け手は承認前は会話を開けないので、一覧の「お願い」の欄へ */
  if (notif.type === "message_request") return "/mypage/conversations?tab=unreplied";
  if (notif.type === "message_request_accepted") return `/mypage/conversations/${notif.conversationId}`;
  /* ★②の提案は一覧へ。⚠️ 提案ごとの詳細ページは無い */
  if (notif.type === "proposal") return "/mypage/proposals";
  /* ★③の紹介は会話そのものへ。⚠️ 提案一覧に戻さない —— 双方が答え終わっていて、
        そこでできることはもう無い。 */
  if (notif.type === "introduction") return `/mypage/conversations/${notif.conversationId}`;
  /* ★企業からの声かけ（2026-10-09）。一覧で答える */
  if (notif.type === "company_approach") return "/mypage/conversations?tab=unreplied";
  /* ★面談・候補日の取り消し（2026-10-10 / 段4）。会話へ */
  if (notif.type === "meeting_canceled") return `/mypage/conversations/${notif.conversationId}`;
  /* ★「話を聞いてみたい」（2026-10-27）。届いた → 会話へ ／ 返事なし・もう一度押すか → 合う会社へ */
  if (notif.type === "interest_delivered") return `/mypage/conversations/${notif.conversationId}`;
  /* ★「ほかにも合う会社があります」から /home の「あなたに合う会社」へ（2026-10-27 / 柴さんの指示） */
  if (notif.type === "interest_no_reply") return "/home#home-for-you";
  if (notif.type === "interest_reask") return notif.actorCompany?.slug ? `/companies/${notif.actorCompany.slug}` : "/mypage/proposals";
  /* ★フォローされた（2026-10-20）。その人のプロフィールへ */
  if (notif.type === "follow") return `/u/${notif.actor?.id ?? ""}`;
  return `/feed/${notif.postId}`;
}

function notifText(notif: NotificationItem): { who: string; what: string } {
  /* ⚠️★**本文を出さないこと**（2026-09-16）。ベルはヘッダーに常設で、
        通知だけが開いたままの画面に本文の冒頭を出すと、肩越しに読まれる。
        誰から来たかと、押せば読めることだけを伝える。 */
  if (notif.type === "message") {
    return { who: notif.actor?.name ?? "誰か", what: " からメッセージが届きました" };
  }
  /* ★メッセージのお願い（段階3）。⚠️ 本文は出さない（メッセージと同じ） */
  if (notif.type === "message_request") {
    return { who: notif.actor?.name ?? "誰か", what: "さんからメッセージが届きました" };
  }
  if (notif.type === "message_request_accepted") {
    return { who: notif.actor?.name ?? "誰か", what: "さんから返信がありました" };
  }
  /* ⚠️★**根拠の中身を出さない。** ベルはヘッダーに常設なので、
        「◯◯から3人が移っています」まで出すと肩越しに読まれる。
        メッセージと同じで、**誰からと、押せば読めることだけ。** */
  if (notif.type === "proposal") {
    /* ★2026-10-11 に「〇〇 についての提案が届きました」から改めた（柴さんの指示。求職者側で「提案」を使わない）。
          ⚠️ 社名は出さない。押すと /mypage/proposals で会社と理由が読める */
    return { who: "あなたに合いそうな会社", what: "が見つかりました" };
  }
  /* ★③。⚠️ 「双方が会いたいと答えた」と書かない —— 相手が何を押したかは
        相手の情報。**自分に何ができるようになったか**だけを伝える。 */
  if (notif.type === "introduction") {
    return { who: notif.actorCompany?.name ?? "企業", what: " と話せるようになりました" };
  }
  /* ★企業からの声かけ（2026-10-09）。⚠️ 理由・本文は出さない（ベルの決まり）。「スカウト」と呼ばない */
  if (notif.type === "company_approach") {
    return { who: notif.actorCompany?.name ?? "企業", what: " からメッセージが届きました" };
  }
  if (notif.type === "meeting_canceled") {
    return { who: notif.actorCompany?.name ?? "企業", what: " が面談の日程を取り消しました" };
  }
  /* ★「話を聞いてみたい」（2026-10-27）。文言は lib/interest/constants.ts の INTEREST_NOTICE_TEXT と同じ趣旨（ベルは「誰から＋何が」の2つに分ける） */
  if (notif.type === "interest_delivered") {
    return { who: notif.actorCompany?.name ?? "企業", what: " に、あなたの名前とプロフィールが届きました" };
  }
  if (notif.type === "interest_no_reply") {
    return { who: notif.actorCompany?.name ?? "企業", what: " からはまだ返事がありません。ほかにも、あなたの経歴に合う会社があります" };
  }
  if (notif.type === "interest_reask") {
    return { who: notif.actorCompany?.name ?? "企業", what: " の担当者が登録しました。届けるには、もう一度「話を聞いてみたい」を押してください" };
  }
  /* ★コメントへの返信・いいね（2026-10-20）。押すと元の投稿（/feed/[postId]）へ。⚠️ コメントの本文は出さない */
  if (notif.type === "follow") {
    return { who: notif.actor?.name ?? "ユーザー", what: " があなたをフォローしました" };
  }
  if (notif.type === "reply") {
    return { who: notif.actor?.name ?? "誰か", what: " があなたのコメントに返信しました" };
  }
  if (notif.type === "comment_like") {
    return { who: notif.actor?.name ?? "誰か", what: " があなたのコメントにいいねしました" };
  }
  return {
    who: notif.actor?.name ?? "誰か",
    what: notif.type === "like" ? " があなたの投稿にいいねしました" : " があなたの投稿にコメントしました",
  };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function ActorAvatar({ notif }: { notif: NotificationItem }) {
  const FALLBACK = "linear-gradient(135deg, #002366, #3B5FD9)";
  /* ⚠️ 送り主が**企業**の種別。ユーザーのアバターは入っていない（2026-09-21 に2つ足した） */
  const isCompanyActor = notif.type === "proposal" || notif.type === "introduction" || notif.type === "company_approach" || notif.type === "meeting_canceled"
    || notif.type === "interest_delivered" || notif.type === "interest_no_reply" || notif.type === "interest_reask";
  const actor = notif.actor;
  const company = notif.actorCompany;

  const name = (isCompanyActor ? company?.name : actor?.name) ?? "?";
  const initial = (isCompanyActor && company?.logoLetter) || name.charAt(0).toUpperCase();
  const rawGradient = isCompanyActor ? company?.logoGradient : actor?.avatarColor;
  const gradient = rawGradient?.startsWith("linear-gradient") ? rawGradient : FALLBACK;
  const avatarUrl = isCompanyActor ? null : actor?.avatarUrl ?? null;

  return (
    <div
      style={{
        width: 32,
        height: 32,
        background: avatarUrl ? undefined : gradient,
        borderRadius: isCompanyActor ? 8 : "50%", // 企業は角丸、人は円で見分ける
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: 12,
        fontFamily: "var(--font-inter), var(--font-noto)",
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}

/**
 * @param compactPanel 狭い画面（768px 未満）のヘッダーに置くとき true（2026-10-09）。
 *   ⚠️ 通常の 320px 幅・右寄せのままだと、375px ではベルの位置によって左へはみ出す。
 *      true のときは画面の左右 12px に合わせて固定配置にする。
 */
/**
 * フォロー通知の「フォローし返す」（2026-10-20）。
 * ⚠️ 通知の行は <Link> なので、押したときに遷移させない（preventDefault / stopPropagation）。
 * ⚠️ 外す操作は置かない（ベルでは「し返す」だけ。外すのはプロフィールから）。
 */
function FollowBackButton({ userId, initialFollowing, onFollowed }: { userId: string; initialFollowing: boolean; onFollowed: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(initialFollowing ? "done" : "idle");
  useEffect(() => { if (initialFollowing) setState("done"); }, [initialFollowing]);
  const onClick = async (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === "saving" || state === "done") return;
    setState("saving");
    try {
      const res = await fetch(`/api/jobseeker/users/${userId}/follow`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
      onFollowed();
    } catch (err) {
      console.error("[NotificationBell] follow back:", err);
      setState("error");
    }
  };
  const done = state === "done";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "saving" || done}
      data-state={done ? "following" : state}
      className="btn-fixed-size"
      style={{
        alignSelf: "center", flexShrink: 0, height: 28, padding: "0 10px", borderRadius: 100,
        fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: done ? "default" : "pointer",
        border: done ? "1px solid var(--line)" : "1px solid var(--royal)",
        background: done ? "#fff" : "var(--royal)", color: done ? "var(--ink-mute)" : "#fff",
      }}
    >
      {done ? "フォロー中" : state === "error" ? "もう一度" : state === "saving" ? "…" : "フォロー"}
    </button>
  );
}

export function NotificationBell({ compactPanel = false }: { compactPanel?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/jobseeker/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent fail
    }
  }, []);

  // マウント時 + ページフォーカス時に未読数を取得
  useEffect(() => {
    fetchNotifications();
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNotifications]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);

    // 開いたら全件既読にしてバッジを消す
    if (willOpen && unreadCount > 0) {
      setLoading(true);
      try {
        await fetch("/api/jobseeker/notifications", { method: "PATCH" });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* ベルボタン */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="通知"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--ink-soft)",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <Bell size={18} />
        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 100,
              background: "#DC2626",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-inter), var(--font-noto)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              border: "1.5px solid #fff",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {open && (
        <div
          style={{
            ...(compactPanel
              ? { position: "fixed" as const, left: 12, right: 12, top: 64 }
              : { position: "absolute" as const, right: 0, top: 44, width: 320 }),
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--line-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              通知
            </span>
            {loading && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>既読にしています…</span>
            )}
          </div>

          {/* 通知リスト */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  fontSize: 13,
                  color: "var(--ink-mute)",
                }}
              >
                通知はありません
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notifHref(notif)}
                  onClick={() => setOpen(false)}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "12px 16px",
                      background: notif.isRead ? "#fff" : "var(--royal-50)",
                      borderBottom: "1px solid var(--line-soft)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tint)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = notif.isRead ? "#fff" : "var(--royal-50)";
                    }}
                  >
                    <ActorAvatar notif={notif} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-inter), var(--font-noto)",
                          fontSize: 12, fontWeight: 500,
                          color: "var(--ink)",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{notifText(notif).who}</span>
                        {notifText(notif).what}
                        {notif.type === "interest_no_reply" && (
                          <span data-state="notif-no-reply-link" style={{ marginLeft: 6, color: "var(--royal)", fontWeight: 600, whiteSpace: "nowrap" }}>合う会社を見る →</span>
                        )}
                      </div>
                      {notif.postPreview && (
                        <div
                          style={{
                            fontFamily: "var(--font-inter), var(--font-noto)",
                            fontSize: 12, fontWeight: 500,
                            color: "var(--ink-mute)",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {notif.postPreview}
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: "var(--font-inter), var(--font-noto)",
                          fontSize: 12, fontWeight: 500,
                          color: "var(--ink-mute)",
                          marginTop: 3,
                        }}
                      >
                        {timeAgo(notif.createdAt)}
                      </div>
                    </div>
                    {notif.type === "follow" && notif.actor && (
                      <FollowBackButton
                        userId={notif.actor.id}
                        initialFollowing={notif.followingBack === true}
                        onFollowed={() => setNotifications((prev) => prev.map((n) =>
                          n.type === "follow" && n.actor?.id === notif.actor?.id ? { ...n, followingBack: true } : n))}
                      />
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
