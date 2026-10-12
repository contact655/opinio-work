"use client";

import { useEffect, useState } from "react";
import { StanceMeter } from "@/components/candidates/StanceMeter";
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

/** ★合うところの分類（太字で頭に出す）。判定の種類（kind）を名前にしただけで、判定は変えていない */
const TOUCHPOINT_CATEGORY: Record<Touchpoint["kind"], string> = {
  job_role: "職種", company_role: "職種", location: "勤務地", target_industry: "業界", business_domain: "事業領域", alumni: "出身",
};

/**
 * 「〈会社名〉と合うところ（〇）」の枠（2026-10-11 に「貴社との接点」から改めた）。
 * ★2026-10-12（柴さんの指示）: 薄い青の背景の枠に、1件1行で「✓ 分類（太字）文」。2件まで全文、3件以上は「ほかn件」（その場で展開）。
 * ⚠️ 判定（`touchpoints.ts`）は変えていない。見せ方だけ。AI は使っていない（決まった規則で突き合わせて、決まった文を組む）。
 * ⚠️ （〇）は項目の数。％や点数は出さない。⚠️ 0件・取れなかった（undefined）ときは枠ごと出さない。
 * ⚠️ プレビューの部品として切り出してある（/dev/preview から使う）
 */
export function TouchpointSection({ touchpoints, companyShortName }: { touchpoints: Touchpoint[] | undefined; companyShortName: string | null }) {
  const [showAll, setShowAll] = useState(false);
  if (!touchpoints || touchpoints.length === 0) return null;
  const shown = showAll ? touchpoints : touchpoints.slice(0, TOUCHPOINT_INITIAL);
  const rest = touchpoints.length - TOUCHPOINT_INITIAL;
  return (
    <section data-state="touchpoints" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "var(--royal-50)", border: "1px solid var(--royal-100)" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>
        {companyShortName ?? "貴社"}と合うところ（{touchpoints.length}）
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((t, i) => (
          <li key={`${t.kind}:${t.ref?.id ?? i}`} data-touchpoint={t.kind}
            style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 13, lineHeight: 1.6, color: "var(--ink)", overflowWrap: "anywhere" }}>
            <span aria-hidden="true" style={{ flexShrink: 0, color: "var(--royal)", fontWeight: 700 }}>✓</span>
            <span style={{ flexShrink: 0, fontWeight: 700, whiteSpace: "nowrap" }}>{TOUCHPOINT_CATEGORY[t.kind] ?? ""}</span>
            <span style={{ minWidth: 0 }}>{t.text}</span>
          </li>
        ))}
      </ul>
      {rest > 0 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} data-state="touchpoints-more"
          style={{ marginTop: 6, padding: 0, border: "none", background: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", color: "var(--royal)", cursor: "pointer" }}>
          ほか{rest}件
        </button>
      )}
    </section>
  );
}

/**
 * ★「転職について」の枠（2026-10-12 / 柴さんの指示）。名前の段の下に、企業に見せてよい転職関連の回答を「項目名｜値」で並べる。
 * ⚠️★出すのは、規約で企業の画面に出すと決めてあるものだけ（プライバシーポリシー 5-1 の別表「候補者の詳細」）:
 *    関心のある職種（`desiredRoleNames`）・希望勤務地（`desiredPrefectures`）。
 *    ⚠️ 希望年収・雇用形態・希望の働き方は「絞り込みに使われる項目（画面に表示されないもの）」なので**出さない**。
 *    ⚠️ 希望の時期（`transfer_timing`）は 2026-08-27 に本人の入力欄を外しており、読んでいない（出さない）。
 *    項目を足すときは、先に規約の別表に入っているかを確かめること。
 * ⚠️ 値が無い項目は出さない。全部空なら枠ごと出さない。転職への意向は上の段（目印つき）に出すので、ここには重ねない。
 */
export function TransferPrefsBox({ candidate }: { candidate: Candidate }) {
  const rows: { label: string; value: string }[] = [];
  if (candidate.desiredRoleNames.length > 0) rows.push({ label: "関心のある職種", value: candidate.desiredRoleNames.join("・") });
  if (candidate.desiredPrefectures && candidate.desiredPrefectures.length > 0) rows.push({ label: "希望勤務地", value: candidate.desiredPrefectures.join("・") });
  if (rows.length === 0) return null;
  return (
    <section data-state="transfer-prefs" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>転職について</h3>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", columnGap: 14, rowGap: 4, fontSize: 13, lineHeight: 1.6 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "contents" }}>
            <dt style={{ color: "var(--ink-mute)" }}>{r.label}</dt>
            <dd style={{ margin: 0, color: "var(--ink)", overflowWrap: "anywhere" }}>{r.value}</dd>
          </div>
        ))}
      </dl>
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
  /* ★メッセージ欄を右欄いっぱいに広げているか（候補者を切り替えると key で作り直されて戻る） */
  const [dockExpanded, setDockExpanded] = useState(false);

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
  const meta = [c.age != null ? `${c.age}歳` : null, c.genderLabel ?? null, tenure, [c.currentRole, c.currentCompany].filter(Boolean).join(" · ") || null, c.location, edited ? `プロフィール更新 ${edited}` : null].filter(Boolean).join(" ・ ");
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
      before={<>
        <TransferPrefsBox candidate={c} />
        <TouchpointSection touchpoints={c.touchpoints} companyShortName={data.companyShortName ?? null} />
      </>}
      extraSections={data.notesEnabled ? [{ key: "notes", label: "メモ", body: <CandidateNotesPreview candidateUserId={c.id} candidateName={c.name} onCountChange={onNoteCountChange} /> }] : undefined}
      footer={c.approach ? <PreviewApproachArea candidate={c} jobs={data.approachJobs} limitLine={companyLimitLine} expanded={dockExpanded} onExpandChange={setDockExpanded} /> : undefined}
      footerExpanded={dockExpanded}
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
  const stance = stanceLabel;
  /* ★最近の利用（2026-10-12）。⚠️ スイッチが無効なら undefined で何も出さない。記録が無い（null）も出さない */
  const activityText = candidate.activity ? ACTIVITY_LABELS[candidate.activity] : null;
  const gray: React.CSSProperties = { fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 };
  if (!stance && !contacts && !activityText) return null;
  return (
    <div data-state="preview-header-lines" style={{ marginTop: 4 }}>
      {(stance || activityText) && (
        <div style={{ ...gray, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {stance && (
            <span data-state="header-stance" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <StanceMeter stance={candidate.careerStance} size={8} />
              <span>{stance}</span>
              {stanceDate && <span>{stanceDate}に更新</span>}
            </span>
          )}
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
