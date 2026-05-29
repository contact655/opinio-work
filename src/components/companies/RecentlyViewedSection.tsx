"use client";
import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";

/** 縦並び固定幅カード（右サイドバー用） */
export function RecentlyViewedSection() {
  const { items, clearItems } = useRecentlyViewed();
  const companies = items.filter((i) => i.type === "company");
  if (companies.length === 0) return null;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "14px 14px 10px",
      width: "100%",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.02em" }}>最近見た企業</span>
        <button
          type="button"
          onClick={clearItems}
          style={{ fontSize: 11, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          クリア
        </button>
      </div>

      {/* Vertical list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {companies.map((c) => (
          <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 8px", borderRadius: 8,
              border: "1px solid var(--line)",
              background: "#fff",
              transition: "border-color 0.15s, background 0.15s",
            }}
              className="recently-viewed-item"
            >
              {/* Logo */}
              <div style={{
                width: 26, height: 26, borderRadius: 5, overflow: "hidden",
                flexShrink: 0,
                background: c.gradient || "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {c.logoUrl ? (
                  <Image src={c.logoUrl} alt={c.name} width={26} height={26} style={{ objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>{c.logoLetter ?? c.name[0]}</span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .recently-viewed-item:hover {
          border-color: var(--royal-100) !important;
          background: var(--royal-50) !important;
        }
      `}</style>
    </div>
  );
}
