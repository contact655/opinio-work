import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { NEW_COMPANIES_CSS } from "@/components/feed/NewCompaniesCarousel";
import { FollowButton as CompanyFollowButton } from "@/app/(jobseeker)/companies/[id]/CompanyDetailClient";
import { chipStyle } from "@/lib/utils/chipVariant";
import type { Destinations } from "@/lib/search/runSearch";

/**
 * ⚠️ 検索結果（/search。学校で引いたときだけ）と学校のページ（/schools/[id]）の両方が使う。見た目を片方だけ変えないこと。
 * ⚠️ 会社で引いたときは使わない（2026-10-27）。会社を出た人の行き先は「人の流れ」と同じ規則（業界の大分類・3人以上）で、
 *    検索のページの CompanyLeaversBlock が出す
 * ★「この会社を出た人のいま」（2026-10-21 / 柴さんの指示。OPINIO らしさ＝実際に移った先が見える）。
 *   OB・OG のいまの会社と職種を並べる。人数は3人以上のときだけ（runSearch の Destinations）。
 * ⚠️ ログインしているときだけ（人の欄と同じ）。会社名を出してよい職歴だけを数えている
 */
export function DestinationsBlock({ d, companyLabel }: { d: Destinations; companyLabel: string | null }) {
  const chip = chipStyle("neutral");
  const Row = ({ title, list }: { title: string; list: { label: string; count: number | null }[] }) =>
    list.length === 0 ? null : (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>{title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {list.map((x) => (
            <span key={x.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {x.label}
              {x.count !== null && <span style={{ fontWeight: 700, color: "var(--ink-soft)" }}>{x.count}人</span>}
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <div data-state="search-destinations" style={{ marginTop: 16, padding: "14px 14px 12px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
        {companyLabel ? `${companyLabel}を出た人の、いま` : "この会社を出た人の、いま"}
      </div>
      {/* ★転職先はホームの「新しく掲載された企業」と同じカードで横に並べる（2026-10-21 / 柴さんの指示）。
             ⚠️ フォローは会社ページが開ける会社だけ（id が null の会社は出さない） */}
      {d.companies.length > 0 && (
        <div style={{ marginTop: 10, marginLeft: -14, marginRight: -14 }}>
          <style>{NEW_COMPANIES_CSS}</style>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", margin: "0 14px 6px" }}>転職先</div>
          <div className="ncc-row" style={{ paddingLeft: 14, paddingRight: 14, scrollPaddingInline: 14 }}>
            {d.companies.map((x) => {
              const head = (
                <>
                  <CompanyLogo logoUrl={x.logoUrl} name={x.label} logoLetter={x.logoLetter} logoGradient={x.logoGradient} size={56} />
                  <span className="ncc-name">{x.label}</span>
                </>
              );
              return (
                <div key={x.label} className="ncc-card" data-state={x.href ? "destination-company-link" : "destination-company"}>
                  {x.href ? <Link href={x.href} className="ncc-link">{head}</Link> : <span className="ncc-link">{head}</span>}
                  <span className="ncc-domain">{[x.domain, x.count !== null ? `${x.count}人` : null].filter(Boolean).join(" ・ ")}</span>
                  {x.id && <div className="ncc-act"><CompanyFollowButton companyId={x.id} tone="primary" /></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Row title="いまの職種" list={d.roles} />
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--ink-mute)" }}>人数は3人以上のときだけ表示しています。</p>
    </div>
  );
}
