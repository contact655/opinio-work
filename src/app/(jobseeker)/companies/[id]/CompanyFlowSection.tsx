"use client";

import { useEffect, useState } from "react";
import { SecTitle } from "./SecTitle";
import { useCompanyViewerState } from "@/lib/companies/useCompanyViewerState";
import { formatMonths } from "@/lib/profile/tenure";
import type { CompanyFlow, CompanyFlowSummary, FlowBreakdown } from "@/lib/companyFlow/compute";

/**
 * ★企業ページ「人の流れ」（2026-10-27 / 柴さんの決定。モック「③ 企業ページ：人の流れが主役」）。ページの先頭に出す。
 *
 * ⚠️★サーバー（ISR）から受け取るのは件数だけ（CompanyFlowSummary）。内訳・平均・割合は、ログインしている人にだけ
 *    API（/api/jobseeker/companies/[id]/flow）から取る。ログインしていない人には「登録すると読めます」。
 * ⚠️ 項目ごとに、下限未満（経歴 3人・回答 5人）は null で届く。null の項目は文言ごと出さない。
 *    出せる項目が1つも無い会社では、ページ側がこの部品ごと描かない。
 * ⚠️ 「話を聞ける社員・OB」は入れない（2026-10-16 に撤去済み）。OB の在籍月数と「現在：」は「社員・OB/OG」に残す。
 */
export function CompanyFlowSection({ companyId, summary, preview }: {
  companyId: string;
  summary: CompanyFlowSummary;
  /** ★`/dev/preview` 用。渡すと API を呼ばず、ログイン状態と内訳をこれで決める */
  preview?: { authenticated: boolean; full: CompanyFlow | null };
}) {
  const realViewer = useCompanyViewerState(preview ? "" : companyId);
  const viewer = preview ? { ready: true, authenticated: preview.authenticated } : realViewer;
  const [fetched, setFetched] = useState<CompanyFlow | null>(null);
  const full = preview ? (preview.authenticated ? preview.full : null) : fetched;
  const setFull = setFetched;

  useEffect(() => {
    if (preview || !viewer.ready || !viewer.authenticated) return;
    let alive = true;
    fetch(`/api/jobseeker/companies/${companyId}/flow`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { authenticated?: boolean; flow?: CompanyFlow | null } | null) => {
        /* ⚠️ 内訳を持つのはログインしている人の応答だけ（API が認証を見て形を変える） */
        if (alive && j?.authenticated && j.flow) setFull(j.flow);
      })
      .catch((e) => console.error("[company-flow] load:", (e as Error).message));
    return () => { alive = false; };
  }, [preview, viewer.ready, viewer.authenticated, companyId, setFull]);

  const locked = !full;
  const s = summary;
  const loginHref = typeof window === "undefined" ? "/auth" : `/auth?next=${encodeURIComponent(window.location.pathname)}`;
  const lockedNote = viewer.ready && !viewer.authenticated
    ? <a href={loginHref} data-state="cf-locked" style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>登録すると読めます →</a>
    : <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>読み込んでいます…</span>;

  return (
    <section id="company-flow" data-state={locked ? "cf-summary" : "cf-full"} style={{ marginBottom: "var(--space-8)", scrollMarginTop: 120 }}>
      <style>{CSS}</style>
      <SecTitle iconColor="default" icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      }>
        人の流れ
      </SecTitle>
      <p style={{ margin: "-4px 0 14px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
        OPINIO に登録した{s.people}人の経歴から数えています。人数の少ない項目は出していません。
      </p>

      <div className="cf-flow">
        {s.previous && (
          <Card title="前職" state="cf-previous" lead={`前職が分かる社員 ${s.previous.known}人`}>
            {locked ? lockedNote : <Bars rows={full?.previous?.byIndustry ?? []} />}
          </Card>
        )}
        {s.tenure && (
          <Card title="在籍" state="cf-tenure" lead={`OB・OG ${s.tenure.alumni}人`}>
            {locked ? lockedNote : full?.tenure && (
              <div style={{ fontSize: 14, color: "var(--ink)" }}>
                平均 <strong style={{ fontSize: 18 }}>{formatMonths(full.tenure.avgMonths)}</strong>
              </div>
            )}
          </Card>
        )}
        {s.next && (
          <Card title="行き先" state="cf-next" lead={`行き先が分かる OB・OG ${s.next.known}人`}>
            {locked ? lockedNote : <Bars rows={full?.next?.byIndustry ?? []} />}
          </Card>
        )}
      </div>

      {(s.roleChanges || s.decisiveTop || s.fitAfterYear) && (
        <div className="cf-more">
          {s.roleChanges && (
            <Card title="社内での職種の変化" state="cf-role-changes" lead={`職種が変わった人 ${s.roleChanges.people}人`}>
              {locked ? lockedNote : <Bars rows={full?.roleChanges?.paths ?? []} />}
            </Card>
          )}
          {s.decisiveTop && (
            <Card title="入社の決め手" state="cf-decisive" lead={`${s.decisiveTop.respondents}人の回答から`}>
              {locked ? lockedNote : <Bars rows={full?.decisiveTop?.top ?? []} />}
            </Card>
          )}
          {s.fitAfterYear && (
            <Card title="入って1年たったころ" state="cf-fit" lead={`${s.fitAfterYear.respondents}人の回答から`}>
              {locked ? lockedNote : full?.fitAfterYear && (
                <div style={{ fontSize: 14, color: "var(--ink)" }}>
                  「合っていた」と答えた人 <strong style={{ fontSize: 18 }}>{full.fitAfterYear.goodShare}%</strong>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function Card({ title, lead, state, children }: { title: string; lead: string; state: string; children: React.ReactNode }) {
  return (
    <div data-state={state} className="cf-card">
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "4px 0 10px" }}>{lead}</div>
      {children}
    </div>
  );
}

function Bars({ rows }: { rows: FlowBreakdown }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <li key={r.label} style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: "var(--ink)" }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</span>
            <span style={{ flexShrink: 0, color: "var(--ink-soft)" }}>{r.count}人</span>
          </div>
          <div aria-hidden="true" style={{ marginTop: 4, height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: "100%", background: "var(--royal)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ⚠️ この style のコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる） */
const CSS = `
  .cf-flow { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; }
  .cf-more { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
  .cf-card { min-width: 0; padding: 14px 16px; border-radius: 12px; background: #fff; border: 1px solid var(--line); }
  @media (max-width: 767px) { .cf-flow { grid-auto-flow: row; grid-template-columns: minmax(0, 1fr); } }
`;
