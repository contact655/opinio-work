import Link from "next/link";

export function JobseekerFooter() {
  return (
    <footer style={{ background: "var(--ink)", color: "#fff", marginTop: "auto" }}>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "48px 48px 40px",
      }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}
          className="grid grid-cols-2 gap-10 sm:[grid-template-columns:1.6fr_1fr_1fr_1fr]">

          {/* Brand — spans 2 cols on mobile */}
          <div className="col-span-2 sm:col-span-1">
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700, fontSize: 24,
              letterSpacing: "-0.02em", color: "#fff",
              marginBottom: 12,
            }}>
              OPINIO
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.9, maxWidth: 260, marginBottom: 20 }}>
              IT/SaaS業界のキャリアインフラ。<br />
              企業の今を知り、先輩と話し、自分で決める。<br />
              対話から始まる、新しい転職の形。
            </p>
            {/* Trust chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["完全無料", "営業電話なし", "メール登録のみ"].map((t) => (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 11px", borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: 11, fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(5,150,105,0.9)" strokeWidth={3} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* 求職者の方 */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              求職者の方
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { href: "/companies", label: "企業を探す" },
                { href: "/jobs",      label: "求人を探す" },
                { href: "/mentors",   label: "先輩に相談" },
                { href: "/articles",  label: "記事" },
                { href: "/auth",      label: "無料登録" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="footer-link" style={{
                  fontSize: 13, textDecoration: "none",
                }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* 企業の方 */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              企業の方
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { href: "/biz/auth", label: "企業登録" },
                { href: "/business", label: "掲載について" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="footer-link" style={{
                  fontSize: 13, textDecoration: "none",
                }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* 運営 */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              運営
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { href: "/about",        label: "OPINIOについて" },
                { href: "/industries",   label: "対象業界" },
                { href: "/privacy",      label: "プライバシーポリシー" },
                { href: "/terms",        label: "利用規約" },
                { href: "/mentor-terms", label: "メンター向け利用規約" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="footer-link" style={{
                  fontSize: 13, textDecoration: "none",
                }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 48px" }} className="px-5 md:px-12">
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            © 2026 Opinio Inc. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
            Truth to Careers.
          </span>
        </div>
      </div>

      <style>{`
        .footer-link { color: rgba(255,255,255,0.6); }
        .footer-link:hover { color: #fff; }
      `}</style>
    </footer>
  );
}
