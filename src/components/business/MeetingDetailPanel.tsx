"use client";

import { JobInternalNote } from "@/components/business/JobInternalNote";
import { useState, useEffect } from "react";
import type { MeetingStatus } from "@/lib/business/mockMeetings";
import type { MeetingApplication } from "@/lib/business/mockMeetings";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

type MemoSaveState = "idle" | "saving" | "saved";

type Props = {
  meeting: MeetingApplication | null;
  memoDraft?: string;
  memoSaveState?: MemoSaveState;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  onStatusChange?: (newStatus: import("@/lib/business/mockMeetings").MeetingStatus) => void;
  onAssignToMe?: () => void;
  onMemoChange?: (text: string) => void;
  onReply?: () => void;
  onScheduleAdjust?: () => void;
  onProfileDetail?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /* ⚠️ onScheduleAdjust・onProfileDetail は 2026-10-18 から使っていない（返信と同じ行き先・名前の横の ↗ と同じ）。呼び出し側の互換のため型だけ残す */
  /** ★選考管理の右側に入れるとき（2026-10-11）。名前・年齢・前後の移動の段を出さない（上の共通の段が名前を出す）。操作と確認はそのまま */
  embedded?: boolean;
  /** ★閲覧のみの役割（2026-10-12）。返信・日程・状態の変更・担当・メモの編集を出さない（見るだけ） */
  readOnly?: boolean;
  /** ★この人とのメッセージのやり取りがあるか（2026-10-18）。無ければ返信の横に小さく「まだやり取りはありません」 */
  hasConversation?: boolean;
};

function IconBtn({ children, onClick, disabled, ariaLabel, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; ariaLabel?: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 32, height: 32,
        border: "1px solid var(--line)",
        background: "#fff",
        color: disabled ? "var(--line)" : "var(--ink-soft)",
        borderRadius: 7,
        cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = "var(--royal-100)";
        e.currentTarget.style.background = "var(--royal-50)";
        e.currentTarget.style.color = "var(--royal)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.color = "var(--ink-soft)";
      }}
    >
      {children}
    </button>
  );
}

function DetailSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "20px 22px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function BlockField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--line)" }}>
      <div style={{
        fontFamily: "var(--font-inter), var(--font-noto)",
        fontSize: 12, fontWeight: 700,
        color: "var(--ink-mute)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

export function MeetingDetailPanel({
  meeting: m,
  memoDraft,
  memoSaveState = "idle",
  isPrevDisabled,
  isNextDisabled,
  onStatusChange,
  onAssignToMe,
  onMemoChange,
  onReply,
  onPrev,
  onNext,
  embedded = false,
  readOnly = false,
  hasConversation = true,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [declineConfirming, setDeclineConfirming] = useState(false);
  /* ★「日程が決まった」の確認（2026-09-21）。`scheduled` にすると候補者へ
        「日程が確定しました」のメールが届くので、押す前に必ず伝える。 */
  const [scheduleConfirming, setScheduleConfirming] = useState(false);
  /* ⚠️ 別の候補者を選んだら確認を閉じる。開いたままだと、別の人に対して
        「確定する」「見送る」を押せてしまう */
  const selectedMeetingId = m?.id;
  useEffect(() => {
    setScheduleConfirming(false);
    setDeclineConfirming(false);
    setMoreOpen(false);
  }, [selectedMeetingId]);
  /* 「その他」のメニューは外を押したら閉じる */
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.(".mdp-more")) setMoreOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [moreOpen]);

  if (!m) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, color: "var(--ink-mute)",
        height: "100%",
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>申込を選択してください</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>左のリストから申込を選んでください</div>
      </div>
    );
  }

  const questions = m.questions.split("\n").filter(Boolean);
  const memoValue = memoDraft ?? m.companyMemo;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: embedded ? undefined : "100%" }}>

      {/* ── detail-head ──（★embedded のときは出さない） */}
      {!embedded && <div style={{
        background: "#fff",
        padding: "18px 28px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: m.applicantGradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 600, fontSize: 20,
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          {m.applicantInitial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 20, fontWeight: 600, color: "var(--ink)",
            marginBottom: 2,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {m.applicantName}
            <MeetingStatusBadge status={m.status} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
            {m.applicantAge} · {m.applicantCurrentCompany} {m.applicantCurrentRole}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconBtn onClick={onPrev} disabled={isPrevDisabled} ariaLabel="前の申込（↑ / k）" title="前の申込 (↑ / k)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </IconBtn>
          <IconBtn onClick={onNext} disabled={isNextDisabled} ariaLabel="次の申込（↓ / j）" title="次の申込 (↓ / j)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </IconBtn>
        </div>
      </div>}

      {/* ── ★操作の段（2026-10-18 / 柴さんの指示で作り直した）──────────────────────────
             1行目: 進み具合（新規受信 → 確認中 → 面談予定 → 完了。見送りはその旨）
             2行目: 対応者（未定なら「自分が対応する」）／次にやること1つ／その他（日程が決まった・面談完了・見送る）
             ⚠️ それまでは6個のボタンが同じ重さで並び、何から押せばよいか分からなかった。
             ⚠️ メールが飛ぶ操作（日程が決まった・見送る）は以前と同じく確認を1段挟む。API と流れは変えていない。
             ⚠️ 閲覧のみの役割は進み具合と対応者だけ（操作は出さない） */}
      <div className="mdp-head" data-state="meeting-actions">
        <MeetingProgress status={m.status} />
        <div className="mdp-actions">
          <div className="mdp-assignee" data-state={m.assigneeId ? "assignee-set" : "assignee-none"}>
            <span className="mdp-assignee-label">対応者</span>
            {m.assigneeId ? (
              <span className="mdp-assignee-who">
                <span aria-hidden="true" className="mdp-assignee-avatar" style={{ background: m.assigneeGradient ?? "var(--royal)" }}>{m.assigneeInitial}</span>
                {m.assigneeName}
              </span>
            ) : (
              <span className="mdp-assignee-none">未定</span>
            )}
          </div>
          {!readOnly && (() => {
            const closed = m.status === "completed" || m.status === "declined";
            const canSchedule = m.status === "pending" || m.status === "company_contacted";
            /* 次にやること（1つだけ主ボタン） */
            const primary: { label: string; onClick: () => void; state: string } | null =
              closed ? null
              : !m.assigneeId ? { label: "自分が対応する", onClick: () => onAssignToMe?.(), state: "next-assign" }
              : m.status === "scheduled" ? { label: "面談完了にする", onClick: () => onStatusChange?.("completed"), state: "next-complete" }
              : { label: "返信する", onClick: () => onReply?.(), state: "next-reply" };
            return (
              <div className="mdp-buttons">
                {primary && (
                  <button type="button" className="mdp-btn mdp-btn-primary btn-fixed-size" data-state={primary.state} onClick={primary.onClick}>{primary.label}</button>
                )}
                {primary?.state !== "next-reply" && (
                  <button type="button" className="mdp-btn btn-fixed-size" data-state="action-reply" onClick={() => onReply?.()}>返信する</button>
                )}
                <div className="mdp-more">
                  <button type="button" className="mdp-btn btn-fixed-size" aria-haspopup="menu" aria-expanded={moreOpen} data-state="action-more"
                    onClick={() => setMoreOpen((v) => !v)}>その他 ▾</button>
                  {moreOpen && (
                    <div role="menu" className="mdp-menu" data-state="action-menu">
                      {canSchedule && (
                        <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setScheduleConfirming(true); }}>日程が決まった</button>
                      )}
                      {m.status !== "completed" && m.status !== "declined" && primary?.state !== "next-complete" && (
                        <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onStatusChange?.("completed"); }}>面談完了にする</button>
                      )}
                      {m.status !== "declined" && (
                        <button type="button" role="menuitem" className="is-danger" onClick={() => { setMoreOpen(false); setDeclineConfirming(true); }}>見送る</button>
                      )}
                      {closed && m.status === "declined" && (
                        <span className="mdp-menu-note">見送り済みです</span>
                      )}
                    </div>
                  )}
                </div>
                {!hasConversation && <span className="mdp-hint" data-state="no-message">まだメッセージのやり取りはありません</span>}
              </div>
            );
          })()}
        </div>
        {/* 確認（メールが飛ぶ操作だけ） */}
        {!readOnly && scheduleConfirming && (
          <div role="alertdialog" aria-label="日程の確定" className="mdp-confirm" data-state="confirm-schedule">
            <span>候補者に「日程が確定しました」とメールが届きます</span>
            <button type="button" className="mdp-btn mdp-btn-primary btn-fixed-size" onClick={() => { setScheduleConfirming(false); onStatusChange?.("scheduled"); }}>確定する</button>
            <button type="button" className="mdp-btn btn-fixed-size" onClick={() => setScheduleConfirming(false)}>やめる</button>
          </div>
        )}
        {!readOnly && declineConfirming && (
          <div role="alertdialog" aria-label="見送りの確認" className="mdp-confirm is-danger" data-state="confirm-decline">
            <span>見送りますか？候補者にお知らせのメールが届きます</span>
            <button type="button" className="mdp-btn mdp-btn-danger btn-fixed-size" onClick={() => { setDeclineConfirming(false); onStatusChange?.("declined"); }}>見送る</button>
            <button type="button" className="mdp-btn btn-fixed-size" onClick={() => setDeclineConfirming(false)}>やめる</button>
          </div>
        )}
      </div>

      {/* ── 中身。★広い枠では左＝申込の内容・経歴、右＝社内メモ（2026-10-18）。狭い枠では縦に並ぶ（コンテナクエリ） ── */}
      <div className="mdp-body" style={{ flex: embedded ? undefined : 1, overflowY: embedded ? undefined : "auto" }}>
        <div className="mdp-grid">
          <div className="mdp-main">
            {/* 興味を持った求人 */}
            {m.jobTitle && (
              <DetailSection>
                <SectionTitle>興味を持った求人</SectionTitle>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>{m.jobTitle}</div>
                  {m.jobSalary && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", whiteSpace: "nowrap" }}>{m.jobSalary}</div>}
                </div>
                {/* ★この求人の社内メモ（2026-10-12）。読むだけ・開閉。メモが無ければ何も出さない。⚠️ 求職者には出さない */}
                {m.jobId && <JobInternalNote jobId={m.jobId} variant="readonly" />}
              </DetailSection>
            )}

            {/* 申込の内容。★空の項目は出さない（2026-10-18。見出しだけ並んでいた） */}
            <DetailSection>
              <SectionTitle>申込の内容</SectionTitle>
              {(() => {
                const intent = m.intent && m.intent !== "—" ? m.intent : null;
                const fields: { label: string; node: React.ReactNode }[] = [];
                if (intent || m.intentDetail) fields.push({ label: "いまの転職意向", node: <>{intent && <strong style={{ color: "var(--royal)", fontWeight: 700 }}>{intent}</strong>}{m.intentDetail && <><br />{m.intentDetail}</>}</> });
                if (m.interestReason.trim()) fields.push({ label: "興味を持ったきっかけ", node: <span style={{ whiteSpace: "pre-wrap" }}>{m.interestReason}</span> });
                if (questions.length) fields.push({ label: "面談で聞いてみたいこと", node: questions.map((q, i) => <span key={i}>{q}{i < questions.length - 1 && <br />}</span>) });
                if (m.preferredFormat && m.preferredFormat !== "—") fields.push({ label: "希望する面談形式", node: m.preferredFormat });
                if (fields.length === 0) return <p data-state="application-empty" style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>申込時の記入はありません</p>;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {fields.map((f) => <BlockField key={f.label} label={f.label}>{f.node}</BlockField>)}
                  </div>
                );
              })()}
            </DetailSection>

            {/* 候補者のキャリア */}
            <DetailSection>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <SectionTitle style={{ marginBottom: 0 }}>経歴</SectionTitle>
                {m.applicantUserId && (
                  <a href={`/u/${m.applicantUserId}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                    プロフィールを見る ↗
                  </a>
                )}
              </div>
              {m.career.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>職歴の登録はありません</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {m.career.map((c, i) => (
                    <div key={i} style={{
                      display: "grid",
                      // ⚠️ 期間は formatPeriod が "2020.04 — 2023.03"（em ダッシュ込み17字）を返す。12px で約118px 要る
                      gridTemplateColumns: "124px minmax(0, 1fr)",
                      gap: 14, padding: "8px 0",
                      borderBottom: i < m.career.length - 1 ? "1px dashed var(--line)" : "none",
                      fontSize: 12,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{c.period}</div>
                      <div style={{ color: "var(--ink)", lineHeight: 1.6, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{c.role}</strong>
                          {c.isCurrent && (
                            <span style={{ background: "var(--success-soft)", color: "var(--success-ink)", padding: "0 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>現職</span>
                          )}
                        </div>
                        <div style={{ color: "var(--ink-soft)", marginTop: 2 }}>{c.company}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          </div>

          {/* 社内メモ（右の列） */}
          <aside className="mdp-side">
            <div style={{ background: "var(--warm-soft)", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 16px" }} data-state="meeting-memo">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>社内メモ</span>
                <span aria-live="polite" style={{ marginLeft: "auto" }}>
                  {memoSaveState === "saving" && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warm-ink)" }}>保存中…</span>}
                  {memoSaveState === "saved" && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--success-ink)" }}>✓ 保存しました</span>}
                </span>
              </div>
              <textarea
                value={memoValue}
                onChange={(e) => onMemoChange?.(e.target.value)}
                readOnly={readOnly}
                aria-label="社内メモ"
                placeholder="面談の前に確認したいこと、話した内容などを書いておけます"
                className="mdp-memo"
              />
              <div style={{ fontSize: 12, color: "#78350F", marginTop: 6, lineHeight: 1.6 }}>
                貴社の担当者だけが読めます。候補者には見えません。
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .mdp-head { position: sticky; top: 0; z-index: 3; background: #fff; border-bottom: 1px solid var(--line); padding: 12px 24px; display: flex; flex-direction: column; gap: 10px; }
        .mdp-step-line { width: 22px; margin: 0 6px; flex-shrink: 1; }
        .mdp-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .mdp-assignee { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); min-width: 0; }
        .mdp-assignee-label { font-size: 12px; color: var(--ink-mute); }
        .mdp-assignee-who { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
        .mdp-assignee-avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .mdp-assignee-none { font-weight: 600; color: var(--ink-mute); }
        .mdp-buttons { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
        .mdp-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .mdp-btn:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .mdp-btn-primary { background: var(--royal); border-color: var(--royal); color: #fff; }
        .mdp-btn-primary:hover { background: #001233; border-color: #001233; color: #fff; }
        .mdp-btn-danger { background: var(--error); border-color: var(--error); color: #fff; }
        .mdp-btn-danger:hover { background: var(--error); color: #fff; opacity: 0.9; }
        .mdp-more { position: relative; }
        .mdp-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 10; min-width: 180px; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); display: flex; flex-direction: column; }
        .mdp-menu button { text-align: left; padding: 9px 10px; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 13px; color: var(--ink); cursor: pointer; }
        .mdp-menu button:hover { background: var(--bg-tint); }
        .mdp-menu button.is-danger { color: var(--error); }
        .mdp-menu-note { padding: 9px 10px; font-size: 12px; color: var(--ink-mute); }
        .mdp-hint { font-size: 12px; color: var(--ink-mute); }
        .mdp-confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border-radius: 8px; background: var(--royal-50); border: 1px solid var(--royal-100); font-size: 13px; font-weight: 600; color: var(--royal); }
        .mdp-confirm.is-danger { background: var(--error-soft); border-color: #FCA5A5; color: var(--error); }
        .mdp-confirm span { flex: 1 1 220px; min-width: 0; }
        .mdp-body { container-type: inline-size; padding: 20px 24px; }
        .mdp-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        .mdp-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .mdp-side { min-width: 0; }
        .mdp-memo { width: 100%; padding: 10px 12px; border: 1px solid #FDE68A; border-radius: 8px; background: #fff; font: inherit; font-size: 13px; color: var(--ink); line-height: 1.7; min-height: 120px; resize: vertical; outline: none; box-sizing: border-box; }
        .mdp-memo:focus { border-color: var(--warm-ink); }
        @container (min-width: 700px) {
          .mdp-grid { grid-template-columns: minmax(0, 1fr) 280px; align-items: start; }
          .mdp-side { position: sticky; top: 96px; }
          .mdp-memo { min-height: 220px; }
        }
        @media (max-width: 767px) {
          .mdp-head { padding: 10px 14px; }
          .mdp-step-line { width: 10px; margin: 0 4px; }
          .mdp-progress li span { font-size: 12px; gap: 4px; }
          .mdp-body { padding: 14px; }
          .mdp-buttons { margin-left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

/** ★進み具合（2026-10-18）。新規受信 → 確認中 → 面談予定 → 完了。見送りはその旨を1行で */
const PROGRESS_STEPS: { status: MeetingStatus; label: string }[] = [
  { status: "pending", label: "新規受信" },
  { status: "company_contacted", label: "確認中" },
  { status: "scheduled", label: "面談予定" },
  { status: "completed", label: "完了" },
];
function MeetingProgress({ status }: { status: MeetingStatus }) {
  if (status === "declined") {
    return <div data-state="progress-declined" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-mute)" }}>見送りました</div>;
  }
  const at = PROGRESS_STEPS.findIndex((s) => s.status === status);
  return (
    <ol data-state="meeting-progress" aria-label="進み具合" className="mdp-progress" style={{ display: "flex", alignItems: "center", gap: 0, margin: 0, padding: 0, listStyle: "none", minWidth: 0 }}>
      {PROGRESS_STEPS.map((s, i) => {
        const done = i < at, current = i === at;
        return (
          <li key={s.status} aria-current={current ? "step" : undefined} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {i > 0 && <span aria-hidden="true" className="mdp-step-line" style={{ height: 2, background: i <= at ? "var(--royal)" : "var(--line)" }} />}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: current ? 700 : 500, color: current ? "var(--royal)" : done ? "var(--ink-soft)" : "var(--ink-mute)", whiteSpace: "nowrap" }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: done || current ? "var(--royal)" : "#fff", border: `2px solid ${done || current ? "var(--royal)" : "var(--line)"}`, boxSizing: "border-box" }} />
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--ink)", ...style }}>{children}</h3>;
}
