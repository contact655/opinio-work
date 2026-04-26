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
};

function IconBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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

function ActionBtn({
  children,
  variant = "default",
  onClick,
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    padding: "8px 14px",
    fontFamily: "inherit", fontSize: 12, fontWeight: 600,
    borderRadius: 7, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  };
  const styles: Record<string, React.CSSProperties> = {
    default: { ...base, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" },
    primary: { ...base, border: "1px solid var(--royal)", background: "var(--royal)", color: "#fff" },
    danger:  { ...base, border: "1px solid var(--line)", background: "#fff", color: "var(--error)" },
  };
  return (
    <button
      onClick={onClick}
      style={styles[variant]}
      onMouseEnter={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.background = "var(--royal-deep)";
        } else if (variant === "danger") {
          e.currentTarget.style.background = "var(--error-soft)";
          e.currentTarget.style.borderColor = "var(--error)";
        } else {
          e.currentTarget.style.borderColor = "var(--royal-100)";
          e.currentTarget.style.background = "var(--royal-50)";
          e.currentTarget.style.color = "var(--royal)";
        }
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.background = "var(--royal)";
        } else if (variant === "danger") {
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.borderColor = "var(--line)";
        } else {
          e.currentTarget.style.borderColor = "var(--line)";
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.color = "var(--ink)";
        }
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: 10, fontWeight: 700,
      color: "var(--ink-mute)",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      marginBottom: 8,
    }}>
      {children}
    </div>
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
        fontFamily: "'Inter', sans-serif",
        fontSize: 10, fontWeight: 700,
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
  onScheduleAdjust,
  onProfileDetail,
  onPrev,
  onNext,
}: Props) {
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
        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>左のリストから申込を選んでください</div>
      </div>
    );
  }

  const questions = m.questions.split("\n").filter(Boolean);
  const memoValue = memoDraft ?? m.companyMemo;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── detail-head ── */}
      <div style={{
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
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 20, fontWeight: 600, color: "var(--ink)",
            marginBottom: 2,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {m.applicantName}
            <MeetingStatusBadge status={m.status} />
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {m.applicantAge} · {m.applicantCurrentCompany} {m.applicantCurrentRole}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconBtn onClick={onPrev} disabled={isPrevDisabled}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </IconBtn>
          <IconBtn onClick={onNext} disabled={isNextDisabled}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* ── action-bar ── */}
      <div style={{
        background: "#fff",
        padding: "12px 28px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        flexShrink: 0,
      }}>
        <ActionBtn variant="primary" onClick={onReply}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m22 2-7 20-4-9-9-4 20-7z"/>
          </svg>
          返信する
        </ActionBtn>
        <ActionBtn onClick={onScheduleAdjust}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          日程を調整する
        </ActionBtn>
        <ActionBtn onClick={onProfileDetail}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          プロフィール詳細
        </ActionBtn>
        <div style={{ flex: 1 }} />
        <ActionBtn onClick={() => onStatusChange?.("completed")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          面談完了をマーク
        </ActionBtn>
        <ActionBtn variant="danger" onClick={() => {
          if (window.confirm("この面談を見送りますか？")) {
            onStatusChange?.("declined");
          }
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          見送る
        </ActionBtn>
      </div>

      {/* ── detail-content ── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>

        {/* 1: 対応者 */}
        <DetailSection>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 12,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>対応者</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
                この申込を対応するメンバー
              </div>
            </div>
          </div>

          {m.assigneeId ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "var(--bg-tint)",
              borderRadius: 8, border: "1px solid var(--line)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: m.assigneeGradient ?? "var(--royal)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 13,
                flexShrink: 0,
              }}>
                {m.assigneeInitial}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.assigneeName}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>担当者</div>
              </div>
              <div style={{ flex: 1 }} />
              <button style={{
                padding: "5px 10px",
                fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                border: "1px solid var(--line)", borderRadius: 6,
                background: "#fff", color: "var(--ink-soft)", cursor: "pointer",
              }}>
                対応者を変更
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                padding: "14px",
                background: "var(--bg-tint)",
                borderRadius: 8, border: "1px dashed var(--line)",
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ink-mute)", flexShrink: 0 }}>
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>まだ対応者がいません</span>
              </div>
              <button
                onClick={onAssignToMe}
                style={{
                  padding: "8px 14px",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                  border: "none", borderRadius: 7,
                  background: "var(--accent)", color: "#fff", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                ✓ 自分が対応する
              </button>
            </div>
          )}
        </DetailSection>

        {/* 2: 興味を持った求人 */}
        {m.jobTitle && (
          <DetailSection>
            <SectionLabel>Interested Position</SectionLabel>
            <div style={{
              display: "flex", gap: 12,
              padding: "12px 14px",
              background: "var(--bg-tint)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              alignItems: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "var(--royal-50)",
                color: "var(--royal)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 2 }}>
                  興味を持った求人
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
                  {m.jobTitle}
                </div>
              </div>
              {m.jobSalary && (
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 700, color: "var(--royal)",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {m.jobSalary}
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {/* 3: 申込内容 */}
        <DetailSection>
          <SectionLabel>Application Details</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <BlockField label="いまの転職意向">
              <strong style={{ color: "var(--royal)", fontWeight: 700 }}>{m.intent}</strong>
              <br />
              {m.intentDetail}
            </BlockField>
            <BlockField label="興味を持ったきっかけ">
              {m.interestReason}
            </BlockField>
            <BlockField label="面談で聞いてみたいこと">
              {questions.map((q, i) => (
                <span key={i}>
                  {q}{i < questions.length - 1 && <br />}
                </span>
              ))}
            </BlockField>
            <BlockField label="希望する面談形式">
              {m.preferredFormat}
            </BlockField>
          </div>
        </DetailSection>

        {/* 4: 候補者のキャリア */}
        <DetailSection>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              候補者のキャリア
            </div>
            <a href="#" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              詳細プロフィール →
            </a>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {m.career.map((c, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr",
                gap: 14,
                padding: "8px 0",
                borderBottom: i < m.career.length - 1 ? "1px dashed var(--line)" : "none",
                fontSize: 12,
              }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11, fontWeight: 500, color: "var(--ink-mute)",
                }}>
                  {c.period}
                </div>
                <div style={{ color: "var(--ink)", lineHeight: 1.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--royal)", fontWeight: 600 }}>{c.role}</strong>
                    {c.isCurrent && (
                      <span style={{
                        background: "var(--success-soft)", color: "var(--success)",
                        padding: "1px 6px", borderRadius: 4,
                        fontWeight: 700, fontSize: 9, letterSpacing: "0.05em",
                      }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--ink-soft)", marginTop: 2 }}>{c.company}</div>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>

        {/* 5: 社内共有メモ */}
        <div style={{
          background: "var(--warm-soft)",
          border: "1px solid #FDE68A",
          borderRadius: 12,
          padding: "16px 20px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
            </svg>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10, fontWeight: 700, color: "#B45309", letterSpacing: "0.15em",
            }}>
              INTERNAL NOTE
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#78350F" }}>
              · 社内共有メモ
            </span>
            {memoSaveState === "saving" && (
              <span style={{ fontSize: 10, color: "#B45309", marginLeft: "auto" }}>保存中…</span>
            )}
            {memoSaveState === "saved" && (
              <span style={{ fontSize: 10, color: "var(--success)", marginLeft: "auto" }}>✓ 保存済み</span>
            )}
          </div>

          <textarea
            value={memoValue}
            onChange={(e) => onMemoChange?.(e.target.value)}
            placeholder="チームメンバーと共有するメモを書いてください..."
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #FDE68A",
              borderRadius: 8,
              background: "#fff",
              fontFamily: "inherit",
              fontSize: 12,
              color: "var(--ink)",
              lineHeight: 1.7,
              minHeight: 70,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--warm)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#FDE68A"; }}
          />

          <div style={{ fontSize: 10, color: "#78350F", marginTop: 6 }}>
            ※ このメモは貴社チームのみが閲覧できます。候補者には共有されません。
          </div>
        </div>

      </div>
    </div>
  );
}
