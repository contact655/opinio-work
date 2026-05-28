"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Mentor = {
  id: string;
  name: string;
  current_company: string | null;
  current_role: string | null;
  avatar_url: string | null;
  display_order: number | null;
  is_available: boolean;
};

function getAvatarGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, #002366, #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, #059669, #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    "linear-gradient(135deg, #D97706, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, #002366)",
    "linear-gradient(135deg, #DC2626, #F87171)",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const supabase = createClient();

  const showFlash = useCallback((msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }, []);

  useEffect(() => {
    supabase
      .from("ow_mentors")
      .select("id, name, current_company, current_role, avatar_url, display_order, is_available")
      .order("display_order", { nullsFirst: false })
      .then(({ data }) => {
        if (data) {
          setMentors(data);
          const urlMap: Record<string, string> = {};
          const orderMap: Record<string, string> = {};
          data.forEach((m) => {
            urlMap[m.id] = m.avatar_url || "";
            orderMap[m.id] = m.display_order != null ? String(m.display_order) : "";
          });
          setUrlInputs(urlMap);
          setOrderInputs(orderMap);
        }
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMentor = async (mentorId: string) => {
    const url = urlInputs[mentorId]?.trim() || null;
    const order = orderInputs[mentorId] ? parseInt(orderInputs[mentorId], 10) : null;
    setSaving(mentorId);
    const { error } = await supabase
      .from("ow_mentors")
      .update({
        avatar_url: url,
        display_order: isNaN(order as number) ? null : order,
      })
      .eq("id", mentorId);
    setSaving(null);

    if (!error) {
      setMentors((prev) =>
        prev.map((m) =>
          m.id === mentorId
            ? { ...m, avatar_url: url, display_order: isNaN(order as number) ? null : order }
            : m
        )
      );
      showFlash("保存しました", true);
    } else {
      showFlash("保存に失敗しました", false);
    }
  };

  const toggleAvailable = async (mentorId: string, current: boolean) => {
    setSaving(mentorId);
    const { error } = await supabase
      .from("ow_mentors")
      .update({ is_available: !current })
      .eq("id", mentorId);
    setSaving(null);

    if (!error) {
      setMentors((prev) =>
        prev.map((m) => (m.id === mentorId ? { ...m, is_available: !current } : m))
      );
      showFlash(`${!current ? "受付開始" : "受付停止"}しました`, true);
    } else {
      showFlash("更新に失敗しました", false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 8, maxWidth: 300, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  const availableCount = mentors.filter((m) => m.is_available).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              メンター管理
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
              background: "var(--error)", color: "#fff",
              padding: "2px 7px", borderRadius: 4,
            }}>ADMIN</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
            写真URL・表示順・受付状況を管理します
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            全{" "}
            <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
              {mentors.length}
            </strong>{" "}名
          </div>
          <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 2 }}>
            受付中 {availableCount}名
          </div>
        </div>
      </div>

      {/* ── Flash toast ───────────────────────────────────────────── */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: flash.ok ? "#065F46" : "var(--error)", color: "#fff",
          padding: "12px 28px", borderRadius: 12,
          fontSize: 14, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {flash.ok ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          )}
          {flash.msg}
        </div>
      )}

      {/* ── Mentor cards ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mentors.map((mentor) => (
          <div
            key={mentor.id}
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              gap: 16,
              alignItems: "center",
              transition: "box-shadow 0.15s",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
              flexShrink: 0,
              background: mentor.avatar_url ? "var(--line-soft)" : getAvatarGradient(mentor.id),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "#fff",
              border: "2px solid var(--line)",
            }}>
              {mentor.avatar_url ? (
                <Image
                  src={mentor.avatar_url}
                  alt={mentor.name}
                  width={56}
                  height={56}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                mentor.name?.charAt(0) ?? "?"
              )}
            </div>

            {/* Info + controls */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 15 }}>
                  {mentor.name}
                </span>
                {mentor.current_company && (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {mentor.current_company}
                  </span>
                )}
                {mentor.current_role && (
                  <span style={{
                    fontSize: 11, color: "var(--ink-mute)",
                    padding: "1px 8px", borderRadius: 100,
                    background: "var(--line-soft)", border: "1px solid var(--line)",
                  }}>
                    {mentor.current_role}
                  </span>
                )}
                {/* Availability toggle */}
                <button
                  type="button"
                  onClick={() => toggleAvailable(mentor.id, mentor.is_available)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    border: mentor.is_available
                      ? "1px solid #A7F3D0"
                      : "1px solid var(--line)",
                    cursor: saving === mentor.id ? "not-allowed" : "pointer",
                    background: mentor.is_available ? "var(--success-soft)" : "var(--line-soft)",
                    color: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
                    opacity: saving === mentor.id ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {mentor.is_available ? "受付中" : "受付停止"}
                </button>
                {/* Display order badge */}
                {mentor.display_order != null && (
                  <span style={{
                    fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif",
                  }}>
                    #{mentor.display_order}
                  </span>
                )}
              </div>

              {/* Inputs row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Avatar URL input */}
                <input
                  type="text"
                  value={urlInputs[mentor.id] || ""}
                  onChange={(e) => setUrlInputs((prev) => ({ ...prev, [mentor.id]: e.target.value }))}
                  placeholder="写真のURL（https://...）"
                  style={{
                    flex: 1, border: "1.5px solid var(--line)", borderRadius: 8,
                    padding: "7px 12px", fontSize: 12, outline: "none",
                    color: "var(--ink)", fontFamily: "inherit", background: "var(--bg-tint)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.background = "var(--bg-tint)"; }}
                />
                {/* Display order input */}
                <input
                  type="number"
                  value={orderInputs[mentor.id] || ""}
                  onChange={(e) => setOrderInputs((prev) => ({ ...prev, [mentor.id]: e.target.value }))}
                  placeholder="順番"
                  aria-label="表示順"
                  style={{
                    width: 72, border: "1.5px solid var(--line)", borderRadius: 8,
                    padding: "7px 10px", fontSize: 12, outline: "none",
                    color: "var(--ink)", textAlign: "center", fontFamily: "Inter, sans-serif",
                    background: "var(--bg-tint)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--royal)"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.background = "var(--bg-tint)"; }}
                />
                {/* Save button */}
                <button
                  type="button"
                  onClick={() => saveMentor(mentor.id)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: saving === mentor.id ? "var(--ink-mute)" : "var(--success)",
                    color: "#fff", border: "none",
                    cursor: saving === mentor.id ? "not-allowed" : "pointer",
                    flexShrink: 0, transition: "background 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {saving === mentor.id ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      保存中
                    </>
                  ) : "保存"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
