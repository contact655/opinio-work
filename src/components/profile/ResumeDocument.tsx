import { ymLabel, type ResumeCompany } from "@/lib/profile/resume";

/**
 * ★職務経歴書の本体（2026-10-18）。データの取得は /mypage/resume、見た目の確認は /dev/preview/resume。
 *   ⚠️ ここは描くだけ。DB を読まない（preview から固定データで描けるように）。
 *   ⚠️ 値の無い項目は出さない。空のときの案内は data-print-hide を付けて印刷に出さない。
 */
export type ResumeDocData = {
  asOf: string;
  name: string;
  about: string;
  totalLabel: string | null;
  companies: ResumeCompany[];
  autoSkills: { label: string; band: string }[];
  skillLabels: string[];
  achievements: string[];
  certifications: { name: string; issuer: string | null; issuedAt: string | null }[];
  languages: { label: string; level: string | null }[];
  awards: { title: string; issuer: string | null; awardedAt: string | null }[];
  educations: { school: string; faculty: string | null; degree: string | null; enrolledAt: string | null; graduatedAt: string | null; isCurrent: boolean }[];
};

export const RESUME_CSS = `
  .rsm-paper { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 40px 48px; color: #111; }
  .rsm-h1 { margin: 0; text-align: center; font-size: 22px; font-weight: 700; letter-spacing: 0.3em; }
  .rsm-meta { margin-top: 18px; text-align: right; font-size: 13px; line-height: 1.8; }
  .rsm-h2 { margin: 28px 0 10px; padding: 4px 10px; font-size: 14px; font-weight: 700; background: #f1f3f6; border-left: 4px solid #333; }
  .rsm-p { margin: 0; font-size: 13.5px; line-height: 1.9; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rsm-co { margin-top: 14px; border: 1px solid #d5d9df; break-inside: avoid; page-break-inside: avoid; }
  .rsm-co-head { display: flex; justify-content: space-between; gap: 4px 12px; flex-wrap: wrap; padding: 8px 12px; background: #f7f8fa; border-bottom: 1px solid #d5d9df; font-size: 13.5px; }
  .rsm-co-head strong { min-width: 0; overflow-wrap: anywhere; }
  .rsm-role { padding: 10px 12px; border-top: 1px solid #eceef1; }
  .rsm-role:first-of-type { border-top: 0; }
  .rsm-role-head { display: flex; gap: 2px 12px; flex-wrap: wrap; font-size: 13px; font-weight: 700; }
  .rsm-role-title { min-width: 0; overflow-wrap: anywhere; }
  .rsm-role-period { flex-shrink: 0; color: #444; font-weight: 600; }
  .rsm-sub { font-size: 12.5px; color: #555; margin-top: 2px; }
  .rsm-ach { margin: 6px 0 0; padding-left: 20px; list-style: disc; font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
  .rsm-list { margin: 0; padding-left: 20px; list-style: disc; font-size: 13.5px; line-height: 1.9; overflow-wrap: anywhere; }
  .rsm-tbl { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
  .rsm-tbl td { padding: 4px 8px; border-bottom: 1px solid #eceef1; vertical-align: top; overflow-wrap: anywhere; }
  .rsm-tbl td:first-child { width: 9.5em; color: #444; }
  .rsm-empty { font-size: 13px; color: var(--ink-mute); margin: 0; }
  @media (max-width: 640px) {
    .rsm-paper { padding: 24px 16px; }
    .rsm-tbl td:first-child { width: 7.5em; }
  }
  @media print {
    @page { size: A4; margin: 16mm 14mm; }
    .rsm-paper { border: 0; border-radius: 0; padding: 0; }
    .rsm-h2, .rsm-co-head { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

function eduWhen(e: ResumeDocData["educations"][number]): string {
  if (e.isCurrent) return "在学中";
  const g = ymLabel(e.graduatedAt);
  if (g) return `${g} 卒業`;
  const s = ymLabel(e.enrolledAt);
  return s ? `${s} 入学` : "";
}

export function ResumeDocument({ d }: { d: ResumeDocData }) {
  return (
    <article className="rsm-paper" data-state="resume">
      <h1 className="rsm-h1">職務経歴書</h1>
      <div className="rsm-meta">
        <div>{d.asOf}</div>
        {d.name && <div>氏名　{d.name}</div>}
      </div>

      <h2 className="rsm-h2">職務要約</h2>
      {d.about ? <p className="rsm-p" data-state="resume-summary">{d.about}</p>
        : <p className="rsm-empty" data-print-hide>マイページの「自己紹介」を書くと、ここに職務要約として出ます。</p>}
      {d.totalLabel && <p className="rsm-p" style={{ marginTop: 6, color: "#444" }}>社会人経験　{d.totalLabel}</p>}

      <h2 className="rsm-h2">職務経歴</h2>
      {d.companies.length === 0 ? (
        <p className="rsm-empty" data-print-hide data-state="resume-no-career">マイページで職歴を入れると、ここに出ます。</p>
      ) : d.companies.map((c) => (
        <section key={c.key} className="rsm-co" data-state="resume-company">
          <div className="rsm-co-head"><strong>{c.name}</strong>{c.period && <span>{c.period}</span>}</div>
          {c.roles.map((r) => {
            /* 1社1役割で期間が同じなら、役割の行には期間を出さない（見出しと二重になる） */
            const period = c.roles.length === 1 && r.period === c.period ? "" : r.period;
            const title = [r.department, r.role, r.rank].filter(Boolean).join("　");
            const sub = [r.employmentType, r.secondment ? `${r.secondment}へ出向` : null].filter(Boolean).join("・");
            return (
              <div key={r.id} className="rsm-role">
                {(period || title) && (
                  <div className="rsm-role-head">
                    {period && <span className="rsm-role-period">{period}</span>}
                    {title && <span className="rsm-role-title">{title}</span>}
                  </div>
                )}
                {sub && <div className="rsm-sub">{sub}</div>}
                {r.description && <p className="rsm-p" style={{ marginTop: 6 }}>{r.description}</p>}
                {r.achievements.length > 0 && <ul className="rsm-ach">{r.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              </div>
            );
          })}
        </section>
      ))}

      {(d.autoSkills.length > 0 || d.skillLabels.length > 0) && (
        <>
          <h2 className="rsm-h2">活かせる経験・スキル</h2>
          <ul className="rsm-list">
            {d.autoSkills.map((s) => <li key={`a:${s.label}`}>{s.label}（{s.band}）</li>)}
            {d.skillLabels.length > 0 && <li>{d.skillLabels.join("、")}</li>}
          </ul>
        </>
      )}

      {d.achievements.length > 0 && (
        <>
          <h2 className="rsm-h2">実績</h2>
          <ul className="rsm-list">{d.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </>
      )}

      {(d.certifications.length > 0 || d.languages.length > 0) && (
        <>
          <h2 className="rsm-h2">資格・語学</h2>
          <table className="rsm-tbl"><tbody>
            {d.certifications.map((c, i) => <tr key={`c${i}`}><td>{ymLabel(c.issuedAt) ?? ""}</td><td>{c.name}{c.issuer ? `（${c.issuer}）` : ""}</td></tr>)}
            {d.languages.map((l, i) => <tr key={`l${i}`}><td>語学</td><td>{l.label}{l.level ? `：${l.level}` : ""}</td></tr>)}
          </tbody></table>
        </>
      )}

      {d.awards.length > 0 && (
        <>
          <h2 className="rsm-h2">受賞</h2>
          <table className="rsm-tbl"><tbody>
            {d.awards.map((a, i) => <tr key={i}><td>{ymLabel(a.awardedAt) ?? ""}</td><td>{a.title}{a.issuer ? `（${a.issuer}）` : ""}</td></tr>)}
          </tbody></table>
        </>
      )}

      {d.educations.length > 0 && (
        <>
          <h2 className="rsm-h2">学歴</h2>
          <table className="rsm-tbl"><tbody>
            {d.educations.map((e, i) => <tr key={i}><td>{eduWhen(e)}</td><td>{[e.school, e.faculty, e.degree].filter(Boolean).join("　")}</td></tr>)}
          </tbody></table>
        </>
      )}

      <p className="rsm-p" style={{ marginTop: 28, textAlign: "right" }}>以上</p>
    </article>
  );
}
