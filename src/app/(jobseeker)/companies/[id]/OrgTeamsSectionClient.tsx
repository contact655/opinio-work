"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { ShowMoreButton } from "./ShowMoreButton";

// ─── Division Config ───────────────────────────────────────────────────────────
const DIVISION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; missionBg: string }> = {
  "Sales": {
    label: "営業",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Inside Sales": {
    label: "インサイドセールス",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.14 13.5 19.79 19.79 0 0 1 1.07 4.84 2 2 0 0 1 3.04 2.68h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18z"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Solution Engineering": {
    label: "ソリューションエンジニアリング（プリセールス）",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Customer Success": {
    label: "カスタマーサクセス",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Professional Services": {
    label: "プロフェッショナルサービス",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Marketing": {
    label: "マーケティング",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "Operations": {
    label: "オペレーション",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
  "People": {
    label: "ピープル（HR）",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
  },
};

const DIVISION_ORDER = ["Sales", "Inside Sales", "Solution Engineering", "Customer Success", "Professional Services", "Marketing", "Operations", "People"];

// ─── SecTitle (local copy since this is a client component file) ───────────────
function SecTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
      {icon && (
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: "var(--royal-50)",
          border: "1px solid var(--royal-100)", display: "flex", alignItems: "center",
          justifyContent: "center", color: "var(--royal)", flexShrink: 0,
        }}>
          {icon}
        </span>
      )}
      {children}
    </h2>
  );
}

// ─── Chevron Icon ─────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/*
  初期表示の上限（2026-08-13 に 3部門・4チーム → 1部門・3チーム）。
  取材の進んだ1社だけ組織図がフル展開され、ページ長の差が
  「情報量の差」に見えていた。畳むだけで内容は減らさない。
*/
const INITIAL_DIVISIONS = 1;
const INITIAL_TEAMS_PER_DIVISION = 3; // 部門内の初期表示チーム数

