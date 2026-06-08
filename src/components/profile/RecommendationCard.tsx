"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RELATIONSHIP_LABELS: Record<string, string> = {
  colleague: "同僚",
  manager: "上司",
  report: "部下",
  client: "顧客・取引先",
  mentor: "メンター",
  other: "その他",
};

type Rec = {
  id: string;
  recommender_name: string;
  recommender_title: string | null;
  recommender_company: string | null;
  relationship: string | null;
  content: string;
  created_at: string;
  is_visible: boolean;
  recommender_user_id: string | null;
};

export function RecommendationCard({
  rec,
  isOwner,
}: {
  rec: Rec;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(!rec.is_visible);

  const TRUNCATE = 240;
  const isTruncatable = rec.content.length > TRUNCATE;
  const display = isTruncatable && !expanded ? rec.content.slice(0, TRUNCATE) + "…" : rec.content;

  async function handleDelete() {
    if (!confirm("この推薦文を削除しますか？")) return;
    setDeleting(true);
    await fetch(`/api/recommendations/${rec.id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  async function handleToggleVisibility() {
    const next = !hidden;
    setHidden(next);
    await fetch(`/api/recommendations/${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: !next }),
    });
    router.refresh();
  }

  const initials = rec.recommender_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      padding: "18px 20px",
      borderRadius: 12,
      background: hidden ? "var(--bg-tint)" : "#fff",
      border: `1px solid ${hidden ? "var(--line)" : "var(--line)"}`,
      opacity: hidden ? 0.6 : 1,
      transition: "opacity 0.15s",
    }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--royal) 0%, #3B5FD9 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {rec.recommender_name}
            </span>
            {rec.relationship && RELATIONSHIP_LABELS[rec.relationship] && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
              }}>
                {RELATIONSHIP_LABELS[rec.relationship]}
              </span>
            )}
            {hidden && isOwner && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: "#FEE2E2", color: "var(--error)",
                border: "1px solid #FECACA",
              }}>
                非表示中
              </span>
            )}
          </div>
          {(rec.recommender_title || rec.recommender_company) && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.4 }}>
              {[rec.recommender_title, rec.recommender_company].filter(Boolean).join(" @ ")}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
            {new Date(rec.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
          </div>
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleToggleVisibility}
              title={hidden ? "表示する" : "非表示にする"}
              style={{
                background: "none", border: "1px solid var(--line)", cursor: "pointer",
                color: "var(--ink-mute)", fontSize: 11, fontWeight: 500,
                padding: "4px 8px", borderRadius: 6, fontFamily: "inherit",
              }}
            >
              {hidden ? "表示" : "非表示"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="削除"
              style={{
                background: "none", border: "1px solid #FECACA", cursor: "pointer",
                color: "var(--error)", fontSize: 11, fontWeight: 500,
                padding: "4px 8px", borderRadius: 6, fontFamily: "inherit",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? "…" : "削除"}
            </button>
          </div>
        )}
      </div>

      {/* 推薦文本文 */}
      <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
        {display}
      </p>
      {isTruncatable && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--royal)", fontSize: 12, fontWeight: 600,
            padding: "6px 0 0", fontFamily: "inherit",
          }}
        >
          {expanded ? "折りたたむ ▲" : "続きを読む ▼"}
        </button>
      )}
    </div>
  );
}
