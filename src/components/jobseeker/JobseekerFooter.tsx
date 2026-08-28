import Link from "next/link";
import { getBusinessDomainFacets } from "@/lib/companies/businessDomainsCached";

/* ⚠️ **サーバーコンポーネント。** 事業領域の一覧を自分で引く。
      全ページに出るので `getBusinessDomainFacets()` は unstable_cache 済み（300s）。
      素で引くと1ページ表示ごとに1クエリ増える。 */
export async function JobseekerFooter() {
  const industryFacets = await getBusinessDomainFacets();
  return (
    <footer role="contentinfo" style={{ background: "var(--ink)", color: "#fff", marginTop: "auto" }}>

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
              fontFamily: "var(--font-inter), sans-serif",
              fontWeight: 700, fontSize: 24,
              letterSpacing: "-0.02em", color: "#fff",
              marginBottom: 12,
            }}>
              OPINIO
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.9, maxWidth: 260, marginBottom: 20 }}>
              IT/SaaS業界の企業と求人を探せるプラットフォーム。<br />
              企業情報と求人が、ここに揃っています。
            </p>
          </div>

          {/* 求職者の方 */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              求職者の方
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                // /people（先輩を知る）は Career Agent へ移設する導線で 307 を返すため削除。
                // /careers（転職ガイド）は中身がカジュアル面談前提で現方針と食い違うため削除（書き直しは別途）。
                // /salary（年収相場）は年収データを増やす予定が無く、育たない導線なので削除。
                { href: "/companies", label: "企業を探す" },
                { href: "/jobs",      label: "募集を探す" },
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
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              企業の方
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { href: "/biz/auth",  label: "企業登録" },
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
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>
              運営
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { href: "/contact",      label: "お問い合わせ" },
                { href: "/terms",          label: "利用規約" },
                { href: "/terms/listing", label: "掲載利用規約" },
                { href: "/terms/placement", label: "人材紹介利用規約" },
                { href: "/privacy",        label: "プライバシーポリシー" },
                { href: "/legal/agency",   label: "職業安定法に基づく明示事項" },
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

      {/* ── 事業領域ディレクトリ ────────────────────────────────────────────────
          在庫が増えたときにトップページが担うのは「カテゴリページへのハブ」。
          その器を先に置いている。
          ⚠️ URL は LP のチップと同じ形式（/companies?industry=<事業領域のslug>）。
             片方だけ変えると同じ場所への入口が2種類できるので、必ず揃えること。
          ⚠️ 職種軸・勤務地軸はまだ足さない。公開求人18件中17件が営業に偏っており、
             いま職種で切ると薄さが露出する（2026-08-05 判断）。 */}
      {/* ⚠️ 取得できなかった／0件のときは**見出しごと出さない。**
             空の見出しだけが残ると「リンクが消えた」ように見える。 */}
      {industryFacets.length > 0 && (
      <div style={{ padding: "0 48px 28px" }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
            事業領域から探す
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
            {industryFacets.map((d) => (
              <Link key={d.slug} href={`/companies?industry=${d.slug}`} className="footer-link" style={{ fontSize: 13, textDecoration: "none" }}>
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 48px" }} className="px-5 md:px-12">
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12,
        }}>
          {/*
            2026-08-03: alpha 0.18〜0.25 は --ink 上で 1.74〜2.25:1 しかなく WCAG AA (4.5:1) 割れだった。
            0.5〜0.55 に引き上げて AA 通過（約5.2〜5.6:1）。これ以上薄くしないこと。
          */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>
              © 2026 Opinio Inc. All rights reserved.
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>
              Opinio Inc. · 〒107-0052 東京都港区赤坂2-21-4
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>
            IT/SaaS業界特化のキャリアプラットフォーム
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
