"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const WORK_LABELS: Record<string, string> = {
  remote: "フルリモート", full_remote: "フルリモート", フルリモート: "フルリモート",
  hybrid: "ハイブリッド", ハイブリッド: "ハイブリッド",
  on_site: "出社", 出社: "出社",
};

type Company = {
  id: string; name: string; industry: string | null; phase: string | null;
  employee_count: number | null; logo_gradient: string | null;
  logo_letter: string | null; logo_url: string | null;
  accepting_casual_meetings: boolean | null; remote_work_status: string | null;
  avg_salary: string | null;
};

export default function SwipePageClient() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [action, setAction] = useState<"like" | "skip" | null>(null);
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch("/api/companies/swipe-list")
      .then((r) => r.json())
      .then((data) => { setCompanies(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const current = companies[index];

  function doLike() {
    if (!current) return;
    setAction("like");
    setLiked((prev) => [...prev, current.id]);
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: current.id, target_type: "company" }),
    }).catch(() => {});
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>読み込み中...</div>
      </div>
    );
  }

  if (!current || index >= companies.length) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>チェック完了！</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 32 }}>
          {liked.length}社 を気になりリストに追加しました
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => router.back()} style={{ padding: "12px 28px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ← 企業一覧へ
          </button>
          <Link href="/mypage" style={{ padding: "12px 28px", background: "var(--royal)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            気になりリストを見る
          </Link>
        </div>
      </div>
    );
  }

  const rotation = (dragX / 300) * 15;
  const likeOpacity = Math.min(1, Math.max(0, dragX / 80));
  const skipOpacity = Math.min(1, Math.max(0, -dragX / 80));
  const workLabel = current.remote_work_status ? (WORK_LABELS[current.remote_work_status] ?? current.remote_work_status) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", userSelect: "none" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer", padding: 0 }}>← 戻る</button>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{index + 1} / {companies.length}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>♥ {liked.length}社</div>
      </div>

      {/* プログレスバー */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", margin: "0 20px" }}>
        <div style={{ width: `${(index / companies.length) * 100}%`, height: "100%", background: "var(--royal)", transition: "width 0.3s", borderRadius: 999 }} />
      </div>

      {/* カードエリア */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 20px 0" }}>
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: "32px 28px 28px",
            width: "100%",
            maxWidth: 380,
            transform: `translateX(${action === "like" ? 500 : action === "skip" ? -500 : dragX}px) rotate(${action === "like" ? 22 : action === "skip" ? -22 : rotation}deg)`,
            transition: dragging ? "none" : "transform 0.3s ease",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            position: "relative",
            touchAction: "none",
          }}
        >
          <div style={{ position: "absolute", top: 24, left: 24, padding: "6px 16px", background: "#10b981", color: "#fff", borderRadius: 8, fontSize: 15, fontWeight: 800, opacity: likeOpacity, transform: "rotate(-12deg)" }}>
            気になる ♥
          </div>
          <div style={{ position: "absolute", top: 24, right: 24, padding: "6px 16px", background: "#ef4444", color: "#fff", borderRadius: 8, fontSize: 15, fontWeight: 800, opacity: skipOpacity, transform: "rotate(12deg)" }}>
            スキップ ✕
          </div>

          <div style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 18, background: current.logo_gradient ?? "linear-gradient(135deg,#001233,#002366)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
            {current.logo_url
              ? <img src={current.logo_url} alt={current.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (current.logo_letter ?? current.name[0])}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{current.name}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18, lineHeight: 1.5 }}>
            {[current.industry, current.phase].filter(Boolean).join(" · ")}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {workLabel && <span style={{ padding: "5px 12px", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{workLabel}</span>}
            {current.avg_salary && <span style={{ padding: "5px 12px", background: "#f0fdf4", color: "#16a34a", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{current.avg_salary}</span>}
            {current.accepting_casual_meetings && <span style={{ padding: "5px 12px", background: "#fffbeb", color: "#92400e", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>面談受付中</span>}
            {current.employee_count && <span style={{ padding: "5px 12px", background: "#f8fafc", color: "#475569", borderRadius: 999, fontSize: 12 }}>{current.employee_count}名</span>}
          </div>

          <Link href={`/companies/${current.id}`} style={{ display: "block", textAlign: "center", padding: "11px 0", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            詳細を見る →
          </Link>
        </div>
      </div>

      {/* アクションボタン */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, padding: "28px 0 32px" }}>
        <button onClick={doSkip} style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)", color: "#ef4444", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ✕
        </button>
        <button onClick={doLike} style={{ width: 76, height: 76, borderRadius: "50%", background: "#10b981", border: "none", color: "#fff", fontSize: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(16,185,129,0.4)" }}>
          ♥
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", paddingBottom: 28 }}>
        右スワイプ = 気になり　左スワイプ = スキップ
      </div>
    </div>
  );
}
