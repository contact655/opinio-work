"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StanceMeter } from "@/components/candidates/StanceMeter";
import { PreviewApproachArea } from "@/components/approaches/PreviewApproachArea";
import { CandidateProfilePanel, type PanelTab } from "@/components/candidates/CandidateProfilePanel";
import { CandidateNotesPreview } from "@/components/candidateNotes/CandidateNotesPreview";
import { formatJstMonthDay, type Candidate, type Touchpoint, type TouchpointMaterials } from "@/lib/business/candidates/model";
import { CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";
import { ACTIVITY_LABELS } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1・キャンバス1）。
 *
 * ★2026-10-13（柴さんの指示）: **一覧が持っている Candidate をそのまま描く。** それまでは1人分のために
 *   `/api/biz/candidates/[userId]/preview` が `loadCompanyCandidates` を丸ごと呼び直していた（1人あたり約30本）。
 *   いま API から取るのは一覧に無いもの（この会社との接点）だけ。プロフィールの中身は `renderCandidateProfile`。
 * ⚠️★声かけのボタンは `ApproachButton`（一覧と同じ部品）。送れるかは `approach.eligible` だけを見る。
 * ⚠️ 「プロフィール全体を見る」は**同じタブ**で /u/[id]。
 * ⚠️ 接点（見出し「〈会社名〉と合うところ（〇）」）は強い順に2つまで。それより多ければ「ほか N件」で全部。
 *    ★0件のときは見出しごと出さない（2026-10-11 / 柴さんの指示）。
 * ⚠️★送れない人は、ボタンの代わりに灰色の1行で理由だけ出す（2026-10-11 / 柴さんの指示。`PreviewApproachArea`）。状態のチップは出さない。
 */
/** この会社との接点（選考管理と同じ）。最新1件＋ほかの件数。無ければ null */
export type PreviewContacts = { latest: { at: string; title: string }; more: number } | null;

/* ★「プロフィール／メッセージ」のタブ（2026-10-13 / 柴さんの指示）。
      ★最初に開くタブは**常にプロフィール**（2026-10-13 に変えた。それまでは返信がある人はメッセージで開いていた）。
      ⚠️★メッセージのタブの中身は**一度開くまで描かない**（取りに行く本数を減らすため）。
      ★既読（2026-10-13）: やり取りは既読を付けずに読む（`?thread=1&read=0`）。付けるのはメッセージ欄で
         入力欄にフォーカス・スクロール・送信したときだけ（`PreviewApproachArea` の SentDock）。
         タブを開いただけ・段3で表示されただけでは付けない。
      ⚠️ タブは URL の `?tab=` に残す（戻る・リンクの共有で同じタブ）。書き方は `?selected=` と同じ history.replaceState。
         別の人を選ぶと一覧側が `tab` を外す（`updateSelected`）＝プロフィールで開く */
function tabFromUrl(userId: string): PanelTab | null {
  try {
    const sp = new URL(window.location.href).searchParams;
    if (sp.get("selected") !== userId) return null;
    const t = sp.get("tab");
    return t === "messages" || t === "profile" ? t : null;
  } catch { return null; }
}
function writeTabToUrl(tab: PanelTab) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch { /* URL を書けなくても表示は続ける */ }
}

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
  position_level: "レベル", business_stage: "事業ステージ",
};
/** ★求人の職種のうち、求める経験年数を満たしたもの（2026-10-12）は「経験年数」と出す */
function touchpointCategory(t: Touchpoint): string {
  if (t.fact?.kind === "job_role" && t.fact.requiredYears) return "経験年数";
  return TOUCHPOINT_CATEGORY[t.kind] ?? "";
}

/**
 * ★「合うところ」が0件の候補者に出す案内（2026-10-12 / 柴さんの指示）。灰色の1行。
 *   会社側のデータが足りないときだけ出す（足しても合う人が増えないなら出さない）。
 * ⚠️ 取れなかった（materials が null・touchpoints が undefined）ときは出さない。
 */
