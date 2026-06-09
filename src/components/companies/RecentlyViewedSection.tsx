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
    <div style={{ padding: "20px 24px", background: "#fff", borderRadius: 14, border: "1px solid var(--line)" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>最近見た企業</span>
        <button
          type="button"
          onClick={clearItems}
          style={{ fontSize: 11.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          クリア
        </button>
      </div>

      {/* 横スクロールカルーセル */}
      <div className="recently-viewed-scroll-wrap">
        <div className="recently-viewed-row">
          {companies.map((c) => (
            <div key={c.id} className="recently-viewed-item">
              <CompanyCardHoverWrap
                company={c}
                members={membersByCompany[c.id] ?? []}
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .recently-viewed-scroll-wrap {
          position: relative;
          margin: 0 -24px;
          padding: 0 24px;
          overflow: hidden;
        }
        .recently-viewed-row {
          display: flex;
          flex-direction: row;
          gap: 14px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
          /* スクロールバーを非表示 */
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .recently-viewed-row::-webkit-scrollbar {
          display: none;
        }
        .recently-viewed-item {
          flex: 0 0 220px;
          scroll-snap-align: start;
        }
        @media (max-width: 767px) {
          .recently-viewed-item { flex: 0 0 180px; }
        }
      `}</style>
    </div>
  );
}
