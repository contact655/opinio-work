"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const supabase = createClient();

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
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
      showFlash("保存しました");
    } else {
      showFlash("保存に失敗しました");
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
      showFlash(`${!current ? "受付開始" : "受付停止"}しました`);
    } else {
      showFlash("更新に失敗しました");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 2rem", textAlign: "center" }}>
        <p style={{ color: "#9ca3af" }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>メンター管理</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            写真URL・表示順・受付状況を管理します
          </p>
        </div>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{mentors.length}名</span>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#065F46", color: "#fff", padding: "12px 28px",
          borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {flash}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mentors.map((mentor) => (
          <div key={mentor.id} style={{
            background: "white", border: "1px solid #e5e7eb", borderRadius: 12,
            padding: "16px 20px", display: "flex", gap: 16, alignItems: "center",
          }}>
            {/* Avatar preview */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
              flexShrink: 0, background: "#e1f5ee", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 500, color: "#0f6e56", border: "2px solid #e5e7eb",
            }}>
              {mentor.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mentor.avatar_url} alt={mentor.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                mentor.name?.charAt(0) ?? "?"
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 15 }}>{mentor.name}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{mentor.current_company}</span>
                {/* Availability badge */}
                <button
                  onClick={() => toggleAvailable(mentor.id, mentor.is_available)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    border: "none", cursor: "pointer",
                    background: mentor.is_available ? "#dcfce7" : "var(--error-soft)",
                    color: mentor.is_available ? "#166534" : "#991b1b",
                  }}
                >
                  {mentor.is_available ? "受付中" : "受付停止"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {/* Avatar URL input */}
                <input
                  type="text"
                  value={urlInputs[mentor.id] || ""}
                  onChange={(e) => setUrlInputs((prev) => ({ ...prev, [mentor.id]: e.target.value }))}
                  placeholder="写真のURLを入力..."
                  style={{
                    flex: 1, border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "7px 12px", fontSize: 12, outline: "none", color: "#374151",
                  }}
                />
                {/* Display order input */}
                <input
                  type="number"
                  value={orderInputs[mentor.id] || ""}
                  onChange={(e) => setOrderInputs((prev) => ({ ...prev, [mentor.id]: e.target.value }))}
                  placeholder="表示順"
                  style={{
                    width: 80, border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "7px 10px", fontSize: 12, outline: "none",
                    color: "#374151", textAlign: "center",
                  }}
                />
                <button
                  onClick={() => saveMentor(mentor.id)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: saving === mentor.id ? "#9ca3af" : "#1D9E75",
                    color: "#fff", border: "none", cursor: saving === mentor.id ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {saving === mentor.id ? "..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
