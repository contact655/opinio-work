"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StanceBadge } from "@/components/candidates/StanceMeter";
import { PreviewApproachArea } from "@/components/approaches/PreviewApproachArea";
import { PositionFitBox } from "@/components/candidates/PositionFitBox";
import { StarButton } from "@/components/candidates/StarButton";
import type { PositionFitItem } from "@/lib/business/candidates/positionFitModel";
import { CandidateProfilePanel, type PanelTab } from "@/components/candidates/CandidateProfilePanel";
import { CandidateNotesPreview } from "@/components/candidateNotes/CandidateNotesPreview";
import { formatJstMonthDay, type Candidate, type CompanyContactItem } from "@/lib/business/candidates/model";
import { ACTIVITY_LABELS } from "@/lib/business/candidates/model";
import { tenureMonths } from "@/lib/profile/tenure";

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

/* ⚠️ 2026-10-13: 右欄の「合うところ」は「ほか○件」で隠さず全件（表）。カードは一番重い理由1つ＋「ほか○件」 */


function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/**
 * ★「自社との接点」の欄（2026-10-28 / 柴さんの指示）。それまでの緑の「合うところ」の箱と、要約の4マス目「自社との接点」をここに1つにまとめた。
 *   ・元社員／「話を聞いてみたい」を御社に送っている／人の流れ（〇〇から御社に入社した人 N人。5人以上のときだけ）
 *     … サーバーの lib/business/candidates/companyContacts.ts が作る（Candidate.companyContacts）
 *   ・これまでのやり取り（応募・面談など。選考管理と同じ。最新1件＋ほかn件）… プレビューの API から
 *   ・どれも無ければ「なし」。⚠️ 取れなかったとき（companyContacts が undefined）は「—」（「なし」と言わない）
 * ⚠️ 保存（ブックマーク）は出さない（ポリシーの案で、保存は企業に何も渡さないと決めている）。
 * ⚠️ 色で強調しない（灰色の枠）。緑は「プラスの一致」の色で、ここは事実を並べるだけ
 */
