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
  const [error, setError] = useState<string | null>(null);

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
        setError("企業の切り替えに失敗しました。再度お試しください。");
        setTimeout(() => setError(null), 4000);
      }
    } catch {
      setLoading(null);
      setError("ネットワークエラーが発生しました。再度お試しください。");
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
          企業アカウントを選択
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 32 }}>
          複数の企業アカウントに所属しています。操作する企業を選択してください。
        </p>
        {error && (
          <div role="alert" aria-live="polite" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", marginBottom: 16, borderRadius: 8,
            background: "var(--error-soft)", border: "1px solid #FCA5A5",
            fontSize: 13, color: "var(--error)", fontWeight: 600,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="エラーを閉じる" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--error)", fontSize: 16, padding: "0 4px",
            }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((item) => (
            <button
              type="button"
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
