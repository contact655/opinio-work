import Link from "next/link";
import React from "react";

export function Footer() {
  return (
    <footer
      className="px-5 pt-12 pb-8 md:px-12 md:pt-[72px]"
      style={{ background: "#001A4D", color: "#fff" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Grid: 1 col mobile → 2fr 1fr 1fr 1fr desktop */}
        <div className="grid grid-cols-1 gap-8 mb-12 md:[grid-template-columns:2fr_1fr_1fr_1fr] md:gap-12">
          {/* Brand */}
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, marginBottom: 12 }}>
              Opinio
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.9 }}>
              Truth to Careers
              <br />
              キャリアに、第三者の目を。
            </div>
          </div>

          {/* 求職者の方 */}
          <FooterCol title="求職者の方">
            <FooterLink href="/companies">企業を探す</FooterLink>
            <FooterLink href="/jobs">求人を探す</FooterLink>
            <FooterLink href="/career-consultation">先輩に相談</FooterLink>
            <FooterLink href="/articles">記事</FooterLink>
            <FooterLink href="/auth">無料登録</FooterLink>
          </FooterCol>

          {/* 企業の方 */}
          <FooterCol title="企業の方">
            <FooterLink href="/for-companies">企業登録</FooterLink>
            <FooterLink href="/for-companies#plans">掲載について</FooterLink>
          </FooterCol>

          {/* 運営 */}
          <FooterCol title="運営">
            <FooterLink href="/about">Opinioについて</FooterLink>
            <FooterLink href="/about/scope">対象業界</FooterLink>
            <FooterLink href="/privacy">プライバシーポリシー</FooterLink>
            <FooterLink href="/terms">利用規約</FooterLink>
          </FooterCol>
        </div>

        {/* Bottom */}
        <div
          style={{
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: 12,
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} Opinio Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, opacity: 0.9 }}>{title}</h4>
      {children}
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ display: "block", color: "#fff", opacity: 0.7, fontSize: 13, padding: "6px 0", textDecoration: "none" }}
    >
      {children}
    </Link>
  );
}
