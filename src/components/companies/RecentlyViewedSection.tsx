"use client";
import { useEffect, useState } from "react";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";
import { CompanyCardHoverWrap } from "./CompanyCardHoverWrap";
import type { CompanyForCarousel } from "@/types/genre";
import type { MemberPreview } from "./CompanyCardCompact";

export function RecentlyViewedSection() {
  const { items, clearItems } = useRecentlyViewed();
  const companyItems = items.filter((i) => i.type === "company");

  const [companies, setCompanies] = useState<CompanyForCarousel[]>([]);
  const [membersByCompany, setMembersByCompany] = useState<Record<string, MemberPreview[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (companyItems.length === 0) { setLoaded(true); return; }
    const ids = companyItems.map((c) => c.id).join(",");
    fetch(`/api/companies/batch?ids=${ids}`)
      .then((r) => r.json())
      .then(({ companies: data, membersByCompany: members }) => {
        setCompanies(data ?? []);
        setMembersByCompany(members ?? {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  if (!loaded || companyItems.length === 0 || companies.length === 0) return null;

  return (
    <div style={{ padding: "20px 24px", background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>最近見た企業</span>
        <button
          type="button"
          onClick={clearItems}
          style={{ fontSize: 11.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          クリア
        </button>
      </div>

      {/* Same card grid as main grid */}
      <div className="recently-viewed-grid">
        {companies.map((c) => (
          <CompanyCardHoverWrap
            key={c.id}
            company={c}
            members={membersByCompany[c.id] ?? []}
          />
        ))}
      </div>

      <style>{`
        .recently-viewed-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        @media (max-width: 1279px) {
          .recently-viewed-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 1023px) {
          .recently-viewed-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 639px) {
          .recently-viewed-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
