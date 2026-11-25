import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { primaryBusinessDomain } from "@/types/genre";
import { formatEmployeeSize } from "@/lib/constants/employeeBand";
import type { Company } from "@/app/companies/mockCompanies";

/**
 * 会社の小さいカード（2026-11-26。求人ページのサイドバー「会社概要」で使う）。
 * ロゴ・会社名・事業領域・従業員数・紹介文（3行まで）・会社ページへのリンク。
 *
 * ⚠️ 値が無い項目は出さない。紹介文が無ければ段落ごと出さない。
 * ⚠️ `href` が null（会社ページが開けない）なら会社名もリンクにせず、「会社ページを見る」も出さない。
 * ⚠️ 企業ページの縦長の表（CompanyInfoBox）とは別物。こちらは要約だけを持つ。項目を足すときは表のほうに足す。
 */
export function CompanyMiniCard({ company, href }: { company: Company; href: string | null }) {
  const domain = primaryBusinessDomain(company.business_domains)?.name ?? null;
  const size = formatEmployeeSize(company.employee_count_band, company.employee_count_as_of);
  const meta = [domain, size].filter(Boolean).join(" ・ ");
  const about = company.about?.trim() || null;

  return (
    <div data-state="company-mini-card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <CompanyLogo
          name={company.name}
          logoUrl={company.logo_url}
          logoLetter={company.logo_letter}
          logoGradient={company.gradient}
          size={44}
          borderRadius={10}
        />
        <div style={{ minWidth: 0 }}>
          {href ? (
            <Link href={href} style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflowWrap: "anywhere" }}>
              {company.name}
            </Link>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{company.name}</span>
          )}
          {meta && <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>{meta}</div>}
        </div>
      </div>
      {about && (
        <p style={{
          margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.8, color: "var(--ink-soft)",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        } as React.CSSProperties}>
          {about}
        </p>
      )}
      {href && (
        <Link href={href} style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
          会社ページを見る →
        </Link>
      )}
    </div>
  );
}
