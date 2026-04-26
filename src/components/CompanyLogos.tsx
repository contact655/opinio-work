/**
 * Fix 8 (a): Company logos social-proof section.
 * Pulls company names + Clearbit/website logos from props (server-rendered),
 * falls back to a curated default list when DB returns nothing.
 */

import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";

type LogoCompany = {
  name: string;
  logo_url?: string | null;
  url?: string | null;
  website_url?: string | null;
};

const FALLBACK_COMPANIES: LogoCompany[] = [
  { name: "Sansan", website_url: "sansan.com" },
  { name: "SmartHR", website_url: "smarthr.co.jp" },
  { name: "マネーフォワード", website_url: "moneyforward.com" },
  { name: "Ubie", website_url: "ubie.life" },
  { name: "LayerX", website_url: "layerx.co.jp" },
  { name: "Salesforce Japan", website_url: "salesforce.com" },
  { name: "Google Japan", website_url: "google.com" },
  { name: "PKSHA Technology", website_url: "pkshatech.com" },
  { name: "Datadog", website_url: "datadoghq.com" },
  { name: "HubSpot", website_url: "hubspot.com" },
];

export function CompanyLogosSection({ companies }: { companies?: LogoCompany[] | null }) {
  const list = (companies && companies.length > 0 ? companies : FALLBACK_COMPANIES).slice(0, 12);
  // duplicate for marquee
  const looped = [...list, ...list];

  return (
    <section style={{ background: "#fff", paddingTop: 28, paddingBottom: 28, borderTop: "0.5px solid #f0f0f0", borderBottom: "0.5px solid #f0f0f0" }}>
      <div className="max-w-5xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 16, letterSpacing: "0.05em" }}>
          IT/SaaS業界の主要企業を掲載
        </p>
      </div>
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* Fade edges */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 60, background: "linear-gradient(to right, #fff, transparent)", zIndex: 2 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 60, background: "linear-gradient(to left, #fff, transparent)", zIndex: 2 }} />
        <div className="logo-marquee" style={{ display: "flex", gap: 40, alignItems: "center", width: "max-content", animation: "marquee 30s linear infinite" }}>
          {looped.map((c, i) => {
            const src = getCompanyLogoUrl({
              logo_url: c.logo_url,
              website_url: c.website_url,
              url: c.url,
            });
            if (!src) {
              return (
                <div
                  key={`${c.name}-${i}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minWidth: 100, height: 36, padding: "0 12px",
                    fontSize: 13, fontWeight: 600, color: "#6b7280",
                    flexShrink: 0,
                  }}
                >
                  {c.name}
                </div>
              );
            }
            return (
              <div
                key={`${c.name}-${i}`}
                style={{ display: "flex", alignItems: "center", height: 40, flexShrink: 0 }}
                title={c.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={c.name}
                  style={{
                    maxHeight: 40,
                    maxWidth: 120,
                    objectFit: "contain",
                    filter: "grayscale(100%)",
                    opacity: 0.65,
                    transition: "all .2s",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .logo-marquee:hover { animation-play-state: paused; }
      `}</style>
    </section>
  );
}
