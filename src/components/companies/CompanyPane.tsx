import Link from "next/link";
import type { Company } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import type { CompanyTargetIndustry } from "@/types/genre";
import { primaryBusinessDomain } from "@/types/genre";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { CompanyInfoBox } from "@/components/companies/CompanyInfoBox";
import { companyDisplayName } from "@/lib/companies/displayName";
import { formatEmployeeCountBand } from "@/lib/utils/employeeCount";
import { MEETING_CTA_BG, MEETING_CTA_FG } from "@/lib/constants/meetingCta";

/**
 * 企業の**要約ビュー**。一覧の隣（分割ビューの右ペイン）に置くことを想定した部品。
 *
 * ── ⚠️★なぜ詳細ページを使い回さないか（2026-09-08）────────────────────────────
 * `companies/[id]/page.tsx`（2,134行）を狭いコンテナに入れると壊れる。実測（本番 /
 * ビューポート1440px のまま外側を 700px に固定して計測）:
 *
 *   ・**サイドバーが 320px のまま残り、本文が 256px に潰れる**
 *     （`hidden lg:flex` は**ビューポート**を見るので、コンテナが狭くても消えない）
 *   ・**製品グリッドが5列を維持して各 115px になる**
 *     （`@media (min-width: 900px)` も同じくビューポート基準。設計は 183px 前提）
 *   ・はみ出し／内部クリップが **49件**（サイドバーを消して1列にしても14件残る）
 *   ・`ReadingProgress`（`position:fixed` 幅1440px）と `BackToTop` が**ペインの外**に出る
 *
 * ⚠️ **これは「詳細ページが雑だから」ではない。** ビューポートで見ている限り正しく動く。
 *    実測（本番 2026-09-08）: **375 / 768 / 1023px のいずれもはみ出し 0件**。
 *    壊れるのは「ビューポートは広いのに要素は狭い」という**分割ビュー特有の状況だけ**。
 *    → 詳細ページ側を直すのではなく、**ペイン用の別ビューを用意する**ことにした。
 *
 * ── ⚠️★この部品で守ること ────────────────────────────────────────────────
 * 1. **ビューポート基準のメディアクエリを書かない**（`@media` も `md:` / `lg:` も）。
 *    幅はコンテナで決まるので、`flex-wrap` と `minmax(0, 1fr)` と `minWidth: 0` で組む。
 * 2. **`position: fixed` / `sticky` を置かない。** どちらもペインの外にはみ出す。
 * 3. **`window.scrollTo` / ビューポート基準の `IntersectionObserver` を持ち込まない。**
 *    詳細ページの `CompanyStickyNav` がまさにそれで、ペインでは動かない。
 * 4. **データを取りに行かない（presentational）。** 呼び出し側が渡す。
 *    `/dev/preview` から固定データで見られるようにするため（CLAUDE.md「preview 配下で
 *    DB を読まない」）。
 *
 * ⚠️ 深く読みたい人向けの導線（「詳細を見る」）を**必ず残すこと**。ここは要約であって
 *    詳細の置き換えではない。出していない項目（製品・導入事例・社員・記事・更新情報・
 *    福利厚生・組織体制・ツール）は詳細ページにしかない。
 */
