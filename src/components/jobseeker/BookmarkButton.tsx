"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useBookmarkState,
  invalidateBookmarks,
  type BookmarkTargetType,
} from "@/lib/bookmarks/useBookmarkState";

/**
 * 汎用ブックマークボタン
 * target_type: `BOOKMARK_TARGET_TYPES`（lib/constants/bookmarks.ts）。⚠️ ここに並べ直さない
 *
 * ⚠️ `initialBookmarked` / `isAuthenticated` は**任意**（2026-08-09）。
 *
 *    渡す   … 呼び出し側が既に一覧を持っている場合（`/jobs` の JobsClient）。
 *             二重取得にならない。
 *    渡さない … 詳細ページなど。ボタンが自分で取りに行く。
 *             サーバーで引くとページが動的化して ISR が効かなくなるため、
 *             **詳細ページでは渡さないこと。**
 */
/** 同じ対象の保存ボタンどうしで結果を揃えるためのイベント名（2026-10-17） */
const BOOKMARK_CHANGED_EVENT = "opinio:bookmark-changed";

export function BookmarkButton({
  targetType,
  targetId,
  label,
  initialBookmarked,
  isAuthenticated,
  variant = "icon-only",
}: {
  targetType: BookmarkTargetType;
  targetId: string;
  label: string;
  initialBookmarked?: boolean;
  isAuthenticated?: boolean;
  /** "icon-only": 星アイコンのみ（40×40px）、"with-text": テキスト付きボタン */
  variant?: "icon-only" | "with-text";
}) {
  // props で渡されていないときだけ自分で取る
  const selfManaged = initialBookmarked === undefined || isAuthenticated === undefined;
  const fetched = useBookmarkState(targetType, targetId);

  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 自前取得のときは、取れた時点で反映する
  useEffect(() => {
    if (selfManaged && fetched.ready) setBookmarked(fetched.bookmarked);
  }, [selfManaged, fetched.ready, fetched.bookmarked]);

  // props 経由のときは、親の値の変化に追従する（従来どおり）
  useEffect(() => {
    if (!selfManaged && initialBookmarked !== undefined) setBookmarked(initialBookmarked);
  }, [selfManaged, initialBookmarked]);

  /* ★同じ対象の ♡/☆ が1画面に複数あるとき、押した結果を揃える（2026-10-17）。
        求人詳細はスマホで上部の行と下の固定バーの2か所に出るので、片方で保存してももう片方が古いままだった。
     ⚠️ 届けるのは保存に成功したあとだけ（失敗して戻した値は流さない） */
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ targetType: string; targetId: string; bookmarked: boolean }>).detail;
      if (d && d.targetType === targetType && d.targetId === targetId) setBookmarked(d.bookmarked);
    };
    window.addEventListener(BOOKMARK_CHANGED_EVENT, on);
    return () => window.removeEventListener(BOOKMARK_CHANGED_EVENT, on);
  }, [targetType, targetId]);

  const authed = selfManaged ? fetched.authenticated : !!isAuthenticated;

  const toggle = async () => {
    if (selfManaged && !fetched.ready) return; // 取得前は状態が確定しないので待つ
    if (!authed) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    setLoading(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (!res.ok) setBookmarked(!next);
      else {
        invalidateBookmarks(targetType);
        window.dispatchEvent(new CustomEvent(BOOKMARK_CHANGED_EVENT, { detail: { targetType, targetId, bookmarked: next } }));
      }
    } catch {
      setBookmarked(!next);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "with-text") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        style={{
          width: "100%",
          padding: "11px 0",
        /* ⚠️★保存済みの色は **royal に統一した**（2026-08-30）。琥珀・赤にしないこと。
              以前は4通りに割れていた（BookmarkButton と CompanyDetailClient が琥珀、
              CompanyCardList が赤の塗り、JobsClient が薄い赤）。**同じ操作に4つの見た目。**
           ① 琥珀は `--warm`＝「注意・pending」の色。保存は注意ではない。
           ② 赤は `--error` と紛らわしい。
           ③ ★**状態はアイコンの塗り（中抜き→塗り）とラベル（保存→保存済）が既に担っている。**
              色は重複しているだけだった。
           ⚠️ `.claude/skills/ui-conventions` は保存を「ゴースト」と定めている。
              未保存はゴースト、保存済みは royal の淡い塗り、という関係にする。 */
          background: bookmarked ? "var(--royal-50)" : "var(--bg-tint)",
          color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
          border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.5}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {bookmarked ? "保存済" : label}
      </button>
    );
  }

  // icon-only variant
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "保存済" : label}
      aria-label={bookmarked ? "保存済" : label}
      aria-pressed={bookmarked}
      style={{
        width: 40,
        height: 40,
        border: `1px solid ${bookmarked ? "var(--royal-100)" : "var(--line)"}`,
        background: bookmarked ? "var(--royal-50)" : "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: bookmarked ? "var(--royal)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        fontSize: 18,
        transition: "all 0.2s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}
