/**
 * Fix 21: Company social links section
 * Supports BOTH formats for backward compatibility:
 *   New (array): [{"type": "twitter", "url": "...", "label": "公式Twitter"}]
 *   Legacy (obj): {"twitter": "...", "note": "..."}
 */

type LinkItem = { type: string; url: string; label?: string };

const ICON_MAP: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  twitter: {
    label: "公式Twitter",
    color: "#0f172a",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  x: {
    label: "公式X",
    color: "#0f172a",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  note: {
    label: "note",
    color: "#41c9b4",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    color: "#ff0000",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  blog: {
    label: "採用ブログ",
    color: "#1D9E75",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  wantedly: {
    label: "Wantedly",
    color: "#00a4bb",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="19" cy="5" r="3" />
        <path d="M1 7h3.5l3.5 10h.2l3.3-10H15l3.3 10h.2l2-6.5h3L19 18h-3l-3.2-9.5h-.2L9.5 18h-3z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
      </svg>
    ),
  },
};

function normalizeLinks(raw: unknown): LinkItem[] {
  if (!raw) return [];
  // Array format (new)
  if (Array.isArray(raw)) {
    return raw
      .filter((x: any) => x && typeof x === "object" && x.url && typeof x.url === "string")
      .map((x: any) => ({ type: String(x.type || "link"), url: x.url, label: x.label }));
  }
  // Object format (legacy)
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, any>)
      .filter(([, v]) => typeof v === "string" && v)
      .map(([type, url]) => ({ type, url: url as string }));
  }
  return [];
}

export function CompanyLinks({ socialLinks, companyName }: { socialLinks: unknown; companyName?: string }) {
  const links = normalizeLinks(socialLinks);
  if (links.length === 0) return null;

  return (
    <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
        📢 {companyName ? `${companyName}の発信` : "この企業の発信"}
      </h2>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px 0" }}>
        公式SNS・採用ブログ・記事から、企業のリアルを知ることができます。
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {links.map((link, i) => {
          const def = ICON_MAP[link.type] || { label: link.type, color: "#374151", icon: null };
          const displayLabel = link.label || def.label;
          return (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 10,
                border: "0.5px solid #e5e7eb",
                background: "#fff",
                fontSize: 13,
                fontWeight: 500,
                color: def.color,
                textDecoration: "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = def.color; e.currentTarget.style.background = "#fafafa"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fff"; }}
            >
              {def.icon}
              {displayLabel}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M7 7h10v10" />
                <path d="M7 17 17 7" />
              </svg>
            </a>
          );
        })}
      </div>
    </section>
  );
}
