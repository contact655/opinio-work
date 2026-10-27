import { chipStyle } from "@/lib/utils/chipVariant";
import type { Destinations } from "@/lib/search/runSearch";

/**
 * ⚠️ 検索結果（/search。学校で引いたときだけ）と学校のページ（/schools/[id]）の両方が使う。見た目を片方だけ変えないこと。
 * ★「〈学校〉を出た人の、いま」。卒業生のいまの業界（大分類）と職種（大分類）を並べる。
 * ★★2026-10-27 に「人の流れ」と同じ規則にそろえた（柴さんの決定）: 3人以上の項目だけ・会社名は出さない。
 *    それまでは転職先の会社をカードで並べ、5人以上のときだけ出していた
 * ⚠️ ログインしているときだけ（人の欄と同じ）。会社名を出してよい職歴だけを数えている
 * ⚠️ 会社で引いたときは使わない。会社を出た人の行き先は検索のページの CompanyLeaversBlock が出す
 */
export function DestinationsBlock({ d, companyLabel }: { d: Destinations; companyLabel: string | null }) {
  const chip = chipStyle("neutral");
  const Row = ({ title, lead, list }: { title: string; lead: string; list: { label: string; count: number }[] }) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", margin: "2px 0 6px" }}>{lead}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {list.map((x) => (
          <span key={x.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {x.label}
            <span style={{ fontWeight: 700, color: "var(--ink-soft)" }}>{x.count}人</span>
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div data-state="search-destinations" style={{ marginTop: 16, padding: "14px 14px 12px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
        {companyLabel ? `${companyLabel}を出た人の、いま` : "この学校を出た人の、いま"}
      </div>
      {d.industries && <Row title="いまの業界" lead={`業界が分かる ${d.industries.known}人`} list={d.industries.byIndustry} />}
      {d.roles && <Row title="いまの職種" lead={`職種が分かる ${d.roles.known}人`} list={d.roles.byRole} />}
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--ink-mute)" }}>業界と職種は大分類でまとめ、人数が3人以上の項目だけ表示しています。</p>
    </div>
  );
}
