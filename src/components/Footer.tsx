"use client";

import Link from "next/link";

const CANDIDATE_LINKS = [
  { href: "/jobs",     label: "求人を探す" },
  { href: "/companies", label: "企業を知る" },
  { href: "/mentors",   label: "メンターに相談" },
  { href: "/articles",  label: "取材記事" },
  { href: "/auth/signup", label: "無料で始める →" },
];

const COMPANY_LINKS = [
  { href: "/biz",           label: "採用担当者の方へ" },
  { href: "/biz/auth",      label: "企業ログイン" },
  { href: "/biz/auth/signup", label: "企業登録（無料）" },
];

const OPINIO_LINKS = [
  { href: "/about",                     label: "OPINIOについて" },
  { href: "/about/scope",               label: "対象業界" },
  { href: "/about/selection-criteria",  label: "掲載企業の審査基準" },
  { href: "/privacy",                   label: "プライバシーポリシー" },
  { href: "/terms",                     label: "利用規約" },
  { href: "/mentor-terms",              label: "メンター向け利用規約" },
];

export default function Footer() {
  return (
    <footer style={{ background: "#0f172a", color: "#fff" }}>

      {/* ── メインフッターグリッド ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 32px 40px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 48,
        }} className="footer-grid">

          {/* ブランド + キャッチコピー */}
          <div>
            <div style={{
              fontSize: 22, fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#fff",
              marginBottom: 12,
            }}>
              OPINIO
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.9, color: "#94a3b8", marginBottom: 24, maxWidth: 280 }}>
              IT/SaaS業界に特化したキャリアプラットフォーム。
              スカウトなし・第三者メンターとの相談・現役社員の声で、
              本当のマッチングを実現します。
            </p>
            {/* CTA */}
            <Link
              href="/auth/signup"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg, var(--royal,#002366), #3B5FD9)",
                color: "#fff",
                padding: "10px 20px", borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(59,95,217,0.4)",
              }}
            >
              無料で始める
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>

            {/* SNSリンク */}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {[
                { href: "https://x.com/opinio_jp", label: "X", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                ) },
                { href: "https://note.com/opinio", label: "note", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                ) },
              ].map(({ href, label, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#94a3b8", textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#94a3b8"; }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* 求職者の方 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              求職者の方
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {CANDIDATE_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8"; }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 企業の方 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              採用担当者の方
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {COMPANY_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8"; }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* OPINIO */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              OPINIO
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {OPINIO_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8"; }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── ボトムバー ── */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <p style={{ fontSize: 12, color: "#475569" }}>
            &copy; {new Date().getFullYear()} Opinio Inc. All rights reserved.
          </p>
          <p style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>
            &ldquo;Truth to Careers&rdquo; — スカウトなし。第三者の目で、本当のキャリアを。
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </footer>
  );
}