export function CompanyContactsSection({ contacts, history }: { contacts: CompanyContactItem[] | undefined; history: PreviewContacts }) {
  const lines: { key: string; text: string }[] = (contacts ?? []).map((c, i) => ({ key: `${c.kind}-${i}`, text: c.text }));
  if (history) lines.push({ key: "history", text: `これまでのやり取り：${formatYm(history.latest.at)} ${history.latest.title}${history.more > 0 ? `（ほか${history.more}件）` : ""}` });
  return (
    <section data-state="company-contacts" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>自社との接点</h3>
      {lines.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {lines.map((l) => <li key={l.key} data-state={`contact-${l.key}`} style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)", overflowWrap: "anywhere" }}>{l.text}</li>)}
        </ul>
      ) : (
        <p data-state={contacts === undefined ? "contacts-unknown" : "contacts-none"} style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>{contacts === undefined ? "—" : "なし"}</p>
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
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>転職意欲</h3>
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
  /** 一覧の中の位置（0始まり）。一覧に居なければ -1 */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function CandidatePreview({ candidate: c, onClose, onNoteCountChange, canAct = true,
  approachJobs = [], notesEnabled = false, actions, layout = "tabs", onMessagesRead, columnsStorageKey = null, positionFit = null }: {
  /** ★一覧の上で選んでいるポジションに対する合うところ（2026-10-18）。選んでいなければ null */
  positionFit?: { title: string; items: PositionFitItem[] } | null;
  /** ★2列表示の比率を覚えるキー（CandidatesClient から。2026-10-13） */
  columnsStorageKey?: string | null;
  /** ★右欄の形（2026-10-13）。"tabs" … 段1・段2（プロフィール／メッセージのタブ）／ "columns" … 段3（2列を同時に） */
  layout?: "tabs" | "columns";
  /** ★既読を付けたあと（一覧の「返信あり・未読」を消す） */
  onMessagesRead?: () => void;
  /** ★一覧が持っている候補者（2026-10-13。API で取り直さない） */
  candidate: Candidate;
  onClose: () => void; onNoteCountChange?: (count: number) => void;
  /** ★メッセージを送れるか（2026-10-12。閲覧のみは false。送る欄ごと出さない） */
  canAct?: boolean;
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
  /* ⚠️ 上の段の「メッセージを送る」を 2026-10-28 に外したので、送る欄を開く合図は今は出ない（0 のまま） */
  const [openFormNonce] = useState(0);
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
  /* ★項目ごとに折り返さない（「東京／都」のように1つの項目の途中で割れない。2026-10-13）。項目と項目の間でだけ折り返す */
  /* ★最近の利用（2026-10-12）は 2026-10-13 にこの行の末尾へ移した（意向バッジを名前の行へ移し、バッジと並べていた行が無くなったため）。
        ⚠️ スイッチが無効なら undefined で何も出さない。記録が無い（null）も出さない */
  const activityText = c.activity ? ACTIVITY_LABELS[c.activity] : null;
  const metaItems = [c.age != null ? `${c.age}歳` : null, c.genderLabel ?? null, tenure, [c.currentRole, c.currentCompany].filter(Boolean).join(" · ") || null, c.location, edited ? `プロフィール更新 ${edited}` : null, activityText].filter((x): x is string => !!x);
  const meta = metaItems.length ? (
    <span data-state="preview-meta" style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 2, minWidth: 0 }}>
      {/* ⚠️ 1項目が行より長いとき（長い役職・社名）は省略記号で切る（全文は title）。2026-10-13 に枠からはみ出していたのを直した */}
      {metaItems.map((m) => <span key={m} title={m} style={{ whiteSpace: "nowrap", maxWidth: "100%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{m}</span>)}
    </span>
  ) : null;

  /* ⚠️ 上の段の「メッセージを送る」は 2026-10-28 に外した（柴さんの指示）。送るのはメッセージの欄（右の列・タブ）から */

  return (
    <CandidateProfilePanel
      userId={c.id}
      name={c.name}
      avatarUrl={c.avatarUrl ?? null}
      avatarColorByName
      meta={meta}
      /* ★意向バッジは名前の行（氏名・新しいタブのアイコンの右）に置く（2026-10-13 柴さん判断で変更：
            それまでは要約の上に単独の行を使っていた。1行ぶん縦が詰まり、名前と一緒に読める）。
            見た目はカードと同じ枠線なしの塗りの札（plain）。表記は右欄では長いまま。
            ⚠️「○日前に更新」はバッジの横に添えない。下の要約の「意向の更新」と重複するため、要約の方だけ残した */
      /* ★名前の横に☆（2026-10-28 / 柴さんの指示。カードと同じ形・同じ動き。aria-label と aria-pressed は StarButton が持つ） */
      nameAction={(c.careerStance || canAct) ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 2 }}>
          {c.careerStance && <span data-state="header-stance" style={{ display: "inline-flex" }}><StanceBadge stance={c.careerStance} plain /></span>}
          {canAct && <span data-state="header-star" style={{ display: "inline-flex" }}><StarButton starred={actions.starred} onToggle={actions.onToggleStar} size={26} /></span>}
        </span>
      ) : undefined}
      onClose={onClose}
      topBar={<PreviewActionBar actions={actions} />}
      headerExtra={<PreviewHeaderLines candidate={c} contacts={contacts} />}
      sectioned
      before={<>
        <TransferPrefsBox candidate={c} />
        {positionFit && <PositionFitBox title={positionFit.title} items={positionFit.items} />}
        <CompanyContactsSection contacts={c.companyContacts} history={contacts} />
      </>}
      extraSections={notesEnabled ? [{ key: "notes", label: "メモ", body: <CandidateNotesPreview candidateUserId={c.id} candidateName={c.name} onCountChange={onNoteCountChange} /> }] : undefined}
      columns={showMessages && columns ? {
        messagesDot: unreadDot,
        messagesScrollRef,
        storageKey: columnsStorageKey,
        messages: (
          <section data-panel-section="messages">
            <PreviewApproachArea candidate={c} jobs={approachJobs} openNonce={openFormNonce} onRead={handleRead} />
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
            <PreviewApproachArea candidate={c} jobs={approachJobs} openNonce={openFormNonce} onRead={handleRead} />
          </section>
        ) : null,
      } : undefined}
    />
  );
}

/**
 * ★右欄の上の段。右端に［‹］「2 / 19」［›］。
 * ⚠️ 2026-10-28（柴さんの指示）: 「メッセージを送る」と「見送り」を外し、「気になる」は名前の横の☆へ移した。残るのは前後の移動だけ。
 * ⚠️ ‹ › は一覧の J/K と同じ移動（`CandidatesClient` の moveSelection）。端では押せない。
 */
function PreviewActionBar({ actions }: { actions: PreviewActions }) {
  const nav = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, padding: 0, borderRadius: 8,
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 16, fontFamily: "inherit",
    flexShrink: 0, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  });
  const { index, total } = actions;
  const prevDisabled = index <= 0;
  const nextDisabled = index < 0 || index >= total - 1;
  return (
    <div data-state="preview-action-bar" className="cand-bar" style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", marginBottom: 12, minWidth: 0 }}>
      <div className="cand-bar" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
        <button type="button" onClick={actions.onPrev} disabled={prevDisabled} aria-label="前の候補者" data-state="bar-prev" className="btn-fixed-size" style={nav(prevDisabled)}>‹</button>
        <span data-state="bar-position" className="cand-bar-pos" style={{ fontSize: 12.5, color: "var(--ink-mute)", textAlign: "center", fontFamily: "var(--font-inter), var(--font-noto)" }}>
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
export function PreviewHeaderLines({ candidate }: {
  candidate: Candidate;
  /** 【2026-10-28 から使っていない】これまでのやり取りは「自社との接点」の欄（CompanyContactsSection）へ移した */
  contacts?: PreviewContacts;
}) {
  /* ★2026-10-13（ステップ4 / モックに合わせた）: 意向は3段のバッジ（`StanceBadge`。それまでの4段ドットを置き換えた）。
        ⚠️ バッジは 2026-10-13 に名前の行へ移した（CandidatePreview の nameAction）。ここは4マスの要約だけ：現職の在籍期間／居住地／意向の更新（相対表記）／自社との接点。
     ⚠️ 希望年収・働き方は出さない（規約。企業の画面に出さない項目）。⚠️ 値が無いマスは「—」（推測で埋めない） */
  const cells: { label: string; value: string; state: string }[] = [
    { label: "現職の在籍期間", value: tenureSince(candidate.startedAt) ?? "—", state: "summary-current-tenure" },
    { label: "居住地", value: candidate.location || "—", state: "summary-location" },
    { label: "意向の更新", value: relativeJa(candidate.careerStanceUpdatedAt) ?? "—", state: "summary-stance-updated" },
  ];
  return (
    <div data-state="preview-header-lines" style={{ marginTop: 6 }}>
      {/* ⚠️ 列数は CSS（.cand-summary）。右欄が狭いと 2×2 にする（インラインに書くと切り替えられない）。区切り線は gap と背景で描く */}
      <dl data-state="preview-summary" className="cand-summary"
        style={{ margin: 0, display: "grid", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {cells.map((c) => (
          <div key={c.label} data-state={c.state} style={{ padding: "6px 10px", background: "#fff", minWidth: 0 }}>
            <dt style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{c.label}</dt>
            <dd style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.value}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 現職の在籍期間（入社月から今月まで）。「3年2か月」「8か月」。⚠️ 入社年月が無ければ null
 *  ★2026-10-27: 数え方はプロフィール・企業ページと同じ `tenureMonths`（開始月と今月を含める）。
 *     以前は今月を含めず、プロフィールと1ヶ月ずれていた。⚠️ ここで計算し直さないこと。表記（「か月」）だけ /biz のまま */
function tenureSince(startedAt: string | null): string | null {
  const months = tenureMonths([{ startedAt, endedAt: null }]);
  if (months === null) return null;
  const y = Math.floor(months / 12), m = months % 12;
  return y > 0 ? `${y}年${m > 0 ? `${m}か月` : ""}` : `${m}か月`;
}

/** 「今日」「3日前」「2か月前」「1年前」。⚠️ 日時が無ければ null（「不明」で埋めない。画面は「—」） */
function relativeJa(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "今日";
  if (days < 31) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

/** 「2025年3月」（日本時間） */
function formatYm(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}年${p.month}月`;
}
