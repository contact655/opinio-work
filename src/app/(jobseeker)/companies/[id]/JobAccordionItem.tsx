"use client";
import { useState } from "react";
import Link from "next/link";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";

export type JobAccordionData = {
  id?: string;
  slug?: string | null;
  title: string;
  salary: string;
  is_new?: boolean;
  urgency?: "open" | "hot";
  catchCopy?: string | null;
  whyHire?: string | null;
  description?: string | null;
  requirements?: string | null;
  selectionProcess?: string | null;
  workStyle?: string | null;
  location?: string | null;
  employmentType?: string | null;
};

type Props = {
  job: JobAccordionData;
  catName: string;
  catId?: string;
  companyId: string;
  defaultWorkLocation?: string;
};

/** 選考フローをパースしてステップ配列に変換 */
function parseSelectionSteps(raw: string): string[] {
  // 改行 or "→" or "①②..." で分割
  const byNewline = raw.split(/\n|→|▶|►/).map(s => s.trim()).filter(Boolean);
  // 番号付き行は番号を除去
  return byNewline.map(s => s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d]+[\.\)、]?\s*/, "").trim()).filter(Boolean);
}

/** テキストを指定文字数で切り詰め */
function truncate(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/。[^。]*$/, "").replace(/[、\s]+$/, "") + "……";
}

export function JobAccordionItem({ job, catName, catId, companyId, defaultWorkLocation }: Props) {
  const [open, setOpen] = useState(false);
  const catColor = resolveAvatarColor(catId ?? null, null);

  // Work location display
  const wl = job.location || defaultWorkLocation || "";
  const isRemote = wl.includes("リモート") || wl.includes("在宅") || wl.includes("テレワーク") || wl.includes("フルリモート");

  const selectionSteps = job.selectionProcess ? parseSelectionSteps(job.selectionProcess) : [];

  return (
    <>
      <style>{`
        .job-accordion-btn { background: none; border: none; cursor: pointer; width: 100%; text-align: left; font-family: inherit; padding: 0; }
        .job-accordion-btn:hover .jab-title { color: var(--royal); }
        .jab-chevron { transition: transform 0.2s; }
        .jab-chevron.open { transform: rotate(180deg); }
        .jab-expand { animation: jabSlideDown 0.2s ease; }
        @keyframes jabSlideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .jab-step { display: flex; align-items: center; gap: 6px; }
        .jab-step::after { content: ""; flex: 1; height: 1px; background: var(--line); }
        .jab-step:last-child::after { display: none; }
      `}</style>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
          transition: "box-shadow 0.2s",
          boxShadow: open ? "0 4px 16px rgba(0,35,102,0.10)" : "none",
        }}
      >
        {/* ── Header: click to toggle ── */}
        <button
          type="button"
          className="job-accordion-btn"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <div style={{ display: "flex", gap: 0, overflow: "hidden" }}>
            {/* Left accent bar */}
            <div style={{ width: 4, flexShrink: 0, background: catColor.text, opacity: 0.7 }} />
            {/* Content */}
            <div style={{ flex: 1, padding: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="jab-title" style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.35, transition: "color 0.15s" }}>
                  {job.title}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {job.urgency === "hot" && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "2px 7px", borderRadius: 4,
                      background: "#FEE2E2", color: "#DC2626",
                      fontSize: 12, fontWeight: 800, letterSpacing: "0.08em",
                      fontFamily: "Inter, sans-serif", border: "1px solid #FECACA",
                    }}>🔥 HOT</span>
                  )}
                  {job.is_new && (
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--success-soft,#ECFDF5)", color: "var(--success)", fontWeight: 700, border: "1px solid #A7F3D0" }}>
                      新着
                    </span>
                  )}
                  <span style={{
                    display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 4,
                    background: catColor.bg, color: catColor.text, fontWeight: 600,
                  }}>{catName}</span>
                  {wl && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 12, padding: "2px 7px", borderRadius: 4,
                      background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
                      color: isRemote ? "var(--success)" : "var(--ink-mute)",
                      border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
                      fontWeight: 500,
                    }}>
                      {isRemote ? "🏠" : "🏢"} {wl}
                    </span>
                  )}
                  {job.employmentType && (
                    <span style={{
                      fontSize: 12, padding: "2px 7px", borderRadius: 4,
                      background: "var(--bg-tint)", color: "var(--ink-mute)",
                      border: "1px solid var(--line)", fontWeight: 500,
                    }}>{job.employmentType}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                {job.salary && job.salary !== "—" && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "var(--text-xs)", color: "#6b7280", fontWeight: 600, letterSpacing: "0.03em", marginBottom: 2 }}>年収</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "var(--text-base)", fontWeight: 800, color: "var(--success)" }}>
                      {job.salary}
                    </div>
                  </div>
                )}
                {/* Chevron */}
                <svg className={`jab-chevron${open ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </button>

        {/* ── Expanded content ── */}
        {open && (
          <div className="jab-expand" style={{ borderTop: "1px solid var(--line-soft)", background: "var(--bg-tint)", padding: "var(--space-4) var(--space-5)" }}>

            {/* キャッチコピー */}
            {job.catchCopy && (
              <p style={{
                margin: "0 0 var(--space-4)",
                fontSize: "var(--text-base)",
                fontWeight: 700,
                color: "var(--royal)",
                lineHeight: 1.5,
                borderLeft: "3px solid var(--royal)",
                paddingLeft: "var(--space-3)",
              }}>
                {job.catchCopy}
              </p>
            )}

            {/* なぜ採用するか */}
            {job.whyHire && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  募集背景
                </div>
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  {truncate(job.whyHire, 160)}
                </p>
              </div>
            )}

            {/* 仕事内容（whyHire がない場合の代替） */}
            {!job.whyHire && job.description && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  仕事内容
                </div>
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  {truncate(job.description, 160)}
                </p>
              </div>
            )}

            {/* 応募要件 */}
            {job.requirements && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  必須要件
                </div>
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  {truncate(job.requirements, 140)}
                </p>
              </div>
            )}

            {/* 選考フロー */}
            {selectionSteps.length > 0 && (
              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  選考フロー
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
                  {selectionSteps.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                        padding: "6px 12px",
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "var(--royal)", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, fontFamily: "Inter, sans-serif",
                          flexShrink: 0,
                        }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap", maxWidth: 90, textAlign: "center", lineHeight: 1.3 }}>
                          {step}
                        </span>
                      </div>
                      {i < selectionSteps.length - 1 && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {job.id && (
                <Link
                  href={`/jobs/${job.slug ?? job.id}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "9px 20px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 700,
                    background: "linear-gradient(135deg, var(--royal), var(--accent))",
                    color: "#fff", textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(0,35,102,0.20)",
                  }}
                >
                  詳細・応募する
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
              <Link
                href={`/companies/${companyId}/casual-meeting`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "9px 20px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 700,
                  background: "#fff", color: "var(--warm)",
                  border: "1.5px solid var(--warm)",
                  textDecoration: "none",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                担当者に話を聞く
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