// ─── OrgTeamsSectionClient ────────────────────────────────────────────────────
export default function OrgTeamsSectionClient({ detail, companyId, jobCount = 0 }: { detail: CompanyDetail; companyId?: string; jobCount?: number }) {
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [expandedDivTeams, setExpandedDivTeams] = useState<Set<string>>(new Set());

  if (!detail.orgTeams || detail.orgTeams.length === 0) return null;

  // Group teams by division
  const grouped = new Map<string, typeof detail.orgTeams>();
  for (const team of detail.orgTeams) {
    const div = team.division ?? "Other";
    if (!grouped.has(div)) grouped.set(div, []);
    grouped.get(div)!.push(team);
  }

  const toggle = (key: string) => {
    setOpenTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allDivisions = DIVISION_ORDER.filter(div => grouped.has(div));
  const visibleDivisions = showAll ? allDivisions : allDivisions.slice(0, INITIAL_DIVISIONS);
  const hiddenCount = allDivisions.length - INITIAL_DIVISIONS;
  /* ⚠️ **見えている部門の中で隠れているチームも数える**（2026-08-13 修正）。
        以前は「隠れている部門のチーム数」だけを足しており、
        部門内が INITIAL_TEAMS_PER_DIVISION で切られている分を取りこぼしていた。
        畳んだ状態の部門内展開ボタンを外したので、この数が唯一の手がかりになる。 */
  const visibleTeamCount = allDivisions
    .slice(0, INITIAL_DIVISIONS)
    .reduce((sum, div) => sum + Math.min(grouped.get(div)?.length ?? 0, INITIAL_TEAMS_PER_DIVISION), 0);
  const hiddenTeamCount = detail.orgTeams.length - visibleTeamCount;

  return (
    <>
      {/*
        チーム行のレイアウト。
        ⚠️ この CSS に `>` と `"` を書かない。JSX の style タグはその2文字を
           サーバ側だけがエスケープし、毎リクエスト hydration mismatch になる
           （2026-08-07 に MypageLayout で踏んだ）。
      */}
      <style>{`
        .org-team-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .org-team-mission { flex: 1 1 0%; min-width: 0; }
        .org-team-chevron { flex-shrink: 0; margin-left: auto; }

        /* 狭い画面ではミッションを2行目に送る（2026-08-08）。
           1行目 = チーム名 + 英語名 + chevron / 2行目 = ミッション。
           それまでは チーム名(min 140px) + 英語名バッジ(flex-shrink:0) だけで
           275px の枠が埋まり、flex:1 のミッションが幅0まで縮んで**消えていた**。
           閉じているときのプレビューは行を開く判断材料なので、消してはいけない。
           ブレークポイントは企業詳細ページで既に使っている 767px に揃える。 */
        @media (max-width: 767px) {
          .org-team-row { flex-wrap: wrap; }
          .org-team-chevron { order: 1; }
          .org-team-mission { order: 2; flex-basis: 100%; margin-top: 4px; }
        }
      `}</style>
    <section
      id="org-teams"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SecTitle
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            }
          >
            組織体制・チームのミッション
          </SecTitle>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
            {detail.orgTeams.length} チーム · {grouped.size} 部門
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          気になるチームをクリックして詳細を確認できます。
        </p>
      </div>

      {/* Divisions */}
      <div style={{ padding: "20px 28px 0", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {visibleDivisions.map((div) => {
          const teams = grouped.get(div)!;
          const config = DIVISION_CONFIG[div] ?? {
            label: div, icon: null,
            color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)", missionBg: "var(--royal-50)",
          };

          return (
            <div key={div}>
              {/* Division header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${config.border}`,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: config.bg, border: `1px solid ${config.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: config.color,
                }}>
                  {config.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: config.color, fontFamily: "var(--font-noto-sans)" }}>
                  {config.label}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                  {teams.length} チーム
                </span>
              </div>

              {/* Team rows — accordion */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(expandedDivTeams.has(div) ? teams : teams.slice(0, INITIAL_TEAMS_PER_DIVISION)).map((team) => {
                  const key = `${div}::${team.name}`;
                  const isOpen = openTeams.has(key);

                  return (
                    <div
                      key={team.name}
                      style={{
                        border: `1px solid ${isOpen ? config.color : config.border}`,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: isOpen ? config.bg : "#fff",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      {/* Collapsed row — always visible */}
                      <button
                        className="org-team-row"
                        onClick={() => toggle(key)}
                        style={{
                          width: "100%",
                          padding: "11px 14px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {/* Team name */}
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: "var(--ink)",
                          fontFamily: "var(--font-noto-sans)", flexShrink: 0,
                          minWidth: 140,
                        }}>
                          {team.name}
                        </span>

                        {/* en_name badge */}
                        <span style={{
                          flexShrink: 0, fontSize: 12, fontWeight: 700,
                          color: config.color,
                          background: isOpen ? "#fff" : config.bg,
                          border: `1px solid ${config.border}`,
                          padding: "2px 7px", borderRadius: 100,
                          fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                        }}>
                          {team.en_name}
                        </span>

                        {/* Mission — truncated preview
                            ⚠️ flex / min-width / order は**クラス側**に置く。
                               インラインに書くとメディアクエリが効かず、
                               狭い画面で次行に送れない（CLAUDE.md の優先順位の項）。
                            ⚠️ min-width: 0 が要る。flex item の既定は min-width: auto で、
                               overflow: hidden と text-overflow: ellipsis を書いても縮まない。 */}
                        <span
                          className="org-team-mission"
                          title={team.mission ?? undefined}
                          style={{
                            fontSize: 12, color: "var(--ink-soft)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            display: isOpen ? "none" : "block",
                          }}
                        >
                          {team.mission}
                        </span>

                        {/* Chevron */}
                        <span className="org-team-chevron" style={{ color: "var(--ink-mute)" }}>
                          <Chevron open={isOpen} />
                        </span>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                          {/* Mission highlight */}
                          <div style={{
                            background: config.missionBg, border: `1px solid ${config.border}`,
                            borderRadius: 7, padding: "8px 12px",
                            display: "flex", alignItems: "flex-start", gap: 7,
                          }}>
                            <svg style={{ flexShrink: 0, marginTop: 2 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth={2.5} strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                            </svg>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: config.color, lineHeight: 1.6 }}>
                              {team.mission}
                            </p>
                          </div>

                          {/* Description */}
                          <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.8 }}>
                            {team.description}
                          </p>

                          {/* Roles */}
                          {team.roles && team.roles.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {team.roles.map((role) => (
                                <span key={role} style={{
                                  fontSize: 12, fontWeight: 600, color: config.color,
                                  background: "#fff", border: `1px solid ${config.border}`,
                                  padding: "2px 8px", borderRadius: 100,
                                  fontFamily: "Inter, sans-serif",
                                }}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* ⑤ Jobs link */}
                          {companyId && jobCount > 0 && (
                            <Link href={`/companies/${companyId}/jobs`} style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "6px 13px", borderRadius: 7,
                              background: "#FEF3C7", color: "#92400E",
                              border: "1px solid #FDE68A",
                              fontSize: 12, fontWeight: 700, textDecoration: "none",
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                              この企業の求人を見る（{jobCount}件）→
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/*
                per-division チーム展開ボタン。
                ⚠️ **畳んだ状態では出さない**（2026-08-13）。
                   初期表示が1部門になったので、「この部門の残りチーム」と
                   「すべてを見る」がほぼ同じ操作になり、ボタンが2つ縦に並んでいた。
                   畳んだ状態のボタンは「すべてを見る」1つに統合する。
                   展開後は部門が複数並ぶので、部門ごとの操作として意味を取り戻す。
              */}
              {showAll && !expandedDivTeams.has(div) && teams.length > INITIAL_TEAMS_PER_DIVISION && (
                <button
                  onClick={() => setExpandedDivTeams(prev => { const n = new Set(prev); n.add(div); return n; })}
                  style={{
                    marginTop: 8, width: "100%", padding: "9px 14px",
                    background: "transparent", border: `1px dashed ${config.border}`,
                    borderRadius: 8, color: config.color,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    fontFamily: "var(--font-noto-sans)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  残り {teams.length - INITIAL_TEAMS_PER_DIVISION} チーム：{teams.slice(INITIAL_TEAMS_PER_DIVISION).map(t => t.name).join(" / ")}
                </button>
              )}
              {showAll && expandedDivTeams.has(div) && teams.length > INITIAL_TEAMS_PER_DIVISION && (
                <button
                  onClick={() => setExpandedDivTeams(prev => { const n = new Set(prev); n.delete(div); return n; })}
                  style={{
                    marginTop: 8, width: "100%", padding: "7px 14px",
                    background: "transparent", border: "1px solid var(--line)",
                    borderRadius: 8, color: "var(--ink-mute)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    fontFamily: "var(--font-noto-sans)",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  折りたたむ
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── すべてを見る / 折りたたむ ──
          ⚠️ **チームだけが隠れている場合も出す**（2026-08-13 修正）。
             条件が `hiddenCount > 0`（＝隠れている**部門**の有無）だけだと、
             部門が1つしかない企業でチームが3件を超えたとき、
             畳んだ状態の部門内展開ボタンを外した分だけ**到達不能になる**。 */}
      {!showAll && (hiddenCount > 0 || hiddenTeamCount > 0) ? (
        <ShowMoreButton
          variant="expand"
          label={
            hiddenCount > 0
              ? `すべてを見る（残り ${hiddenCount} 部門 · ${hiddenTeamCount} チーム）`
              : `すべてを見る（残り ${hiddenTeamCount} チーム）`
          }
          expanded={false}
          onClick={() => setShowAll(true)}
          fade
          wrapperStyle={{ padding: "0 28px 28px", marginTop: "var(--space-2)" }}
        />
      ) : showAll ? (
        <ShowMoreButton
          variant="expand"
          label="折りたたむ"
          expanded={true}
          onClick={() => setShowAll(false)}
          wrapperStyle={{ padding: "8px 28px 28px" }}
        />
      ) : (
        <div style={{ paddingBottom: 28 }} />
      )}
    </section>
    </>
  );
}