export function TouchpointGuide({ touchpoints, materials }: { touchpoints: Touchpoint[] | undefined; materials: TouchpointMaterials | null }) {
  if (!touchpoints || touchpoints.length > 0 || !materials) return null;
  const line = materials.hasUnlinkedCompanyRoles
    ? { href: "/biz/organization?tab=roles", text: "部門・職種で標準の職種を選ぶと、合う候補者が見つかりやすくなります" }
    : materials.hasJobs && materials.hasJobsWithoutYears
      ? { href: "/biz/jobs", text: "求人に経験年数を入れると、合う候補者が見つかりやすくなります" }
      : null;
  if (!line) return null;
  return (
    <p data-state="touchpoint-guide" style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-mute)" }}>
      <a href={line.href} style={{ color: "inherit", textDecoration: "none" }}>{line.text} ›</a>
    </p>
  );
}

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
            <span style={{ flexShrink: 0, fontWeight: 700, whiteSpace: "nowrap" }}>{touchpointCategory(t)}</span>
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

/** ★右欄の上の段に固定する操作（2026-10-13）。状態は一覧（CandidatesClient）が持つ */
export type PreviewActions = {
  starred: boolean;
  onToggleStar: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  /** 一覧の中の位置（0始まり）。一覧に居なければ -1 */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function CandidatePreview({ candidate: c, onClose, onNoteCountChange, companyLimitLine = null, canAct = true,
  companyShortName = null, touchpointMaterials = null, approachJobs = [], notesEnabled = false, actions, layout = "tabs", onMessagesRead }: {
  /** ★右欄の形（2026-10-13）。"tabs" … 段1・段2（プロフィール／メッセージのタブ）／ "columns" … 段3（2列を同時に） */
  layout?: "tabs" | "columns";
  /** ★既読を付けたあと（一覧の「返信あり・未読」を消す） */
  onMessagesRead?: () => void;
  /** ★一覧が持っている候補者（2026-10-13。API で取り直さない） */
  candidate: Candidate;
  onClose: () => void; onNoteCountChange?: (count: number) => void;
  /** ★メッセージを送れるか（2026-10-12。閲覧のみは false。送る欄ごと出さない） */
  canAct?: boolean;
  /** ★企業側の上限に当たっているときの1行（`approachCompanyLimitLine`）。当たっていなければ null */
  companyLimitLine?: string | null;
  /** ★「〈会社名〉と合うところ」の会社名。取れなければ null（「貴社と合うところ」） */
  companyShortName?: string | null;
  touchpointMaterials?: TouchpointMaterials | null;
  approachJobs?: { id: string; title: string }[];
  /** ★社内メモの欄を出すか（CANDIDATE_NOTES_ENABLED） */
  notesEnabled?: boolean;
  actions: PreviewActions;
}) {
  const [contacts, setContacts] = useState<PreviewContacts>(null);
  /* ★タブ。null のあいだは URL（`?tab=`）→ 無ければプロフィール */
  const [tab, setTab] = useState<PanelTab | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const activeTab: PanelTab = tab ?? tabFromUrl(c.id) ?? "profile";
  /* ★メッセージのタブを一度でも開いたか。⚠️ 開くまで中身を描かない（描くと既読が付く） */
  const [messagesMounted, setMessagesMounted] = useState(activeTab === "messages");
  /* ★「メッセージを送る」から来たら送る欄を開いた状態にする（値が変わったときだけ。ui-debugging ⑭） */
  const [openFormNonce, setOpenFormNonce] = useState(0);
  const changeTab = useCallback((t: PanelTab) => { setTab(t); writeTabToUrl(t); if (t === "messages") setMessagesMounted(true); }, []);
  const columns = layout === "columns";
  /* ★既読を付けたか（2026-10-13）。⚠️ 表示しただけ・タブを開いただけでは付かない（入力欄にフォーカス・スクロール・送信のときだけ） */
  const [readNow, setReadNow] = useState(false);
  const handleRead = useCallback(() => { setReadNow(true); onMessagesRead?.(); }, [onMessagesRead]);

  /* ★この会社との接点だけを取る（一覧に無い唯一のもの）。⚠️ 取れなければ行を出さない */
  useEffect(() => {
    let alive = true;
    setContacts(null);
    fetch(`/api/biz/candidates/${c.id}/preview`)
      .then(async (res) => { const j = await res.json().catch(() => null); if (alive && res.ok && j) setContacts((j.contacts ?? null) as PreviewContacts); })
      .catch(() => { /* 行を出さないだけ */ });
    return () => { alive = false; };
  }, [c.id]);

  /* ★メッセージのタブを開いたら、いちばん新しいやり取り（と返信欄）までスクロールする（2026-10-13）。
        ⚠️ やり取りは後から読み込まれるので、出るまで待ってから動かす。⚠️ rAF にしない（非表示のタブでは発火しない。ui-debugging ⑪） */
  useEffect(() => {
    if (activeTab !== "messages" && !columns) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const box = messagesScrollRef.current;
      if (box?.querySelector("[data-state=pane-thread]")) { clearInterval(t); setTimeout(() => { box.scrollTop = box.scrollHeight; }, 60); }
      else if (tries > 50) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [activeTab, columns]);

  const tenure = formatTenure(c.tenureMonths);
  const edited = formatJstMonthDay(c.profileEditedAt);
  /* ★メッセージのタブは送れる人（`approach` がある）にだけ。閲覧のみ・判定が取れない人はプロフィールだけ */
  const showMessages = canAct && !!c.approach;
  /* ★未読（2026-10-13）。あるときだけタブのラベル右に小さな丸（数字は出さない。ui-conventions「タブ」）。
        見ている担当者の未読 ∪ 自社の誰も開いていない返信。⚠️ 一度開いたら消す */
  const unreadDot = !readNow && ((c.approach?.unreadCount ?? 0) > 0 || c.approach?.unseenReply === true);
  const meta = [c.age != null ? `${c.age}歳` : null, c.genderLabel ?? null, tenure, [c.currentRole, c.currentCompany].filter(Boolean).join(" · ") || null, c.location, edited ? `プロフィール更新 ${edited}` : null].filter(Boolean).join("　");

  /* ★メッセージのボタン（上の段）。やり取りがあれば「メッセージを続ける」、送れる人は「メッセージを送る」。
        ⚠️ 送れない人・送り済みで返信の無い人には「送る」を出さない（理由はメッセージのタブに灰色の1行で出る） */
  const a = c.approach;
  const messageButton = !showMessages || !a ? null
    : a.sent ? { label: a.sent.state === "accepted" ? "メッセージを続ける" : "送ったメッセージを見る", onClick: () => { if (!columns) changeTab("messages"); } }
    : a.eligible && !companyLimitLine ? { label: "メッセージを送る", onClick: () => { if (!columns) changeTab("messages"); setOpenFormNonce((n) => n + 1); } }
    : null;

  return (
    <CandidateProfilePanel
      userId={c.id}
      name={c.name}
      avatarUrl={c.avatarUrl ?? null}
      meta={meta || null}
      onClose={onClose}
      topBar={<PreviewActionBar canAct={canAct} actions={actions} messageButton={messageButton} />}
      headerExtra={<PreviewHeaderLines candidate={c} contacts={contacts} />}
      sectioned
      before={<>
        <TransferPrefsBox candidate={c} />
        <TouchpointSection touchpoints={c.touchpoints} companyShortName={companyShortName} />
        <TouchpointGuide touchpoints={c.touchpoints} materials={touchpointMaterials} />
      </>}
      extraSections={notesEnabled ? [{ key: "notes", label: "メモ", body: <CandidateNotesPreview candidateUserId={c.id} candidateName={c.name} onCountChange={onNoteCountChange} /> }] : undefined}
      columns={showMessages && columns ? {
        messagesDot: unreadDot,
        messagesScrollRef,
        messages: (
          <section data-panel-section="messages">
            <PreviewApproachArea candidate={c} jobs={approachJobs} limitLine={companyLimitLine} openNonce={openFormNonce} onRead={handleRead} />
          </section>
        ),
      } : undefined}
      tabs={showMessages && !columns ? {
        active: activeTab,
        onChange: changeTab,
        messagesDot: unreadDot,
        messagesScrollRef,
        messages: messagesMounted ? (
          <section data-panel-section="messages">
            <PreviewApproachArea candidate={c} jobs={approachJobs} limitLine={companyLimitLine} openNonce={openFormNonce} onRead={handleRead} />
          </section>
        ) : null,
      } : undefined}
    />
  );
}

/**
 * ★右欄の上の段（2026-10-13 / 柴さんの指示）。［メッセージ］［☆ 気になる］［見送り］ … 右端に［‹］「2 / 19」［›］。
 * ⚠️ ‹ › は一覧の J/K と同じ移動（`CandidatesClient` の moveSelection）。端では押せない。
 * ⚠️ アイコンだけのボタンには aria-label。⚠️ 閲覧のみ（canAct=false）は ‹ › だけ。
 * ⚠️ 「選考に追加」は置かない（API が無い。2026-10-13）。
 */
function PreviewActionBar({ canAct, actions, messageButton }: {
  canAct: boolean; actions: PreviewActions;
  messageButton: { label: string; onClick: () => void } | null;
}) {
  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600,
    fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  };
  const nav = (disabled: boolean): React.CSSProperties => ({
    ...btn, width: 32, padding: 0, justifyContent: "center", fontSize: 16,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  });
  const { index, total } = actions;
  const prevDisabled = index <= 0;
  const nextDisabled = index < 0 || index >= total - 1;
  return (
    <div data-state="preview-action-bar" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {canAct && messageButton && (
        <button type="button" onClick={messageButton.onClick} data-state="bar-message" className="btn-fixed-size"
          style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 700 }}>
          {messageButton.label}
        </button>
      )}
      {canAct && (
        <button type="button" onClick={actions.onToggleStar} aria-pressed={actions.starred} data-state={actions.starred ? "bar-star-on" : "bar-star-off"}
          title="社内で共有・ご本人には通知されません" className="btn-fixed-size"
          style={{ ...btn, color: actions.starred ? "var(--royal)" : "var(--ink-soft)", borderColor: actions.starred ? "var(--royal)" : "var(--line)" }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={actions.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
          </svg>
          気になる
        </button>
      )}
      {canAct && (
        <button type="button" onClick={actions.onToggleHidden} aria-pressed={actions.hidden} data-state={actions.hidden ? "bar-unhide" : "bar-hide"}
          title="一覧から外します（社内だけ・ご本人には伝わりません）" className="btn-fixed-size" style={btn}>
          {actions.hidden ? "見送りを解除" : "見送り"}
        </button>
      )}
      <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button type="button" onClick={actions.onPrev} disabled={prevDisabled} aria-label="前の候補者" data-state="bar-prev" className="btn-fixed-size" style={nav(prevDisabled)}>‹</button>
        <span data-state="bar-position" style={{ fontSize: 12.5, color: "var(--ink-mute)", minWidth: 48, textAlign: "center", fontFamily: "var(--font-inter), var(--font-noto)" }}>
          {index >= 0 ? `${index + 1} / ${total}` : `– / ${total}`}
        </span>
        <button type="button" onClick={actions.onNext} disabled={nextDisabled} aria-label="次の候補者" data-state="bar-next" className="btn-fixed-size" style={nav(nextDisabled)}>›</button>
      </div>
    </div>
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
  contacts: PreviewContacts;
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
