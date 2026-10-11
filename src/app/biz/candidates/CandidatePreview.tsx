"use client";

import { useEffect, useState } from "react";
import { PreviewApproachArea } from "@/components/approaches/PreviewApproachArea";
import { CandidateProfilePanel } from "@/components/candidates/CandidateProfilePanel";
import { CandidateNotesPreview } from "@/components/candidateNotes/CandidateNotesPreview";
import { formatJstMonthDay, type Candidate, type Touchpoint, type TouchpointMaterials } from "@/lib/business/candidates/model";
import { CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";
import { ACTIVITY_LABELS } from "@/lib/business/candidates/model";

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
  /** ★この会社との接点（選考管理と同じ）。最新1件＋ほかの件数。無ければ null */
  contacts?: { latest: { at: string; title: string }; more: number } | null;
};

/** ★最初に全文で出す件数（2026-10-12 に 3 → 2）。それより多ければ「ほかn件」で、押すとその場で全部 */
const TOUCHPOINT_INITIAL = 2;


function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/**
 * 「〈会社名〉と合うところ（〇）」の欄（2026-10-11 に「貴社との接点」から改めた）。
 * ⚠️ （〇）は項目の数。％や点数は出さない。⚠️ 0件・取れなかった（undefined）ときは見出しごと出さない。
 * ⚠️ プレビューの部品として切り出してある（/dev/preview から使う）
 * ★右欄では開閉させずに、プロフィールの先頭に常に出す（2026-10-12 / 柴さんの指示）。2件まで全文・3件以上は「ほかn件」
 */
export function TouchpointSection({ touchpoints, companyShortName }: { touchpoints: Touchpoint[] | undefined; companyShortName: string | null }) {
  const [showAll, setShowAll] = useState(false);
  if (!touchpoints || touchpoints.length === 0) return null;
  const shown = showAll ? touchpoints : touchpoints.slice(0, TOUCHPOINT_INITIAL);
  const rest = touchpoints.length - TOUCHPOINT_INITIAL;
  return (
    <section data-state="touchpoints" style={{ padding: "14px 0 4px" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>
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
          ほか{rest}件
        </button>
      )}
    </section>
  );
}

export function CandidatePreview({ userId, onClose, onNoteCountChange, companyLimitLine = null, nameAction }: { userId: string; onClose: () => void; onNoteCountChange?: (count: number) => void;
  /** ★名前の右に置くもの（★ボタン。状態は一覧側が持つ） */
  nameAction?: React.ReactNode;
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
  /* ★年齢（2026-10-12 から出す）。⚠️ サーバーで計算した数（Candidate.age）。生年月日が無い人は出さない */
  const meta = [c.age != null ? `${c.age}歳` : null, tenure, [c.currentRole, c.currentCompany].filter(Boolean).join(" · ") || null, c.location, edited ? `プロフィール更新 ${edited}` : null].filter(Boolean).join(" ・ ");
  /* ★右欄は「上：誰か／中：プロフィール／下：メッセージ」の3段（2026-10-12 / 柴さんの指示）。
        上（固定）… 名前・2行目（今のまま）・3行目（転職への意向・最近の利用）・4行目（この会社との接点）
        中（ここだけスクロール）… 先頭に「〈会社名〉と合うところ」（開閉なし）、続けて 職歴 → スキル → 自己紹介 → 学歴 → その他
          （＋社内メモが有効なら「メモ」）を1本で。上に節へのリンクの帯。中身と判定は /u/[id] と同じ
        下（固定）… メッセージ欄（`PreviewApproachArea`） */
  return (
    <CandidateProfilePanel
      userId={c.id}
      name={c.name}
      meta={meta || null}
      onClose={onClose}
      nameAction={nameAction}
      headerExtra={<PreviewHeaderLines candidate={c} contacts={data.contacts ?? null} />}
      sectioned
      before={<TouchpointSection touchpoints={c.touchpoints} companyShortName={data.companyShortName ?? null} />}
      extraSections={data.notesEnabled ? [{ key: "notes", label: "メモ", body: <CandidateNotesPreview candidateUserId={c.id} candidateName={c.name} onCountChange={onNoteCountChange} /> }] : undefined}
      footer={c.approach ? <PreviewApproachArea candidate={c} jobs={data.approachJobs} limitLine={companyLimitLine} /> : undefined}
    />
  );
}

/**
 * ★上の段の3・4行目（2026-10-12）。どれも灰色の文字（バッジにしない）。値が無い項目は出さない。
 *   3行目 … 転職への意向（`CAREER_STANCE_LABELS`）・最近の利用
 *   ⚠️ 「〈会社名〉と合うところ」は 2026-10-12 にここから外し、プロフィールの先頭に常に出す形にした（`TouchpointSection`）
 *   4行目 … この会社との接点（選考管理の「この会社とのこれまで」と同じ。最新1件＋「ほかn件」）
 * ⚠️ /dev/preview/candidate-touchpoints から使う（Third Box の実データには接点が無く、4行目を描けないため）
 */
export function PreviewHeaderLines({ candidate, contacts }: {
  candidate: Candidate;
  contacts: PreviewData["contacts"];
}) {
  const stanceLabel = candidate.careerStance ? CAREER_STANCE_LABELS[candidate.careerStance] ?? null : null;
  /* ★「情報収集として（9月30日に更新）」（2026-10-12）。⚠️ 更新日時が無い（不明）なら日付を付けない */
  const stanceDate = formatJstMonthDay(candidate.careerStanceUpdatedAt);
  const stance = stanceLabel ? (stanceDate ? `${stanceLabel}（${stanceDate}に更新）` : stanceLabel) : null;
  /* ★最近の利用（2026-10-12）。⚠️ スイッチが無効なら undefined で何も出さない。記録が無い（null）も出さない */
  const activityText = candidate.activity ? ACTIVITY_LABELS[candidate.activity] : null;
  const gray: React.CSSProperties = { fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 };
  if (!stance && !contacts && !activityText) return null;
  return (
    <div data-state="preview-header-lines" style={{ marginTop: 4 }}>
      {(stance || activityText) && (
        <div style={{ ...gray, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {stance && <span data-state="header-stance">{stance}</span>}
          {activityText && <>{stance && <span aria-hidden="true">・</span>}<span data-state="header-activity">{activityText}</span></>}
        </div>
      )}
      {contacts && (
        <div data-state="header-contacts" style={gray}>
          この会社との接点：{formatYm(contacts.latest.at)} {contacts.latest.title}{contacts.more > 0 ? `（ほか${contacts.more}件）` : ""}
        </div>
      )}
    </div>
  );
}

/** 「2025年3月」（日本時間） */
function formatYm(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}年${p.month}月`;
}
