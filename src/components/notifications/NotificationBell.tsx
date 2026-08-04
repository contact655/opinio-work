"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  type: "like" | "comment";
  postId: string;
  postPreview: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    avatarColor: string | null;
    avatarUrl: string | null;
  } | null;
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function ActorAvatar({ actor }: { actor: NotificationItem["actor"] }) {
  const FALLBACK = "linear-gradient(135deg, #002366, #3B5FD9)";
  const name = actor?.name ?? "?";
  const initial = name.charAt(0).toUpperCase();
  const gradient = actor?.avatarColor?.startsWith("linear-gradient")
    ? actor.avatarColor
    : FALLBACK;

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: actor?.avatarUrl ? undefined : gradient,
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {actor?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actor.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}

export function NotificationBell() {
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
              fontFamily: "Inter, sans-serif",
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
            position: "absolute",
            right: 0,
            top: 44,
            width: 320,
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
            <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
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
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                  href={`/feed/${notif.postId}`}
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
                    <ActorAvatar actor={notif.actor} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                          fontSize: 12, fontWeight: 500,
                          color: "var(--ink)",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{notif.actor?.name ?? "誰か"}</span>
                        {notif.type === "like"
                          ? " があなたの投稿にいいねしました"
                          : " があなたの投稿にコメントしました"}
                      </div>
                      {notif.postPreview && (
                        <div
                          style={{
                            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
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
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12, fontWeight: 500,
                          color: "var(--ink-mute)",
                          marginTop: 3,
                        }}
                      >
                        {timeAgo(notif.createdAt)}
                      </div>
                    </div>
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
