"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const supabase = createClient();

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }, []);

  useEffect(() => {
    supabase
      .from("mentors")
      .select("id, name, current_company, current_role, avatar_url, display_order")
      .order("display_order")
      .then(({ data }) => {
        if (data) {
          setMentors(data);
          const inputs: Record<string, string> = {};
          data.forEach((m: any) => {
            inputs[m.id] = m.avatar_url || "";
          });
          setUrlInputs(inputs);
        }
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAvatarUrl = async (mentorId: string) => {
    const url = urlInputs[mentorId]?.trim() || null;
    setSaving(mentorId);
    const { error } = await supabase
      .from("mentors")
      .update({ avatar_url: url })
      .eq("id", mentorId);
    setSaving(null);

    if (!error) {
      setMentors((prev) =>
        prev.map((m) => (m.id === mentorId ? { ...m, avatar_url: url } : m))
      );
      showFlash("保存しました");
    } else {
      showFlash("保存に失敗しました");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, mentorId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveAvatarUrl(mentorId);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 2rem", textAlign: "center" }}>
        <p style={{ color: "#9ca3af" }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
        メンター写真管理
      </h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        各メンターの写真URLを入力してEnterまたは「保存」をクリックしてください。
      </p>

      {/* Flash message */}
      {flash && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#065F46",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {flash}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mentors.map((mentor) => (
          <div
            key={mentor.id}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            {/* Avatar preview */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "#e1f5ee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 500,
                color: "#0f6e56",
                border: "2px solid #e5e7eb",
              }}
            >
              {mentor.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mentor.avatar_url}
                  alt={mentor.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                mentor.name?.charAt(0) ?? "?"
              )}
            </div>

            {/* Info + URL input */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <p style={{ fontWeight: 600, margin: 0, color: "#111827", fontSize: 15 }}>
                  {mentor.name}
                </p>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {mentor.current_company}
                </span>
                {mentor.avatar_url && (
                  <span style={{ fontSize: 10, color: "#059669", fontWeight: 500, background: "#E1F5EE", padding: "2px 6px", borderRadius: 999 }}>
                    設定済み
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={urlInputs[mentor.id] || ""}
                  onChange={(e) =>
                    setUrlInputs((prev) => ({ ...prev, [mentor.id]: e.target.value }))
                  }
                  onKeyDown={(e) => handleKeyDown(e, mentor.id)}
                  placeholder="写真のURLを入力..."
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    color: "#374151",
                  }}
                />
                <button
                  onClick={() => saveAvatarUrl(mentor.id)}
                  disabled={saving === mentor.id}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: saving === mentor.id ? "#9ca3af" : "#1D9E75",
                    color: "#fff",
                    border: "none",
                    cursor: saving === mentor.id ? "not-allowed" : "pointer",
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
