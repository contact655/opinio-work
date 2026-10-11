"use client";

import { useEffect, useState } from "react";
import { PreviewApproachArea } from "@/components/approaches/PreviewApproachArea";
import { CandidateProfilePanel } from "@/components/candidates/CandidateProfilePanel";
import { CandidateNotesPreview } from "@/components/candidateNotes/CandidateNotesPreview";
import { formatJstMonthDay, type Candidate, type Touchpoint, type TouchpointMaterials } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1・キャンバス1）。
 *
 * ⚠️ 中身は `/api/biz/candidates/[userId]/preview` から取る（一覧と同じ判定を通った人だけ返る）。
 * ⚠️★声かけのボタンは `ApproachButton`（一覧と同じ部品）。送れるかは `approach.eligible` だけを見る。
 * ⚠️ 「プロフィール全体を見る」は**同じタブ**で /u/[id]。
 * ⚠️ 接点（見出し「〈会社名〉と合うところ（〇）」）は強い順に3つまで。4つ以上なら「ほかに N件」で全部。
 *    ★0件のときは見出しごと出さない（2026-10-11 / 柴さんの指示。それまでは空でも欄を出し、材料への入口を出していた）。
 * ⚠️★送れない人は、ボタンの代わりに灰色の1行で理由だけ出す（2026-10-11 / 柴さんの指示。`PreviewApproachArea`）。状態のチップは出さない。
 */
export type PreviewData = {
  candidate: Candidate;
  aboutMe: string | null;
  experiences: { id: string; company: string | null; roleTitle: string | null; roleName: string | null; startedAt: string | null; endedAt: string | null; isCurrent: boolean }[];
  skills: string[];
  touchpointMaterials: TouchpointMaterials | null;
  approachJobs: { id: string; title: string }[];
  /** ★「〈会社名〉と合うところ」の会社名（法人格を外した表示名）。取れなければ null（「貴社と合うところ」） */
  companyShortName?: string | null;
  /** ★社内メモの欄を出すか（CANDIDATE_NOTES_ENABLED） */
  notesEnabled?: boolean;
};

const TOUCHPOINT_INITIAL = 3;


function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/**
 * 「〈会社名〉と合うところ（〇）」の欄（2026-10-11 に「貴社との接点」から改めた）。
 * ⚠️ （〇）は項目の数。％や点数は出さない。⚠️ 0件・取れなかった（undefined）ときは見出しごと出さない。
 * ⚠️ プレビューの部品として切り出してある（/dev/preview から使う）
 */
export function TouchpointSection({ touchpoints, companyShortName }: { touchpoints: Touchpoint[] | undefined; companyShortName: string | null }) {
  const [showAll, setShowAll] = useState(false);
  if (!touchpoints || touchpoints.length === 0) return null;
  const shown = showAll ? touchpoints : touchpoints.slice(0, TOUCHPOINT_INITIAL);
  const rest = touchpoints.length - TOUCHPOINT_INITIAL;
  return (
    <section data-state="touchpoints" style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>
        {companyShortName ?? "貴社"}と合うところ（{touchpoints.length}）
      </h3>
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
    </section>
  );
}

export function CandidatePreview({ userId, onClose, onNoteCountChange, companyLimitLine = null }: { userId: string; onClose: () => void; onNoteCountChange?: (count: number) => void;
  /** ★企業側の上限に当たっているときの1行（`approachCompanyLimitLine`）。当たっていなければ null */
  companyLimitLine?: string | null }) {
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
  const edited = formatJstMonthDay(c.profileEditedAt);
  const meta = [tenure, [c.currentRole, c.currentCompany].filter(Boolean).join(" · ") || null, c.location, edited ? `プロフィール更新 ${edited}` : null].filter(Boolean).join(" ・ ");
  /* ★右欄でプロフィール全体を見せる（2026-10-11 / 柴さんの指示）。中身は /u/[id] と同じ関数（`CandidateProfilePanel`）。
        名前とボタンの段は固定、中身だけスクロール。⚠️ 自己紹介・経歴・スキルの一覧はプロフィールの中に出るので、ここでは出さない（二重にしない） */
  return (
    <CandidateProfilePanel
      userId={c.id}
      name={c.name}
      meta={meta || null}
      onClose={onClose}
      headerExtra={<PreviewApproachArea candidate={c} jobs={data.approachJobs} limitLine={companyLimitLine} />}
      before={<>
        <TouchpointSection touchpoints={c.touchpoints} companyShortName={data.companyShortName ?? null} />
        {/* ★社内メモ（2026-10-11）。⚠️ フラグがオフなら出さない。⚠️ プロフィールの中（/u/[id]）の社内メモは右欄では出さない（embed） */}
        {data.notesEnabled && <CandidateNotesPreview candidateUserId={c.id} candidateName={c.name} onCountChange={onNoteCountChange} />}
      </>}
    />
  );
}
