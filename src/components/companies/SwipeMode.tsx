"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { CompanyListRow } from "@/lib/supabase/queries";

const WORK_LABELS: Record<string, string> = {
  remote: "フルリモート", full_remote: "フルリモート", フルリモート: "フルリモート",
  hybrid: "ハイブリッド", ハイブリッド: "ハイブリッド",
  on_site: "出社", 出社: "出社",
};

type Props = { companies: CompanyListRow[]; onClose: () => void };

export default function SwipeMode({ companies, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [action, setAction] = useState<"like" | "skip" | null>(null);

  // Touch swipe
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const current = companies[index];

  function doLike() {
    if (!current) return;
    setAction("like");
    setLiked((prev) => [...prev, current.id]);
    // Bookmark via API (best-effort)
    fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_id: current.id, target_type: "company" }) }).catch(() => {});
    setTimeout(() => { setAction(null); setDragX(0); setIndex((i) => i + 1); }, 300);
  }

  function doSkip() {
    setAction("skip");
    setTimeout(() => { setAction(null); setDragX(0); setIndex((i) => i + 1); }, 300);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    setDragX(e.touches[0].clientX - startX.current);
  }
  function onTouchEnd() {
    setDragging(false);
    if (dragX > 80) doLike();
    else if (dragX < -80) doSkip();
    else setDragX(0);
  }

  if (!current || index >= companies.length) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#f8fafc", zIndex: 3000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>スワイプ完了！</div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24 }}>
          気になりリストに {liked.length}社 追加しました
        </div>
        <button onClick={onClose} style={{ padding: "12px 32px", background: "var(--royal)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          一覧に戻る
        </button>
      </div>
    );
  }

  const rotation = (dragX / 300) * 15;
  const likeOpacity = Math.min(1, Math.max(0, dragX / 80));
  const skipOpacity = Math.min(1, Math.max(0, -dragX / 80));

  const workLabel = current.remote_work_status
    ? (WORK_LABELS[current.remote_work_status] ?? current.remote_work_status)
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f172a", zIndex: 3000, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", color: "#fff" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}>← 戻る</button>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{index + 1} / {companies.length}</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{liked.length}社 気になり</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", marginBottom: 24 }}>
        <div style={{ width: `${((index) / companies.length) * 100}%`, height: "100%", background: "var(--royal)", transition: "width 0.3s" }} />
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 28,
            width: "100%",
            maxWidth: 360,
            transform: `translateX(${
              action === "like" ? 400 : action === "skip" ? -400 : dragX
            }px) rotate(${action === "like" ? 20 : action === "skip" ? -20 : rotation}deg)`,
            transition: dragging ? "none" : "transform 0.3s ease",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            position: "relative",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          {/* Like/Skip overlays */}
          <div style={{ position: "absolute", top: 20, left: 20, padding: "6px 14px", background: "#10b981", color: "#fff", borderRadius: 8, fontSize: 16, fontWeight: 800, border: "3px solid #10b981", opacity: likeOpacity, transform: "rotate(-12deg)", transition: "opacity 0.1s" }}>
            気になる ♥
          </div>
          <div style={{ position: "absolute", top: 20, right: 20, padding: "6px 14px", background: "#ef4444", color: "#fff", borderRadius: 8, fontSize: 16, fontWeight: 800, border: "3px solid #ef4444", opacity: skipOpacity, transform: "rotate(12deg)", transition: "opacity 0.1s" }}>
            スキップ
          </div>

          {/* Company logo */}
          <div style={{
            width: 64, height: 64, borderRadius: 14, marginBottom: 16,
            background: current.logo_gradient ?? "linear-gradient(135deg,#001233,#002366)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif",
          }}>
            {current.logo_url
              ? <img src={current.logo_url} alt={current.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
              : current.logo_letter}
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>{current.name}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.5 }}>
            {current.industry ?? ""}{current.industry && current.phase ? " · " : ""}{current.phase ?? ""}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {workLabel && (
              <span style={{ padding: "4px 12px", background: "var(--royal-50)", color: "var(--royal)", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{workLabel}</span>
            )}
            {current.employee_count && (
              <span style={{ padding: "4px 12px", background: "var(--bg-tint)", color: "var(--ink-soft)", borderRadius: 999, fontSize: 12 }}>{current.employee_count}</span>
            )}
            {current.accepting_casual_meetings && (
              <span style={{ padding: "4px 12px", background: "#FEF3C7", color: "#92400E", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>面談受付中</span>
            )}
          </div>

          <Link href={`/companies/${current.id}`} style={{ display: "block", textAlign: "center", padding: "10px 0", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>
            詳細を見る →
          </Link>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: "24px 0 40px" }}>
        <button onClick={doSkip} style={{ width: 60, height: 60, borderRadius: "50%", background: "#fff", border: "none", fontSize: 26, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
        <button onClick={doLike} style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--success)", border: "none", fontSize: 30, cursor: "pointer", boxShadow: "0 4px 24px rgba(5,150,105,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          ♥
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", paddingBottom: 24 }}>
        右スワイプ = 気になり　左スワイプ = スキップ
      </div>
    </div>
  );
}
