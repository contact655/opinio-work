"use client";

import { useEffect, useState } from "react";
import { CandidateProfilePanel } from "./CandidateProfilePanel";

/**
 * ★メッセージ画面から、画面を切り替えずに右から候補者のプロフィールを出す（2026-10-11 / 柴さんの指示）。
 *   中身は候補者を探すの右欄と**同じ部品**（`CandidateProfilePanel`）。閉じれば元の一覧の位置のまま。
 * ⚠️ 下の画面は動かさない（ページのスクロール位置を保つため、遷移も scrollTo もしない）。Esc でも閉じる。
 */
export function CandidateProfileDrawer({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // ⚠️ z-index は /biz のヘッダー（BusinessLayout の sticky・100）より上にする。下だと名前と閉じるボタンの段がヘッダーに隠れる
  return (
    <div role="dialog" aria-modal="true" aria-label={`${name}さんのプロフィール`} data-state="candidate-profile-drawer"
      style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", justifyContent: "flex-end" }}>
      <button type="button" aria-label="閉じる" onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.28)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: "min(560px, 100vw)", height: "100%", background: "#fff", boxShadow: "-8px 0 28px rgba(15,23,42,0.18)" }}>
        <CandidateProfilePanel userId={userId} name={name} onClose={onClose} />
      </div>
    </div>
  );
}

/** ★「プロフィールを見る →」のボタン（押すとドロワー）。サーバーのページ（/biz/messages/[id]）からも使えるように切り出した */
export function CandidateProfileDrawerButton({ userId, name, label = "プロフィールを見る →", style }: { userId: string; name: string; label?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-state="open-profile-drawer"
        style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 600, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit", ...style }}>
        {label}
      </button>
      {open && <CandidateProfileDrawer userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

