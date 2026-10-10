"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApproachButton } from "@/components/approaches/ApproachButton";
import { neutralAvatarStyle } from "@/lib/avatarColor";
import { candidateApproachLabel, formatJstMonthDay, type Candidate, type Touchpoint, type TouchpointMaterials } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1・キャンバス1）。
 *
 * ⚠️ 中身は `/api/biz/candidates/[userId]/preview` から取る（一覧と同じ判定を通った人だけ返る）。
 * ⚠️★声かけのボタンは `ApproachButton`（一覧と同じ部品）。送れるかは `approach.eligible` だけを見る。
 * ⚠️ 「プロフィール全体を見る」は**同じタブ**で /u/[id]。
 * ⚠️ 接点は強い順に3つまで。4つ以上なら「ほかに N件」で全部。**空でも欄は消さない**。
 */
export type PreviewData = {
  candidate: Candidate;
  aboutMe: string | null;
  experiences: { id: string; company: string | null; roleTitle: string | null; roleName: string | null; startedAt: string | null; endedAt: string | null; isCurrent: boolean }[];
  skills: string[];
  touchpointMaterials: TouchpointMaterials | null;
  approachJobs: { id: string; title: string }[];
};

const TOUCHPOINT_INITIAL = 3;

function ym(v: string | null): string {
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}年${Number(m[2])}月` : "";
}

function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/** 接点の欄（空のときは足りない材料への入口）。⚠️ プレビューの部品として切り出してある（/dev/preview から使う） */
export function TouchpointSection({ touchpoints, materials }: { touchpoints: Touchpoint[] | undefined; materials: TouchpointMaterials | null }) {
  const [showAll, setShowAll] = useState(false);
  /* ⚠️ 取れなかった（undefined）ときは欄ごと出さない。0件と言わない */
  if (!touchpoints) return null;
  const shown = showAll ? touchpoints : touchpoints.slice(0, TOUCHPOINT_INITIAL);
  const rest = touchpoints.length - TOUCHPOINT_INITIAL;
  const entrances: { href: string; label: string }[] = [];
  if (materials && !materials.hasJobs) entrances.push({ href: "/biz/jobs/new", label: "求人を登録する" });
  if (materials && !materials.hasCompanyRoles) entrances.push({ href: "/biz/organization?tab=roles", label: "部門・職種を登録する" });
  if (materials && !materials.hasPublicEmployees) entrances.push({ href: "/biz/employees", label: "社員に企業ページへの登録を呼びかける" });
  return (
    <section data-state="touchpoints" style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>貴社との接点</h3>
      {touchpoints.length === 0 ? (
        <div data-state="touchpoints-empty" style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>まだ貴社との接点は見つかっていません。</p>
          {/* ⚠️ 材料が揃っている企業では入口を出さない（その候補者とだけ接点が無い） */}
          {entrances.length > 0 && (
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {entrances.map((e) => (
                <li key={e.href}><Link href={e.href} style={{ color: "var(--royal)", fontWeight: 700, textDecoration: "none" }}>{e.label} →</Link></li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {shown.map((t, i) => (
              <li key={`${t.kind}:${t.ref?.id ?? i}`} data-touchpoint={t.kind}
                style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink)", padding: "8px 10px", borderRadius: 8, background: "var(--bg-tint)", border: "1px solid var(--line)", overflowWrap: "anywhere" }}>
                {t.text}
              </li>
            ))}
          </ul>
          {rest > 0 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)}
              style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer" }}>
              ほかに{rest}件
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function CandidatePreview({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/biz/candidates/${userId}/preview`);
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) { setError(res.status === 404 ? "この方は表示できません。" : (json.error ?? "読み込めませんでした")); return; }
        setData(json as PreviewData);
      } catch {
        if (alive) setError("読み込めませんでした");
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (error) return <div data-state="preview-error" style={{ padding: 20, fontSize: 13, color: "var(--ink-soft)" }}>{error}</div>;
  if (!data) return <div data-state="preview-loading" style={{ padding: 20, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</div>;

  const c = data.candidate;
  const tenure = formatTenure(c.tenureMonths);
  const label = candidateApproachLabel(c.approach);
  const edited = formatJstMonthDay(c.profileEditedAt);
  return (
    <div data-state="candidate-preview" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={neutralAvatarStyle(52, 20)}>{c.name.charAt(0) || "?"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{c.name}</h2>
            {tenure && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{tenure}</span>}
          </div>
          {(c.currentRole || c.currentCompany) && (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4, overflowWrap: "anywhere" }}>
              {[c.currentRole, c.currentCompany].filter(Boolean).join(" · ")}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "var(--ink-mute)" }}>
            {label && <span data-approach-state={label.state}>{label.text}</span>}
            {c.location && <span>{c.location}</span>}
            {edited && <span>プロフィール更新 {edited}</span>}
          </div>
          {/* ★受け取っていない人には、提案への入口を添える（2026-10-10 / 柴さんの文言）。⚠️ 理由は出さない */}
          {label?.state === "not_accepting" && (
            <div data-state="not-accepting-note" style={{ marginTop: 4, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
              条件が合えば、OPINIO から提案としてお届けすることがあります。{" "}
              <Link href="/biz/proposals" style={{ color: "var(--royal)", fontWeight: 700, textDecoration: "none" }}>提案を見る →</Link>
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="プレビューを閉じる"
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, padding: 4 }}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
        {/* ⚠️ 送れる・送り済みのときだけボタン（送り済みは状態の表示になる）。受け取っていない人には出さない */}
        {c.approach && (c.approach.eligible || c.approach.sent) && (
          <ApproachButton candidateUserId={c.id} sent={c.approach.sent} hideSender />
        )}
        <Link href={`/u/${c.id}`}
          style={{ fontSize: 13, color: "var(--royal)", fontWeight: 700, textDecoration: "none", padding: "9px 16px", borderRadius: 8, border: "1px solid var(--royal-100)", background: "var(--royal-50)", whiteSpace: "nowrap" }}>
          プロフィール全体を見る
        </Link>
      </div>

      <TouchpointSection touchpoints={c.touchpoints} materials={data.touchpointMaterials} />

      {c.headline && <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, overflowWrap: "anywhere" }}>{c.headline}</p>}

      {data.aboutMe && (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>自己紹介</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{data.aboutMe}</p>
        </section>
      )}

      {data.experiences.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>経歴</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {data.experiences.map((e) => (
              <li key={e.id} style={{ fontSize: 12.5, lineHeight: 1.6, borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
                <div style={{ fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{e.company ?? "—"}</div>
                {(e.roleTitle || e.roleName) && <div style={{ color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{[e.roleName, e.roleTitle].filter(Boolean).join(" · ")}</div>}
                {(e.startedAt || e.isCurrent) && (
                  <div style={{ color: "var(--ink-mute)" }}>{ym(e.startedAt)}〜{e.isCurrent ? "現在" : ym(e.endedAt)}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {((c.autoSkills ?? []).length > 0 || data.skills.length > 0) && (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>スキル</h3>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {(c.autoSkills ?? []).map((sk) => (
              <span key={`a:${sk.label}`} style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                {sk.label} <span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>{sk.band}</span>
              </span>
            ))}
            {data.skills.map((s) => (
              <span key={`s:${s}`} style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: "#fff", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>{s}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
