"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  companyId: string;
  name: string;
  logoGradient: string | null;
  logoLetter: string | null;
  permission: "admin" | "member";
  isDefault: boolean;
};

export default function SelectCompanyClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(companyId: string) {
    setLoading(companyId);
    try {
      const res = await fetch("/api/biz/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error("switch failed");
      router.push("/biz/dashboard");
    } catch {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
          企業アカウントを選択
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 32 }}>
          複数の企業アカウントに所属しています。操作する企業を選択してください。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <button
              key={item.companyId}
              onClick={() => handleSelect(item.companyId)}
              disabled={loading !== null}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                background: "#fff",
                border: "1.5px solid var(--line)",
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
                <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 15, marginBottom: 2 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {item.permission === "admin" ? "管理者" : "メンバー"}
                  {item.isDefault && " · デフォルト"}
                </div>
              </div>
              {/* Spinner or arrow */}
              {loading === item.companyId ? (
                <div style={{ width: 18, height: 18, border: "2px solid var(--royal)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: "var(--ink-mute)" }}>
                  <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
