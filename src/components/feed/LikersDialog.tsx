"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FollowUserButton } from "@/app/(jobseeker)/u/[id]/FollowUserButton";

/**
 * ★いいねした人の一覧（2026-10-21 / 柴さんの要望。LinkedIn の「リアクション」と同じ形）。
 *   投稿の下の顔と人数を押すと開く。名前を押すとその人のプロフィール、右のボタンでその場でフォローできる。
 * ⚠️ 中身は GET /api/jobseeker/posts/[id]/likes。誰を出さないか（非公開・検証用など）はサーバーが決める。
 *    出さなかった人は「ほか N人」と数だけ出す（いいねの数と一覧の人数が合わないと、消えたように見えるため）。
 * ⚠️ 開いてから取りに行く（フィードの1件ごとに取らない）。
 */
type Liker = {
  id: string; name: string; username: string | null; headline: string | null;
  avatarUrl: string | null; avatarColor: string | null; isMe: boolean; followed: boolean;
};

export function LikersDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; text: string } | { kind: "ok"; total: number; hidden: number; likers: Liker[] }>({ kind: "loading" });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/posts/${postId}/likes`, { cache: "no-store" });
        const d = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) { setState({ kind: "error", text: "ログインすると、いいねした人を見られます" }); return; }
        if (!res.ok || !d) { setState({ kind: "error", text: "読み込めませんでした。時間をおいてもう一度お試しください" }); return; }
        setState({ kind: "ok", total: d.total ?? 0, hidden: d.hiddenCount ?? 0, likers: (d.likers ?? []) as Liker[] });
      } catch {
        if (alive) setState({ kind: "error", text: "読み込めませんでした。通信状況をご確認ください" });
      }
    })();
    return () => { alive = false; };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;
  const title = state.kind === "ok" ? `いいね（${state.total}）` : "いいね";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="いいねした人" data-state="likers-dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "min(640px, 100%)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="btn-fixed-size"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--ink-soft)" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
          {state.kind === "loading" && <div style={{ padding: 24, fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>読み込み中…</div>}
          {state.kind === "error" && <div role="alert" style={{ padding: 24, fontSize: 13, color: "var(--ink-soft)", textAlign: "center" }}>{state.text}</div>}
          {state.kind === "ok" && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {state.likers.map((u) => {
                const href = `/u/${u.username ?? u.id}`;
                return (
                  <li key={u.id} data-state="liker-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                    <Link href={href} onClick={onClose} style={{ flexShrink: 0 }}>
                      <span style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                        background: u.avatarColor ?? "linear-gradient(135deg, var(--royal), var(--accent))", color: "#fff", fontWeight: 700, fontSize: 16 }}>
                        {u.avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : (u.name.trim()[0] ?? "?")}
                      </span>
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={href} onClick={onClose} style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name}{u.isMe ? "（あなた）" : ""}
                      </Link>
                      {u.headline && (
                        <div title={u.headline} style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.headline}</div>
                      )}
                    </div>
                    {!u.isMe && (
                      <div style={{ flexShrink: 0 }}>
                        <FollowUserButton targetUserId={u.id} initialFollowed={u.followed} isAuthenticated compact />
                      </div>
                    )}
                  </li>
                );
              })}
              {state.hidden > 0 && (
                <li data-state="likers-hidden" style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--ink-mute)" }}>
                  ほか {state.hidden}人（プロフィールを公開していない方など）
                </li>
              )}
              {state.likers.length === 0 && state.hidden === 0 && (
                <li style={{ padding: 24, fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>まだいいねはありません</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** ★数だけ出している場所（投稿の個別ページ）で、押すと一覧を開くボタン（2026-10-21） */
export function LikersCountButton({ postId, count, children }: { postId: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count <= 0) return <span>{children}</span>;
  return (
    <>
      <button type="button" data-action="open-likers" onClick={() => setOpen(true)} aria-label={`いいねした人を見る（${count}人）`}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
        {children}
      </button>
      {open && <LikersDialog postId={postId} onClose={() => setOpen(false)} />}
    </>
  );
}
