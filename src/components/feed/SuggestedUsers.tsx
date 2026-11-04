"use client";

import { useState } from "react";
import Link from "next/link";
import { RailBox, RailStackRow, RAIL_LIST_STYLE, RAIL_THUMB } from "@/components/feed/railKit";
import { FollowUserButton } from "@/app/(jobseeker)/u/[id]/FollowUserButton";
import type { UserSuggestionView } from "@/lib/people/suggestServer";

/**
 * ★ホームの「おすすめのユーザー」（2026-11-04 / 柴さんの指示）。選び方は lib/people/suggest.ts、材料は suggestServer.ts。
 *   rail   … PC の右の列（「フォロー中のユーザー」の下）。右の列の共通の箱と3行の形（RailStackRow。名前／おすすめの理由／操作）
 *   scroll … スマホのタイムラインに挟む横スクロールのカード
 *   右に「フォローする」（押すと「フォロー中」。その場では行を消さない）と「×」（押すと30日間その人を出さない）。
 * ⚠️ ×はすぐ隠し、保存に失敗したら元に戻してエラーを出す
 * ⚠️ 出せる人が0人なら箱ごと出さない（×で全員外したときも）
 * ⚠️ 他人のフォロー関係（「〇〇さんもフォローしています」）は出さない
 */

const DISMISS_ERROR = "非表示にできませんでした。もう一度お試しください。";

function Avatar({ u, size }: { u: UserSuggestionView; size: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: u.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.38), overflow: "hidden", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.initial}
    </span>
  );
}

function DismissButton({ name, onClick, rail = false }: { name: string; onClick: () => void; rail?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${name}さんをおすすめに出さない（30日間）`} title="30日間出さない"
      data-action="user-suggest-dismiss" className={rail ? "sgu-x sgu-x-rail" : "sgu-x"}>×</button>
  );
}

export function SuggestedUsers({ users, layout }: { users: UserSuggestionView[]; layout: "rail" | "scroll" }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const visible = users.filter((u) => !hidden.has(u.userId));
  if (visible.length === 0) return null;

  const dismiss = async (id: string) => {
    setError(null);
    setHidden((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/jobseeker/user-suggestions/${encodeURIComponent(id)}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setHidden((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setError({ id, text: DISMISS_ERROR });
    }
  };
  const errorOf = (id: string) => error?.id === id
    ? <p role="alert" data-state="user-suggest-error" style={{ margin: "4px 0 0 50px", fontSize: 11.5, color: "var(--error, #b91c1c)", lineHeight: 1.4 }}>{error.text}</p>
    : null;

  /* ⚠️ この style タグの中に不等号・山かっこ・バッククォートを書かない（ハイドレーションが壊れる） */
  const css = (
    <style>{`
      .sgu-x { width: 18px; height: 22px; min-height: 0; padding: 0; border: none; background: none; color: var(--ink-mute); font-size: 16px; line-height: 1; cursor: pointer; border-radius: 6px; flex-shrink: 0; font-family: inherit; }
      .sgu-x-rail { width: 28px; height: 28px; font-size: 17px; }
      .sgu-x:hover { background: var(--bg-tint); color: var(--ink); }
      .sgu-scroll { list-style: none; margin: 0; padding: 2px 2px 8px; display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
      .sgu-scroll::-webkit-scrollbar { display: none; }
      .sgu-card { position: relative; flex: 0 0 200px; scroll-snap-align: start; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 12px 12px; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
      .sgu-card .sgu-x { position: absolute; top: 6px; right: 6px; }
      .sgu-name { font-size: 13.5px; font-weight: 700; color: var(--ink); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sgu-reason { font-size: 12px; color: var(--ink-mute); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sgu-link { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; max-width: 100%; text-decoration: none; }
    `}</style>
  );

  if (layout === "scroll") {
    return (
      <section data-state="home-user-suggest-scroll" style={{ margin: "4px 0 20px", minWidth: 0 }}>
        {css}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", margin: 0 }}>おすすめのユーザー</h2>
          <Link href="/people" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none", flexShrink: 0 }}>すべて見る →</Link>
        </div>
        <ul className="sgu-scroll">
          {visible.map((u) => (
            <li key={u.userId} className="sgu-card" data-user-id={u.userId}>
              <DismissButton name={u.name} onClick={() => dismiss(u.userId)} />
              <Link href={`/u/${u.userId}`} className="sgu-link" title={`${u.name}：${u.reason}`}>
                <Avatar u={u} size={56} />
                <span className="sgu-name">{u.name}</span>
                <span className="sgu-reason">{u.reason}</span>
              </Link>
              <span style={{ width: "100%", marginTop: 4 }}><FollowUserButton targetUserId={u.userId} initialFollowed={false} isAuthenticated card /></span>
              {error?.id === u.userId && <p role="alert" data-state="user-suggest-error" style={{ margin: 0, fontSize: 11.5, color: "var(--error, #b91c1c)", textAlign: "center" }}>{error.text}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <RailBox title="おすすめのユーザー" moreHref="/people" state="rail-user-suggest">
      {css}
      <div style={RAIL_LIST_STYLE}>
        {visible.map((u) => (
          <div key={u.userId} data-user-id={u.userId}>
            <RailStackRow href={`/u/${u.userId}`} title={`${u.name}：${u.reason}`}
              thumb={<Avatar u={u} size={RAIL_THUMB} />}
              name={u.name} sub={u.reason}
              action={<>
                <FollowUserButton targetUserId={u.userId} initialFollowed={false} isAuthenticated rail />
                <DismissButton name={u.name} onClick={() => dismiss(u.userId)} rail />
              </>} />
            {errorOf(u.userId)}
          </div>
        ))}
      </div>
    </RailBox>
  );
}
