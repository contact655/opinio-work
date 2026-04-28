"use client";

import { useState, useRef, useEffect } from "react";

type Company = {
  id: string;
  name: string;
  isDefault: boolean;
};

type Props = {
  currentCompany: { id: string; name: string; logoGradient?: string | null; logoLetter?: string | null };
  memberships: Company[];
};

export function CompanySwitcher({ currentCompany, memberships }: Props) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // デフォルト会社を先頭に固定
  const sorted = [
    ...memberships.filter((m) => m.isDefault),
    ...memberships.filter((m) => !m.isDefault),
  ];

  async function switchTo(companyId: string) {
    if (companyId === currentCompany.id) { setOpen(false); return; }
    setSwitching(companyId);
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
        setSwitching(null);
      }
    } catch {
      setSwitching(null);
    }
  }

  const logoLetter = currentCompany.logoLetter || currentCompany.name.charAt(0).toUpperCase();
  const logoGradient = currentCompany.logoGradient || "linear-gradient(135deg, #F97316, #EA580C)";

  // 1 社のみ: ドロップダウンなし
  if (memberships.length <= 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 20, borderLeft: "1px solid var(--line)" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: logoGradient, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {logoLetter}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {currentCompany.name}
        </span>
      </div>
    );
  }

  // 複数社: Notion 風ドロップダウン
  return (
    <div ref={ref} style={{ position: "relative", paddingLeft: 20, borderLeft: "1px solid var(--line)" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", cursor: "pointer",
          padding: "4px 6px 4px 0", borderRadius: 6,
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: logoGradient, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {logoLetter}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentCompany.name}
        </span>
        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--ink-mute)", flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", left: 0, top: 40,
            minWidth: 240, maxWidth: 320,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            overflow: "hidden", zIndex: 300,
          }}
        >
          {/* 会社一覧 */}
          <div style={{ padding: "6px 0" }}>
            {sorted.map((m) => {
              const isCurrent = m.id === currentCompany.id;
              const isLoading = switching === m.id;
              return (
                <button
                  key={m.id}
                  role="menuitem"
                  onClick={() => switchTo(m.id)}
                  disabled={switching !== null}
                  style={{
                    width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 14px",
                    background: isCurrent ? "var(--royal-50)" : "transparent",
                    border: "none", cursor: switching !== null ? "not-allowed" : "pointer",
                    opacity: switching !== null && !isLoading ? 0.5 : 1,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "var(--bg-tint)"; }}
                  onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Checkmark or spacer */}
                  <span style={{ width: 16, flexShrink: 0, color: "var(--royal)" }}>
                    {isCurrent && !isLoading && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {isLoading && (
                      <div style={{ width: 12, height: 12, border: "1.5px solid var(--royal)", borderTopColor: "transparent", borderRadius: "50%", animation: "biz-spin 0.6s linear infinite" }} />
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {m.isDefault && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent)" style={{ flexShrink: 0 }}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                    <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {m.name}
                    </span>
                  </span>
                  {/* Default badge */}
                  {m.isDefault && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "var(--accent)",
                      background: "var(--royal-100)", borderRadius: 4,
                      padding: "1px 6px", flexShrink: 0,
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      デフォルト
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 区切り */}
          <div style={{ height: 1, background: "var(--line-soft)", margin: "0" }} />

          {/* フッターアクション */}
          <div style={{ padding: "6px 0" }}>
            <a
              href="/biz/companies/add"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px",
                fontSize: 13, color: "var(--ink-soft)", textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              別の会社に参加
            </a>
            <a
              href="/biz/company"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px",
                fontSize: 13, color: "var(--ink-soft)", textDecoration: "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4.5 6.5h4M8.5 4.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              企業情報を設定
            </a>
          </div>
        </div>
      )}

      <style>{`@keyframes biz-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
