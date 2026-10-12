"use client";

import {
  companyTypeText, industryNeedsSub, industryPath, topOf,
  type ClassMasters, type ClassificationValue,
} from "@/lib/companies/classification";
import { missingCompanyRequirements } from "@/lib/companies/companyRequirements";

/**
 * ★右側の欄（2026-10-12）。「求職者にはこう見えます」と「公開まで あと〇つ」（分類の4項目だけ）。
 *   入力するたびにその場で変わる（親の値をそのまま描く）。
 * ⚠️ 判定は companyRequirements.ts（サーバーの公開ゲートと同じ関数）。ここで条件を書かない。
 */
export function classificationMissing(masters: ClassMasters, v: ClassificationValue) {
  const all = missingCompanyRequirements({
    name: "-", industryId: v.industryId, requiresBusinessDomain: false,
    hasPrimaryDomain: v.primaryDomainId !== null && v.domainIds.includes(v.primaryDomainId),
    employeeCountBand: "-", location: "-",
    classification: {
      industryNeedsSub: industryNeedsSub(masters.industries, v.industryId),
      capitalType: v.capitalType, hqCountry: v.hqCountry, companyStage: v.companyStage,
    },
  }, { forListing: false });
  return all.filter((r) => r.key !== "name");
}

export function ClassificationPreview({ masters, value, companyName, onJump, showMissing = true }: {
  masters: ClassMasters;
  value: ClassificationValue;
  companyName: string;
  onJump?: (anchor: string) => void;
  /** 「公開まで あと〇つ」を出すか。⚠️ /biz/company は右の欄に全項目の一覧が既にあるので false（同じ一覧を2つ出さない） */
  showMissing?: boolean;
}) {
  /* ⚠️ 確認待ち（企業が追加して運営がまだ見ていない事業）は求職者に出ないので、ここにも出さない */
  const nameOf = (id: string | null) => {
    const d = masters.domains.find((x) => x.id === id);
    return d && d.status !== "pending" ? d.name : null;
  };
  const pendingCount = value.domainIds.filter((id) => masters.domains.find((x) => x.id === id)?.status === "pending").length;
  const top = topOf(masters.industries, value.industryId);
  const ordered = [value.primaryDomainId, ...value.domainIds.filter((x) => x !== value.primaryDomainId)]
    .filter((x): x is string => !!x && value.domainIds.includes(x));
  const domainNames = ordered.map(nameOf).filter((x): x is string => !!x);
  /* 業種をまたいで選んだ事業の大分類 */
  const otherTops = Array.from(new Set(ordered
    .map((id) => masters.domains.find((d) => d.id === id)?.industry_id ?? null)
    .filter((id): id is string => !!id && id !== top?.id)
    .map((id) => masters.industries.find((i) => i.id === id)?.name)
    .filter((n): n is string => !!n)));
  const customers = value.customerAllIndustries
    ? "業界を問わない"
    : [...value.customerIndustryIds.map((id) => masters.industries.find((i) => i.id === id)?.name).filter((n): n is string => !!n),
       ...(value.servesConsumers ? ["個人のお客さま"] : [])].join("・") || null;
  const missing = classificationMissing(masters, value);
  const row = (label: string, text: string | null) => (
    <div style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.7, minWidth: 0 }}>
      <span style={{ flexShrink: 0, width: 64, color: "var(--ink-mute)" }}>{label}</span>
      <span style={{ minWidth: 0, color: text ? "var(--ink)" : "var(--ink-mute)", overflowWrap: "anywhere" }}>{text ?? "—"}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }} data-state="classification-preview">
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>求職者にはこう見えます</p>
        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{companyName || "—"}</p>
        {row("業種", industryPath(masters.industries, value.industryId))}
        {row("事業", domainNames.length > 0 ? domainNames.join("／") : null)}
        {row("タイプ", companyTypeText(value.capitalType, value.hqCountry, value.companyStage))}
        {row("お客さま", customers)}
        {pendingCount > 0 && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }} data-state="pending-domains-note">
            追加した事業は、運営が確認するまで求職者には表示されません。
          </p>
        )}
        {top && otherTops.length > 0 && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }} data-state="cross-industry">
            「{top.name}」だけでなく「{otherTops.join("」「")}」の事業で探した人にも、この会社が表示されます。
          </p>
        )}
      </div>
      {showMissing && <div>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }} data-state="classification-missing" data-count={missing.length}>
          {missing.length === 0 ? "公開に必要な分類はそろっています" : `公開まで あと${missing.length}つ`}
        </p>
        {missing.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {missing.map((r) => (
              <li key={r.key} style={{ fontSize: 12.5 }}>
                {onJump
                  ? <button type="button" onClick={() => onJump(r.anchor)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", color: "var(--royal)", textAlign: "left" }}>{r.label}</button>
                  : <span style={{ color: "var(--ink-soft)" }}>{r.label}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>}
    </div>
  );
}
