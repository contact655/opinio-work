"use client";

import { useState } from "react";

type Item = {
  companyId: string;
  name: string;
  logoGradient: string | null;
  logoLetter: string | null;
  permission: "admin" | "member";
  isDefault: boolean;
};

export default function SelectCompanyClient({ items }: { items: Item[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  // デフォルト会社を先頭に固定
  const sorted = [
    ...items.filter((i) => i.isDefault),
    ...items.filter((i) => !i.isDefault),
  ];

  async function handleSelect(companyId: string) {
    setLoading(companyId);
    try {
      const res = await fetch("/api/biz/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirectTo;
      } else {
        setLoading(null);
      }
    } catch {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 24, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
          企業アカウントを選択
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 32 }}>
          複数の企業アカウントに所属しています。操作する企業を選択してください。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((item) => (
            <button
              key={item.companyId}
              onClick={() => handleSelect(item.companyId)}
              disabled={loading !== null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                background: item.isDefault ? "var(--royal-50)" : "#fff",
                border: item.isDefault ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                borderRadius: 12,
                cursor: loading !== null ? "not-allowed" : "pointer",
                opacity: loading !== null && loading !== item.companyId ? 0.5 : 1,
                textAlign: "left",
                transition: "border-color 0.15s",
              }}
            >
              {/* Logo avatar */}
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: item.logoGradient ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
              }}>
                {item.logoLetter ?? item.name[0]}
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {item.name}
                  {item.isDefault && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: "var(--accent)",
                      background: "var(--royal-100)",
                      borderRadius: 4, padding: "1px 6px",
                      fontFamily: "'Inter', sans-serif",
                      letterSpacing: "0.04em",
                    }}>
                      DEFAULT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {item.permission === "admin" ? "管理者" : "メンバー"}
                </div>
              </div>
              {/* Spinner or arrow */}
              {loading === item.companyId ? (
                <div style={{ width: 18, height: 18, border: "2px solid var(--royal)", borderTopColor: "transparent", borderRadius: "50%", animation: "sel-spin 0.6s linear infinite", flexShrink: 0 }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: "var(--ink-mute)" }}>
                  <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes sel-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
