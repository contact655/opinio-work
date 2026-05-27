"use client";
import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";

export function RecentlyViewedSection() {
  const { items, clearItems } = useRecentlyViewed();
  const companies = items.filter((i) => i.type === "company");
  if (companies.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>最近見た企業</span>
        <button type="button" onClick={clearItems} style={{ fontSize: 11.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          クリア
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {companies.map((c) => (
          <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 10,
              background: "#fff", border: "1px solid var(--line)",
              transition: "border-color 0.15s",
            }}>
              {/* ロゴ */}
              <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: c.gradient || "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.logoUrl ? (
                  <Image src={c.logoUrl} alt={c.name} width={28} height={28} style={{ objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>{c.logoLetter ?? c.name[0]}</span>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{c.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
