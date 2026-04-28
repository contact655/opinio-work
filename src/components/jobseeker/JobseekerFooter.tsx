import Link from "next/link";

export function JobseekerFooter() {
  return (
    <footer style={{
      background: "var(--ink)",
      color: "#fff",
      padding: "56px 48px 32px",
      marginTop: "auto",
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
        gap: 40,
        marginBottom: 40,
      }}>
        {/* Brand */}
        <div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: "#fff",
            marginBottom: 10,
          }}>
            Opinio
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            Truth to Careers<br />
            キャリアに、第三者の目を。
          </div>
        </div>

        {/* 求職者の方 */}
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            求職者の方
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { href: "/companies", label: "企業を探す" },
              { href: "/jobs", label: "求人を探す" },
              { href: "/mentors", label: "先輩に相談" },
              { href: "/articles", label: "記事" },
              { href: "/auth", label: "無料登録" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* 企業の方 */}
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            企業の方
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { href: "/biz/auth", label: "企業登録" },
              { href: "/for-companies", label: "掲載について" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* 運営 */}
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            運営
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { href: "/about", label: "Opinioについて" },
              { href: "/industries", label: "対象業界" },
              { href: "/privacy", label: "プライバシーポリシー" },
              { href: "/terms", label: "利用規約" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        paddingTop: 24,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        color: "rgba(255,255,255,0.3)",
      }}>
        © 2026 Opinio Inc. All rights reserved.
      </div>
    </footer>
  );
}