export function CompanyPane({
  company,
  detail,
  targetIndustries = [],
  /** 「詳細を見る」の遷移先。省略時は slug（無ければ id）から組む */
  href,
}: {
  company: Company;
  detail: CompanyDetail;
  targetIndustries?: CompanyTargetIndustry[];
  href?: string;
}) {
  const { displayName, isEnName } = companyDisplayName(company.name, company.name_en);
  const showSubtitle = displayName !== company.name;
  const detailHref = href ?? `/companies/${company.slug ?? company.id}`;

  /* ⚠️ 主の事業領域を1件だけ。**カードと同じ規則**（`CompanyCardList` の cardDomain）。
        複数出すと狭いペインで行が破綻する。 */
  const domain = primaryBusinessDomain(company.business_domains);

  /* 募集中の求人。⚠️ **上位3件だけ**。ペインは要約なので、全件は詳細ページに任せる。
     ⚠️ `detail.jobs` はカテゴリの配列なので平坦化してから数える。 */
  const jobs = (detail.jobs ?? []).flatMap((c) => c.items ?? []);
  const topJobs = jobs.slice(0, 3);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        /* ⚠️ 幅を指定しない。**置かれたコンテナに従う**のがこの部品の前提。 */
        minWidth: 0,
      }}
    >
      {/* ── ヘッダー（ロゴ・社名・タグライン・タグ） ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "var(--space-6)", minWidth: 0,
      }}>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", minWidth: 0 }}>
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.gradient}
            size={56}
            borderRadius={12}
            style={{ border: "1px solid #eef0f3", flexShrink: 0 }}
          />
          {/* ⚠️ `minWidth: 0` を外さないこと。長い社名が親を押し広げる
                 （ui-debugging「flex: 1 の item に min-width: 0 が無い」）。 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3,
              fontFamily: "var(--font-inter), var(--font-noto)",
              letterSpacing: isEnName ? "-0.02em" : "0",
              overflowWrap: "anywhere",
            }}>{displayName}</h2>
            {showSubtitle && (
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2, overflowWrap: "anywhere" }}>
                {company.name}
              </div>
            )}
          </div>
        </div>

        {/* タグライン。⚠️ ペインでは省略しない（カードと違い縦に伸ばせる） */}
        {company.tagline && (
          <p style={{
            margin: "var(--space-4) 0 0", fontSize: 14, lineHeight: 1.75,
            color: "var(--ink-soft)", overflowWrap: "anywhere",
          }}>{company.tagline}</p>
        )}

        {/* バッジ行。⚠️ `flexWrap: wrap` で幅に追随させる（メディアクエリを使わない） */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-4)" }}>
          {domain?.name && (
            <span style={{
              fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-tint)",
              border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-sm)",
              whiteSpace: "nowrap",
            }}>{domain.name}</span>
          )}
          {/* ⚠️ 値が無い項目は要素ごと出さない（「—」や「0名」で埋めない） */}
          {company.employee_count && (
            <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              {formatEmployeeCountBand(company.employee_count)}
            </span>
          )}
          {company.job_count > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
              background: "var(--royal)", color: "#fff", whiteSpace: "nowrap",
            }}>募集中 {company.job_count}件</span>
          )}
        </div>
      </div>

      {/* ── 企業情報。⚠️ サイドバー／モバイル本文と**同じ部品**を使う ──
             メディアクエリを持たず `minmax` と `minWidth: 0` で組まれているので、
             ペインの幅でもそのまま動く（2026-09-08 に確認）。 */}
      <CompanyInfoBox company={company} detail={detail} targetIndustries={targetIndustries} />

      {/* ── 募集中の求人（上位3件） ── */}
      {topJobs.length > 0 && (
        <div style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
          padding: "var(--space-6)", minWidth: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: "var(--space-3)" }}>
            募集中の求人
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topJobs.map((j, i) => (
              <Link
                key={j.id ?? `${j.title}-${i}`}
                href={`/jobs/${j.slug ?? j.id ?? ""}`}
                style={{
                  display: "block", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--line)", background: "var(--bg-tint)",
                  textDecoration: "none", color: "var(--ink)", fontSize: 13,
                  fontWeight: 600, lineHeight: 1.5, overflowWrap: "anywhere",
                }}
              >
                {j.title}
              </Link>
            ))}
          </div>
          {/* ⚠️ 3件を超える場合だけ「残り」を出す。0件のときはこのブロックごと出ない */}
          {jobs.length > topJobs.length && (
            <div style={{ marginTop: "var(--space-3)", fontSize: 12, color: "var(--ink-mute)" }}>
              ほか {jobs.length - topJobs.length} 件は詳細ページに
            </div>
          )}
        </div>
      )}

      {/* ── CTA。⚠️ 「詳細を見る」は必ず出す（ここは要約であって詳細の置き換えではない） ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={detailHref} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: "var(--royal)", color: "#fff", textDecoration: "none",
          whiteSpace: "nowrap",
        }}>詳細を見る →</Link>
        {/* ⚠️ 色は役割で固定（オレンジ＝カジュアル面談だけ。ui-conventions） */}
        {company.accepting_casual_meetings && (
          <Link href={`/companies/${company.id}/casual-meeting`} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: MEETING_CTA_BG, color: MEETING_CTA_FG, textDecoration: "none",
            whiteSpace: "nowrap",
          }}>話を聞く</Link>
        )}
      </div>
    </div>
  );
}
