import { SecTitle } from "./SecTitle";
import { JOIN_DECISION_RANKING_NOTE } from "@/lib/joinDecision/constants";

/**
 * ★企業ページ「この会社に決めた理由」（2026-11-02 / 柴さんの指示）。上位3つを**順位だけ**で出す。
 *   中身は毎月1日のバッチ（/api/cron/rebuild-reason-rankings → ow_company_reason_rankings）。
 * ⚠️★人数（「N人の回答から」・各行の N・割合・バー）は出さない。API でも返さない。
 * ⚠️ 回答が10人（MIN_REASON_COUNT）以上の会社だけ。届かない会社ではページが描かない（文言も出さない）。
 * ⚠️ 部門・職種・経歴とは掛け合わせない。
 * ⚠️ 人数を持たない集計なので、ログインしていない人にも同じ形で出す。
 */
export function CompanyReasonRanking({ labels }: { labels: string[] }) {
  return (
    <section id="company-reasons" data-state="company-reasons" style={{ marginBottom: "var(--space-8)", scrollMarginTop: 120 }}>
      <SecTitle iconColor="default" icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      }>
        この会社に決めた理由
      </SecTitle>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {labels.map((label, i) => (
          <li key={label} data-state={`company-reason-${i + 1}`}
            style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, padding: "12px 16px", borderRadius: 12, background: "#fff", border: "1px solid var(--line)" }}>
            <span aria-label={`${i + 1}位`}
              style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--royal-50)", color: "var(--royal)", fontSize: 13, fontWeight: 800 }}>
              {i + 1}
            </span>
            <span style={{ minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{label}</span>
          </li>
        ))}
      </ol>
      <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>{JOIN_DECISION_RANKING_NOTE}</p>
    </section>
  );
}
