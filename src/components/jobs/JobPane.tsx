import Link from "next/link";
import type { Job } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { formatSalary, hasSalaryData } from "@/components/jobs/JobListItem";

/**
 * 求人の**要約ビュー**。一覧の隣（分割ビューの右ペイン）に置く部品。
 *
 * ── ⚠️★守ること（`CompanyPane` と同じ）────────────────────────────────────
 * 1. **ビューポート基準のメディアクエリを書かない。** 幅はコンテナで決まるので
 *    `flexWrap` と `minWidth: 0` で組む。
 * 2. **`position: fixed` / `sticky` を置かない。** どちらもペインの外にはみ出す。
 * 3. **データを取りに行かない（presentational）。** 呼び出し側が渡す。
 * 4. **CTA はヘッダーの中に置く。** 末尾に置くと、内容の厚い求人では
 *    ペインの内部スクロールの奥に入り、**ページをスクロールしても出てこない**
 *    （2026-09-09 に企業ペインで実測して直したのと同じ形）。
 *
 * ⚠️ 深く読みたい人向けの導線（「詳細を見る」）を**必ず残すこと**。ここは要約であって
 *    詳細の置き換えではない。出していない項目（仕事内容・選考フロー・勤務条件・
 *    福利厚生・関連記事）は求人詳細ページにしかない。
 */
export function JobPane({
  job,
  company,
}: {
  job: Job;
  /** 会社が引けないことがある（`companyMap` に無い）。**その場合は会社行を出さない** */
  company?: Company;
}) {
  const href = `/jobs/${job.slug ?? job.id}`;

  /* 本文の冒頭。⚠️ **最初の段落だけ・3行でクランプ。**
     企業ペインと同じ理由（全文を出すと CTA が内部スクロールの奥へ落ちる）。
     ⚠️ markdown として描画しない。素のテキストとして出し、先頭の記号だけ落とす。 */
  const overviewLead = (job.overview ?? "")
    .split(/\n\s*\n/)[0]
    .replace(/^[#>\s]+/, "")
    .trim();

  /* ⚠️ 値が無い項目は**要素ごと出さない**（「—」や「0」で埋めない）。 */
  const badges = [job.location, job.work_style, job.employment_type].filter(Boolean) as string[];

  /* 必須スキル。⚠️ **上位5件だけ**。全件は詳細ページに任せる。 */
  const skills = (job.required_skills ?? []).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minWidth: 0 }}>
      {/* ── ヘッダー（会社・職種・年収・CTA） ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "var(--space-6)", minWidth: 0,
      }}>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", minWidth: 0 }}>
          {company && (
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              size={52}
              borderRadius={12}
              style={{ border: "1px solid #eef0f3", flexShrink: 0 }}
            />
          )}
          {/* ⚠️ `minWidth: 0` を外さないこと。長い求人名が親を押し広げる */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              margin: 0, fontSize: 19, fontWeight: 800, color: "var(--ink)", lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}>{job.role}</h2>
            {company && (
              <div style={{ fontSize: 13, color: "var(--royal)", fontWeight: 700, marginTop: 3, overflowWrap: "anywhere" }}>
                {company.name}
              </div>
            )}
          </div>
        </div>

        {/* 年収。⚠️ **金額が無い求人がある。** `hasSalaryData` が false なら行ごと出さない
               （0円や「非公開」を作らない）。 */}
        {hasSalaryData(job.salary_min, job.salary_max) && (
          <div style={{
            marginTop: "var(--space-4)", fontSize: 15, fontWeight: 800,
            color: "var(--success-ink)", fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            {formatSalary(job.salary_min, job.salary_max)}
          </div>
        )}

        {/* 勤務地・勤務形態・雇用形態 */}
        {badges.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-3)" }}>
            {badges.map((b) => (
              <span key={b} style={{
                fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-tint)",
                border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
              }}>{b}</span>
            ))}
          </div>
        )}

        {/* 本文の冒頭 */}
        {overviewLead && (
          <p style={{
            margin: "var(--space-4) 0 0", fontSize: 13, lineHeight: 1.8,
            color: "var(--ink-soft)", overflowWrap: "anywhere",
            display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden",
          }}>{overviewLead}</p>
        )}

        {/* ── CTA。⚠️ ヘッダーの中に置く（上の注記4）── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "var(--space-5)" }}>
          <Link href={href} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: "var(--royal)", color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
          }}>詳細を見る →</Link>
          {/* ⚠️ 応募は**ログインの内側**。未ログインなら /auth へ飛ぶ（既存の挙動どおり）。 */}
          <Link href={`${href}/apply`} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: "#fff", color: "var(--royal)", border: "1px solid var(--royal-100)",
            textDecoration: "none", whiteSpace: "nowrap",
          }}>応募する</Link>
        </div>
      </div>

      {/* ── 必須スキル。⚠️ 無ければブロックごと出さない ── */}
      {skills.length > 0 && (
        <div style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
          padding: "var(--space-6)", minWidth: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: "var(--space-3)" }}>
            必須スキル
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {skills.map((s, i) => (
              <span key={`${s}-${i}`} style={{
                fontSize: 12.5, color: "var(--ink-soft)", background: "var(--bg-tint)",
                border: "1px solid var(--line)", padding: "4px 10px", borderRadius: "var(--radius-sm)",
                lineHeight: 1.6, overflowWrap: "anywhere",
              }}>{s}</span>
            ))}
          </div>
          {/* ⚠️ 5件を超える場合だけ「残り」を出す */}
          {(job.required_skills?.length ?? 0) > skills.length && (
            <div style={{ marginTop: "var(--space-3)", fontSize: 12, color: "var(--ink-mute)" }}>
              ほか {(job.required_skills?.length ?? 0) - skills.length} 件は詳細ページに
            </div>
          )}
        </div>
      )}
    </div>
  );
}
