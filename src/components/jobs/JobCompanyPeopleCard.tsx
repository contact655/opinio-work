"use client";

import { useEffect, useState } from "react";
import type { CompanyEmployee } from "@/lib/supabase/queries";
import { AVATAR_COLOR } from "@/lib/avatarColor";

/**
 * 求人ページのサイドバー「この会社で働く人」（2026-11-26）。現役社員を先に、続けて OB・OG を最大3人。
 *
 * ⚠️★**人はブラウザから取りに行く**（企業ページと同じ `/api/jobseeker/companies/[id]/employees`）。
 *    求人ページは ISR で HTML が全員に共有されるので、サーバーで描くと「ログインユーザーのみ」の人の
 *    名前が未ログインの人にも配られる。見せる範囲はその API の1か所（未ログインは「公開」の人だけ）。
 * ⚠️ 0人のときはカードごと出さない（取得に失敗したときも出さない）。枠（jd-card）もこの中に持つ。
 * ⚠️ 枠の見た目は求人ページ（JobDetailView）の style タグの .jd-card / .jd-side-card。
 * ⚠️ 本人の名前・職種だけ。面談・「話を聞ける」の意味づけは書かない（2026-10-16 に撤去）。
 */
type Resp = {
  authenticated: boolean;
  current: CompanyEmployee[];
  alumni: CompanyEmployee[];
  hiddenCurrentCount: number;
  hiddenAlumniCount: number;
};

const MAX = 3;

export function JobCompanyPeopleCard({ companyId, companyHref, title, excludeUserIds = [] }: {
  companyId: string;
  companyHref: string | null;
  title: React.ReactNode;
  /** ★上の「この募集に関わる人」に出た人（2026-11-26）。同じ人を2つの枠に出さない。除いた結果0人なら枠ごと出さない */
  excludeUserIds?: string[];
}) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobseeker/companies/${encodeURIComponent(companyId)}/employees`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setData(j as Resp); })
      .catch((e) => console.error("[JobCompanyPeopleCard]", e));
    return () => { alive = false; };
  }, [companyId]);

  if (!data) return null;
  const excluded = new Set(excludeUserIds);
  const people = [
    ...data.current.map((p) => ({ p, alumni: false })),
    ...data.alumni.map((p) => ({ p, alumni: true })),
  ].filter(({ p }) => !excluded.has(p.userId));
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX);
  const rest = people.length - shown.length;
  const hidden = data.authenticated ? 0 : (data.hiddenCurrentCount ?? 0) + (data.hiddenAlumniCount ?? 0);

  return (
    <div className="jd-card jd-side-card" data-state="job-company-people">
      {title}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map(({ p, alumni }, i) => (
          <a key={p.userId} href={`/u/${p.userId}`} style={{
            display: "flex", alignItems: "center", gap: 10, minWidth: 0, padding: "10px 0",
            borderTop: i === 0 ? undefined : "1px solid var(--line-soft)", textDecoration: "none", color: "inherit",
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: p.avatarUrl ? undefined : AVATAR_COLOR.bg, color: AVATAR_COLOR.text, fontWeight: 700, fontSize: 14,
            }}>
              {p.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (p.avatarInitial ?? p.name.charAt(0))}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[alumni ? "OB・OG" : null, p.roleTitle].filter(Boolean).join(" ・ ")}
              </span>
            </span>
          </a>
        ))}
      </div>
      {rest > 0 && companyHref && (
        <a href={companyHref} style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
          ほか{rest}名を会社ページで見る →
        </a>
      )}
      {hidden > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-mute)" }}>ログインすると、ほか{hidden}名が見られます</p>
      )}
    </div>
  );
}
