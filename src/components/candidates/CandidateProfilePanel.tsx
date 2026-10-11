"use client";

import { useEffect, useState, type ReactNode } from "react";
import { renderCandidateProfile } from "@/lib/profile/profileViewAction";
/* ⚠️ この部品を使うページは、page.tsx で `PROFILE_CLIENT_MODULES` を参照すること（profileClientModules.ts の注記） */

/**
 * ★候補者のプロフィール欄（2026-10-11 / 柴さんの指示。LinkedIn Recruiter と同じく、画面を移らずに右側で確かめる）。
 *   候補者を探す（右欄）と メッセージ（右から出るドロワー）が**同じ部品**を使う。
 *
 * - 上の段（名前・新しいタブで開く・閉じる・`headerExtra`）は固定。中身だけがスクロールする
 * - 中身は /u/[id] と同じ関数（`UserProfileContent`）をサーバーで描いたもの（`renderCandidateProfile`）。
 *   ⚠️★見せてよいかの判定とデータの取り方は /u/[id] と同じ1か所。ここで取り直さない・条件を足さない
 * - `before` … プロフィールの前に出すもの（候補者を探すの「合うところ」「社内メモ」）
 * ⚠️ 状態はバッジにしない（灰色の文字）。
 */
export function CandidateProfilePanel({ userId, name, meta, headerExtra, before, onClose }: {
  userId: string;
  name: string;
  /** 名前の下の灰色の1行（社会人〇年・職種など）。無ければ出さない */
  meta?: ReactNode;
  /** 固定の段に出すもの（メッセージを送る・送れない理由など） */
  headerExtra?: ReactNode;
  before?: ReactNode;
  onClose: () => void;
}) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setContent(null); setFailed(false);
    renderCandidateProfile(userId)
      .then((node) => { if (alive) setContent(node); })
      .catch((e) => { console.error("[CandidateProfilePanel]", e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [userId]);

  return (
    <div data-state="candidate-profile-panel" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 固定の段 */}
      <div style={{ flexShrink: 0, padding: "16px 20px 12px", borderBottom: "1px solid var(--line)", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{name}</h2>
              {/* ★「プロフィール全体を見る」ボタンの代わり。新しいタブで /u/[id] を開く小さなアイコン */}
              <a href={`/u/${userId}`} target="_blank" rel="noopener noreferrer" aria-label={`${name}さんのプロフィールを新しいタブで開く`} title="新しいタブで開く"
                data-state="profile-newtab" className="btn-fixed-size"
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, color: "var(--ink-mute)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
            {meta && <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4, overflowWrap: "anywhere" }}>{meta}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる"
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, padding: 4 }}>✕</button>
        </div>
        {headerExtra}
      </div>
      {/* 中身（ここだけスクロール） */}
      <div data-state="candidate-profile-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 20px" }}>
        {before}
        {failed ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 4px" }}>プロフィールを読み込めませんでした。</p>
        ) : content ?? (
          <p data-state="profile-loading" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "12px 4px" }}>読み込み中…</p>
        )}
      </div>
    </div>
  );
}
