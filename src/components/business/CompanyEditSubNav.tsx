"use client";

import type { CompanySectionId } from "@/lib/business/mockCompany";
import { DISCLOSURE_INTERVIEW_MAX } from "@/lib/utils/disclosureScore";

export type CompanySubNavSection = {
  id: CompanySectionId;
  label: string;
  showStatus: boolean;
  hasDraft?: boolean;
};

type Props = {
  sections: CompanySubNavSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  bizScore: number;
  interviewScore: number;
  hasDraftChanges: boolean;
  lastPublishedAt?: string;
  lastPublishedAgo?: string;
  onViewPublicPage?: () => void;
  // アクションボタン（旧サブトップバーから移動）
  onPreview?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  isAdmin?: boolean;
  termsAgreed?: boolean;
  onShowTermsSection?: () => void;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveStatusText?: string;
  onRetrySave?: () => void;
};

export function CompanyEditSubNav({
  sections,
  activeSection,
  onSectionClick,
  bizScore,
  interviewScore,
  hasDraftChanges,
  lastPublishedAt,
  lastPublishedAgo,
  onViewPublicPage,
  onPreview,
  onPublish,
  isPublishing,
  isAdmin,
  termsAgreed,
  onShowTermsSection: _onShowTermsSection,
  saveState,
  saveStatusText,
  onRetrySave,
}: Props) {
  return (
    <aside style={{
      background: "var(--bg-tint)",
      borderRight: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* アクションボタン */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {/* 保存状態 */}
        {saveState && saveState !== "idle" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: saveState === "error" ? "var(--error)" : "var(--ink-mute)", fontWeight: 500 }}>
            {saveState === "saving" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            {saveState === "saved" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
            {saveStatusText}
            {saveState === "error" && onRetrySave && (
              <button type="button" onClick={onRetrySave} style={{ marginLeft: 4, fontSize: 12, fontWeight: 600, color: "var(--error)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>再試行</button>
            )}
          </div>
        )}
        {/* 変更を公開 */}
        {isAdmin && termsAgreed && (
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || !hasDraftChanges}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: (isPublishing || !hasDraftChanges) ? "not-allowed" : "pointer", background: hasDraftChanges ? "var(--success)" : "var(--line)", color: hasDraftChanges ? "#fff" : "var(--ink-mute)", border: "none", transition: "background 0.2s", opacity: isPublishing ? 0.7 : 1 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            {isPublishing ? "公開中..." : hasDraftChanges ? "変更を公開する" : "公開済み"}
          </button>
        )}
        {/* プレビュー */}
        <button
          type="button"
          onClick={onPreview}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 12px", fontFamily: "inherit", fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: "pointer", border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          プレビュー
        </button>
      </div>

      {/* 公開ステータス */}
      <div style={{ padding: "8px 16px 4px" }}>
        {hasDraftChanges ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: "var(--warm-soft)", border: "1px solid #FDE68A",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warm)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>未公開の変更あり</span>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 6,
            background: "var(--success-soft)", border: "1px solid #A7F3D0",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success-ink)" }}>公開済み・最新</span>
          </div>
        )}
      </div>

      {/* セクションナビ */}
      <nav style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
        {sections.map((s) => {
          const isActive = s.id === activeSection;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionClick(s.id)}
              style={{
                padding: "9px 20px",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderLeft: `3px solid ${isActive ? "var(--royal)" : "transparent"}`,
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                justifyContent: "space-between",
                transition: "all 0.15s",
                background: isActive ? "#fff" : "transparent",
                fontFamily: "inherit",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span>{s.label}</span>
              {s.showStatus && s.hasDraft && (
                <span style={{
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--warm-ink)",
                  background: "var(--warm-soft)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  下書きあり
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 公開情報カード */}
      {lastPublishedAt && (
        <div style={{
          margin: "0 16px 12px",
          padding: 14,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            最終公開
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 4 }}>
            {lastPublishedAt} に公開
          </div>
          {lastPublishedAgo && (
            <div style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: 12, fontWeight: 500,
              color: "var(--ink-mute)",
              marginBottom: 8,
            }}>
              {lastPublishedAgo}
            </div>
          )}
          <button
            type="button"
            onClick={onViewPublicPage}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            公開ページを見る
          </button>
        </div>
      )}

      {/* 開示充実度スコア */}
      <div style={{
        margin: "0 16px 16px",
        padding: 14,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          開示充実度
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4 }}>
              <span>あなたが入力できる項目</span>
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, color: "var(--royal)" }}>{bizScore} / 45</span>
            </div>
            <div style={{ height: 4, background: "var(--bg-tint)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(bizScore / 45 * 100)}%`, background: "linear-gradient(to right, var(--royal), var(--accent))", borderRadius: 100, transition: "width 0.3s ease" }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4 }}>
              <span>取材・投稿で埋まる項目</span>
              <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, color: "var(--ink-mute)" }}>{interviewScore} / {DISCLOSURE_INTERVIEW_MAX}</span>
            </div>
            <div style={{ height: 4, background: "var(--bg-tint)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(interviewScore / DISCLOSURE_INTERVIEW_MAX * 100)}%`, background: "var(--ink-mute)", borderRadius: 100, transition: "width 0.3s ease" }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
