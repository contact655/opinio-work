"use client";

import { useState, useCallback } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import CareerHistoryEditor from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS } from "@/lib/profile/mockProfileData";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkillTag = { id: string; label: string; sort_order: number };

type Education = {
  id: string;
  school: string;
  faculty: string | null;
  degree: string | null;
  enrolled_at: string | null;
  graduated_at: string | null;
  is_current: boolean;
  sort_order: number;
};

type Certification = {
  id: string;
  name: string;
  sort_order: number;
};

/** JSONB キー名は "x"（ν-8 段階6-1 E で twitter → x 移行済み）。値は URL 文字列。空文字列 = 未設定。 */
type SocialLinks = Partial<Record<SocialPlatform, string>>;

type Achievement = {
  id: string;
  title: string;
  value: number | null;
  unit: string | null;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  sort_order: number;
};

type Award = {
  id: string;
  title: string;
  issuer: string | null;
  awarded_at: string | null;
  description: string | null;
  sort_order: number;
};

type MediaAppearance = {
  id: string;
  title: string;
  media_name: string | null;
  url: string | null;
  thumbnail_url: string | null;
  appeared_at: string | null;
  description: string | null;
  sort_order: number;
};

type ProfileTab = "basic" | "career" | "skills" | "certs" | "achievements" | "socials" | "account";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  visibility: string | null;
  location: string | null;
  birth_date: string | null;
  about_me: string | null;
  future_aspirations: string | null;
  social_links: Record<string, string> | null;
} | null;

// ─── Basic info state ─────────────────────────────────────────────────────────

type BasicInfo = {
  name: string;
  location: string;
  aboutMe: string;
  futureAspirations: string;
};

type SettingsState = {
  avatarColor: string;
  coverColor: string;
  visibility: "public" | "login_only" | "private";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR_COLOR = "linear-gradient(135deg, #002366, #3B5FD9)";
const DEFAULT_COVER_COLOR  = "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";

const DEGREE_OPTIONS = ["高校卒", "専門卒", "短大卒", "学士", "修士", "博士", "その他"] as const;
const EDU_YEAR_OPTS  = Array.from({ length: 61 }, (_, i) => new Date().getFullYear() + 4 - i);

function parseDateToYM(s: string | null): { year: string; month: string } {
  if (!s) return { year: "", month: "" };
  const [y, m] = s.split("-");
  return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "" };
}

function formatYMToDate(year: string, month: string): string | null {
  if (!year || !month) return null;
  return `${year}-${month.padStart(2, "0")}-01`;
}

const PROFILE_TABS: TabItem[] = [
  { key: "basic",        label: "基本情報" },
  { key: "career",       label: "職歴・学歴" },
  { key: "skills",       label: "スキル" },
  { key: "certs",        label: "資格" },
  { key: "achievements", label: "実績・受賞" },
  { key: "socials",      label: "SNS" },
  { key: "account",      label: "アカウント設定" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({
  title, desc, children,
}: {
  title: React.ReactNode; desc?: string; children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "28px 32px", marginBottom: 20,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: desc ? 6 : 20 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </section>
  );
}

function FormGroup({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid var(--line)", borderRadius: 8,
    fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
    background: "#fff", outline: "none", transition: "border-color 0.15s",
    ...extra,
  };
}

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    appearance: "none" as const,
    cursor: "pointer",
    paddingRight: 32,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };
}

// ─── Placeholder Tab Content ──────────────────────────────────────────────────

function PlaceholderTabContent({ label }: { label: string }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div
        style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "48px 32px",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, marginBottom: 24,
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--bg-tint)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>
          {label}（実装中）
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, textAlign: "center" }}>
          この機能は現在開発中です。近日公開予定です。
        </div>
      </div>
      {/* 各タブ最下部に「保存」ボタン — プレースホルダーは disabled */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled
          style={{
            padding: "10px 24px", fontSize: 13, fontWeight: 600,
            background: "var(--bg-tint)", color: "var(--ink-mute)",
            border: "1px solid var(--line)", borderRadius: 8,
            fontFamily: "inherit", cursor: "not-allowed",
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

// ─── Skill Tags Editor ────────────────────────────────────────────────────────

function SkillTagsEditor({
  skillTags,
  setSkillTags,
}: {
  skillTags: SkillTag[];
  setSkillTags: React.Dispatch<React.SetStateAction<SkillTag[]>>;
}) {
  const [pendingLabel, setPendingLabel] = useState("");
  const [inputError, setInputError]     = useState<string | null>(null);
  const [skillToastMsg,     setSkillToastMsg]     = useState<string | null>(null);
  const [skillToastVariant, setSkillToastVariant] = useState<"default" | "error">("default");

  const count       = skillTags.length;
  const isAtLimit   = count >= 15;
  const isAlmost    = count >= 12 && count < 15; // 残り3個以下
  const charLen     = pendingLabel.length;
  const charIsAmber = charLen > 40;

  const handleAdd = async () => {
    const label = pendingLabel.trim();
    if (label.length === 0) return;

    // クライアント側バリデーション
    if (label.length > 50) {
      setInputError("タグは50字以内で入力してください。");
      return;
    }
    if (skillTags.some((t) => t.label === label)) {
      setInputError("同じタグがすでに登録されています。");
      return;
    }
    if (count >= 15) {
      setInputError("スキルタグは最大15個まで登録できます。");
      return;
    }

    setInputError(null);

    // 楽観更新: 仮 ID で先にチップを追加
    const tempId  = `pending-${Date.now()}`;
    const tempTag: SkillTag = { id: tempId, label, sort_order: 9999 };
    setSkillTags((prev) => [...prev, tempTag]);
    setPendingLabel("");

    try {
      const res = await fetch("/api/jobseeker/skill-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? res.statusText);
      }
      const confirmed: SkillTag = await res.json();
      // サーバ確定値（id, sort_order）で仮チップを置換
      setSkillTags((prev) => prev.map((t) => (t.id === tempId ? confirmed : t)));
      setSkillToastVariant("default");
      setSkillToastMsg("スキルタグを追加しました");
    } catch (e) {
      // ロールバック: 仮チップを除去 + inline エラー
      setSkillTags((prev) => prev.filter((t) => t.id !== tempId));
      setInputError((e as Error).message ?? "保存に失敗しました。");
    }
  };

  const handleDelete = async (tag: SkillTag) => {
    // 楽観更新: 即チップを除去
    setSkillTags((prev) => prev.filter((t) => t.id !== tag.id));

    try {
      const res = await fetch(`/api/jobseeker/skill-tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("削除に失敗しました。");
      setSkillToastVariant("default");
      setSkillToastMsg("スキルタグを削除しました");
    } catch {
      // ロールバック: sort_order 順で復元
      setSkillTags((prev) =>
        [...prev, tag].sort((a, b) => a.sort_order - b.sort_order)
      );
      setSkillToastVariant("error");
      setSkillToastMsg("削除に失敗しました。もう一度お試しください。");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <>
    <FormSection
      title="スキル"
      desc="あなたのスキルや得意な技術・経験した領域をタグで登録してください。最大15個まで。"
    >
      {/* 確定済みタグのチップ列 */}
      {skillTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {skillTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px 5px 12px", borderRadius: 100,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                fontSize: 13, color: "var(--royal)", fontWeight: 500,
                opacity: tag.id.startsWith("pending-") ? 0.55 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {tag.label}
              {/* 仮IDのチップ（保存中）には✕を出さない */}
              {!tag.id.startsWith("pending-") && (
                <button
                  type="button"
                  onClick={() => handleDelete(tag)}
                  aria-label={`${tag.label} を削除`}
                  style={{
                    background: "none", border: "none", padding: 2,
                    cursor: "pointer", color: "var(--royal)", opacity: 0.5,
                    display: "flex", alignItems: "center",
                    borderRadius: "50%", transition: "opacity 0.15s",
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 入力エリア（上限未達の場合のみ表示） */}
      {!isAtLimit && (
        <div>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={pendingLabel}
              onChange={(e) => {
                setPendingLabel(e.target.value);
                setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="例: TypeScript, React, Supabase…（Enter または , で確定）"
              maxLength={55}
              style={inputStyle({ paddingRight: charLen > 0 ? 68 : 12 })}
            />
            {/* 入力中文字数カウンター */}
            {charLen > 0 && (
              <span style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: charIsAmber ? "var(--warm)" : "var(--ink-mute)",
                fontFamily: "Inter, sans-serif",
                pointerEvents: "none",
              }}>
                {charLen} / 50
              </span>
            )}
          </div>

          {/* inline エラー */}
          {inputError && (
            <div style={{ fontSize: 11, color: "var(--error)", marginTop: 6, lineHeight: 1.6 }}>
              {inputError}
            </div>
          )}

          {/* 確定ヒント */}
          {!inputError && (
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
              Enter またはカンマ（,）で確定
            </div>
          )}
        </div>
      )}

      {/* タグカウンター（n / 15） */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <span style={{
          fontSize: 11, fontFamily: "Inter, sans-serif",
          color: isAtLimit ? "var(--error)" : isAlmost ? "var(--warm)" : "var(--ink-mute)",
        }}>
          {isAtLimit
            ? `${count} / 15（上限に達しました）`
            : isAlmost
            ? `${count} / 15（残り${15 - count}個）`
            : `${count} / 15`}
        </span>
      </div>
    </FormSection>
    {skillToastMsg && (
      <Toast
        message={skillToastMsg}
        variant={skillToastVariant}
        onDone={() => setSkillToastMsg(null)}
      />
    )}
    </>
  );
}

// ─── Textarea Field with soft-limit counter ───────────────────────────────────

function TextareaField({
  value,
  onChange,
  placeholder,
  softLimit = 200,
  rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  softLimit?: number;
  rows?: number;
}) {
  const len    = value.length;
  const isOver = len > softLimit;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...inputStyle({ resize: "vertical", lineHeight: 1.8, minHeight: rows * 24 }),
        }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginTop: 6, gap: 8,
      }}>
        {isOver ? (
          <div style={{ fontSize: 11, color: "var(--warm)", lineHeight: 1.6, flex: 1 }}>
            {softLimit}字の目安を超えています。保存は可能ですが、読み手が読みやすい長さを意識してみてください。
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{
          fontSize: 11,
          color: isOver ? "var(--warm)" : "var(--ink-mute)",
          fontFamily: "Inter, sans-serif",
          flexShrink: 0,
          lineHeight: 1.6,
        }}>
          {len} / {softLimit}
        </div>
      </div>
    </div>
  );
}

// ─── Social Links Editor ──────────────────────────────────────────────────────

function SocialLinksEditor({
  socialLinks,
  setSocialLinks,
}: {
  socialLinks: SocialLinks;
  setSocialLinks: React.Dispatch<React.SetStateAction<SocialLinks>>;
}) {
  return (
    <div style={{ maxWidth: 680 }}>
      <FormSection
        title="SNS・外部リンク"
        desc="登録したリンクはプロフィールページに表示されます。"
      >
        {SNS_PLATFORMS.map((platform) => {
          const meta = SOCIAL_META[platform];
          return (
            <div
              key={platform}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 14,
              }}
            >
              {/* アイコン */}
              <span style={{ flexShrink: 0, width: 22, display: "flex", justifyContent: "center" }}>
                <SocialIcon platform={platform} size={20} />
              </span>

              {/* ラベル（固定幅で揃える） */}
              <span style={{
                width: 82, fontSize: 12, fontWeight: 600,
                color: "var(--ink)", flexShrink: 0,
                lineHeight: 1.4,
              }}>
                {meta.label}
              </span>

              {/* URL 入力欄 */}
              <input
                type="url"
                value={socialLinks[platform] ?? ""}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, [platform]: e.target.value }))}
                placeholder={meta.placeholder}
                style={{
                  ...inputStyle({ fontSize: 12 }),
                  flex: 1,
                }}
              />
            </div>
          );
        })}

        <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.7 }}>
          空欄の SNS はプロフィールページに表示されません。
        </div>
      </FormSection>
    </div>
  );
}

// ─── Education Editor ─────────────────────────────────────────────────────────

// Draft type for the education edit/add form
type EducationDraft = {
  school:        string;
  faculty:       string;
  degree:        string;
  enrolledYear:  string;
  enrolledMonth: string;
  graduatedYear: string;
  graduatedMonth: string;
  isCurrent:     boolean;
};

const EMPTY_EDU_DRAFT: EducationDraft = {
  school: "", faculty: "", degree: "",
  enrolledYear: "", enrolledMonth: "",
  graduatedYear: "", graduatedMonth: "",
  isCurrent: false,
};

function draftFromEducation(edu: Education): EducationDraft {
  const enrolledYM  = parseDateToYM(edu.enrolled_at);
  const graduatedYM = parseDateToYM(edu.graduated_at);
  return {
    school:         edu.school,
    faculty:        edu.faculty  ?? "",
    degree:         edu.degree   ?? "",
    enrolledYear:   enrolledYM.year,
    enrolledMonth:  enrolledYM.month,
    graduatedYear:  graduatedYM.year,
    graduatedMonth: graduatedYM.month,
    isCurrent:      edu.is_current,
  };
}

function formatEduPeriod(
  enrolledAt:  string | null,
  graduatedAt: string | null,
  isCurrent:   boolean,
): string {
  const fmt = (s: string) => {
    const [y, m] = s.split("-");
    return `${y}.${(m ?? "").padStart(2, "0")}`;
  };
  const start = enrolledAt  ? fmt(enrolledAt)  : "";
  const end   = graduatedAt ? fmt(graduatedAt) : "";
  if (isCurrent) return start ? `${start} 〜 在学中` : "在学中";
  if (start && end) return `${start} 〜 ${end}`;
  if (start) return `${start} 〜`;
  return "";
}

// ── EduIconButton ─────────────────────────────────────────────────────────────

function EduIconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: 26,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none",
        background: hovered
          ? danger ? "var(--error-soft)" : "var(--line-soft)"
          : "transparent",
        borderRadius: 5,
        fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer",
        transition: "background 0.12s",
        padding: 0,
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── EducationCard (display mode) ──────────────────────────────────────────────

function EducationCard({
  edu,
  onEdit,
  onDelete,
}: {
  edu: Education;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* School name + "在学中" badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {edu.school}
            </span>
            {edu.is_current && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: "var(--success)", background: "var(--success-soft)",
                borderRadius: 4, padding: "1px 6px",
                letterSpacing: "0.04em", flexShrink: 0,
              }}>
                在学中
              </span>
            )}
          </div>
          {/* Faculty / Degree */}
          {(edu.faculty || edu.degree) && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 1 }}>
              {[edu.faculty, edu.degree].filter(Boolean).join(" / ")}
            </div>
          )}
          {/* Period */}
          <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            {formatEduPeriod(edu.enrolled_at, edu.graduated_at, edu.is_current)}
          </div>
        </div>
        {/* Controls: ✎ and × on hover */}
        <div style={{
          display: "flex", alignItems: "center", gap: 1,
          opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0,
        }}>
          <EduIconButton onClick={onEdit} title="編集">✎</EduIconButton>
          <EduIconButton onClick={onDelete} title="削除" danger>×</EduIconButton>
        </div>
      </div>
    </div>
  );
}

// ── EducationForm (edit / add mode) ──────────────────────────────────────────

function EducationForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
}: {
  draft: EducationDraft;
  onDraftChange: (d: EducationDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = useCallback(
    (key: keyof EducationDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange],
  );

  const canSave = !!draft.school.trim() && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  const ef = (): React.CSSProperties => ({
    width: "100%", border: "1.5px solid var(--line)", borderRadius: 8,
    padding: "8px 10px", fontSize: 13, color: "var(--ink)",
    background: "#fff", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box", transition: "border-color 0.15s",
  });
  const el = (): React.CSSProperties => ({
    display: "block", fontSize: 11, fontWeight: 700,
    color: "var(--ink-mute)", letterSpacing: "0.08em",
    textTransform: "uppercase", marginBottom: 4,
  });
  const selectExtra: React.CSSProperties = {
    appearance: "none", paddingRight: 28,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
  };

  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1.5px solid var(--royal)",
      borderRadius: 10, padding: 16,
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
    }}>
      {/* 学校名 */}
      <div>
        <label style={el()}>学校名 *</label>
        <input
          type="text"
          value={draft.school}
          onChange={(e) => set("school", e.target.value)}
          placeholder="例：○○大学"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
      </div>

      {/* 学部・学科 */}
      <div>
        <label style={el()}>学部・学科（任意）</label>
        <input
          type="text"
          value={draft.faculty}
          onChange={(e) => set("faculty", e.target.value)}
          placeholder="例：経済学部 経営学科"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
      </div>

      {/* 学位 */}
      <div>
        <label style={el()}>学位（任意）</label>
        <select
          value={draft.degree}
          onChange={(e) => set("degree", e.target.value)}
          disabled={isSaving}
          style={{ ...ef(), ...selectExtra, cursor: isSaving ? "default" : "pointer" }}
        >
          <option value="">選択してください（任意）</option>
          {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* 入学年月 */}
      <div>
        <label style={el()}>入学年月</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={draft.enrolledYear}
            onChange={(e) => set("enrolledYear", e.target.value)}
            disabled={isSaving}
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: isSaving ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.enrolledMonth}
            onChange={(e) => set("enrolledMonth", e.target.value)}
            disabled={isSaving}
            style={{ ...ef(), ...selectExtra, flex: "0 0 72px", width: "auto", cursor: isSaving ? "default" : "pointer" }}
          >
            <option value="">月</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 在学中チェックボックス */}
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--ink-soft)", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={draft.isCurrent}
            onChange={(e) => set("isCurrent", e.target.checked)}
            style={{ accentColor: "var(--royal)", cursor: "pointer" }}
          />
          在学中
        </label>
      </div>

      {/* 卒業年月 */}
      <div style={{ opacity: draft.isCurrent ? 0.4 : 1, transition: "opacity 0.2s" }}>
        <label style={el()}>卒業年月</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={draft.graduatedYear}
            onChange={(e) => set("graduatedYear", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.graduatedMonth}
            onChange={(e) => set("graduatedMonth", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            style={{ ...ef(), ...selectExtra, flex: "0 0 72px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">月</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px", minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ── EducationEditor ───────────────────────────────────────────────────────────

function EducationEditor({
  educations,
  setEducations,
}: {
  educations: Education[];
  setEducations: React.Dispatch<React.SetStateAction<Education[]>>;
}) {
  // Edit state
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<EducationDraft>(EMPTY_EDU_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  // Add state
  const [adding,      setAdding]      = useState(false);
  const [addDraft,    setAddDraft]    = useState<EducationDraft>(EMPTY_EDU_DRAFT);
  const [addSaving,   setAddSaving]   = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Education | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  // Toast
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

  const showToast = useCallback(
    (msg: string, variant: "default" | "error" = "default") => {
      setToastVariant(variant);
      setToastMsg(msg);
    },
    [],
  );

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEdit = useCallback((edu: Education) => {
    setEditingId(edu.id);
    setEditDraft(draftFromEducation(edu));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_EDU_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const trimmedSchool = editDraft.school.trim();
    if (!trimmedSchool) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/educations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school:       trimmedSchool,
          faculty:      editDraft.faculty.trim() || null,
          degree:       editDraft.degree || null,
          enrolled_at:  formatYMToDate(editDraft.enrolledYear, editDraft.enrolledMonth),
          graduated_at: editDraft.isCurrent ? null : formatYMToDate(editDraft.graduatedYear, editDraft.graduatedMonth),
          is_current:   editDraft.isCurrent,
        }),
      });
      if (!res.ok) throw new Error();
      const updated: Education = await res.json();
      setEducations((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...updated } : e)));
      showToast("学歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null);
      setEditDraft(EMPTY_EDU_DRAFT);
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, setEducations, showToast]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAdding(false);
    setAddDraft(EMPTY_EDU_DRAFT);
  }, []);

  const saveAdd = useCallback(async () => {
    const trimmedSchool = addDraft.school.trim();
    if (!trimmedSchool) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/educations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school:       trimmedSchool,
          faculty:      addDraft.faculty.trim() || null,
          degree:       addDraft.degree || null,
          enrolled_at:  formatYMToDate(addDraft.enrolledYear, addDraft.enrolledMonth),
          graduated_at: addDraft.isCurrent ? null : formatYMToDate(addDraft.graduatedYear, addDraft.graduatedMonth),
          is_current:   addDraft.isCurrent,
        }),
      });
      if (!res.ok) throw new Error();
      const inserted: Education = await res.json();
      setEducations((prev) => [...prev, inserted]);
      showToast("学歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false);
      setAddDraft(EMPTY_EDU_DRAFT);
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, setEducations, showToast]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/educations/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEducations((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("学歴を削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, setEducations, showToast]);

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section header — フラット（職歴と同じ構造、白カードなし） */}
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
        学歴
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        大学・大学院・専門学校・高校などを登録できます。新しい順に入力することをおすすめします。
      </div>
      {/* Education list */}
      {educations.map((edu, idx) => (
        <div key={edu.id}>
          {editingId === edu.id ? (
            <EducationForm
              draft={editDraft}
              onDraftChange={setEditDraft}
              isSaving={editSaving}
              justSaved={editJustSaved}
              onSave={() => { void saveEdit(); }}
              onCancel={cancelEdit}
            />
          ) : (
            <EducationCard
              edu={edu}
              onEdit={() => startEdit(edu)}
              onDelete={() => setDeleteTarget(edu)}
            />
          )}
          {/* Divider */}
          {idx < educations.length - 1 && editingId !== edu.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}

      {/* Empty state */}
      {educations.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          学歴はまだ登録されていません
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ marginTop: educations.length > 0 ? 12 : 0 }}>
          <EducationForm
            draft={addDraft}
            onDraftChange={setAddDraft}
            isSaving={addSaving}
            justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }}
            onCancel={cancelAdd}
          />
        </div>
      )}

      {/* "+ 学歴を追加" button */}
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            marginTop: educations.length > 0 ? 10 : 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 5, padding: "8px 14px", width: "100%",
            background: "transparent", border: "1px dashed var(--line)",
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: "var(--ink-soft)", cursor: "pointer",
            fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          学歴を追加
        </button>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="学歴を削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.school}」の学歴を削除します。この操作は取り消せません。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

// ─── Certification Editor ─────────────────────────────────────────────────────

function CertCard({
  cert, onEdit, onDelete,
}: { cert: Certification; onEdit: () => void; onDelete: () => void; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", flex: 1, minWidth: 0 }}>
          {cert.name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <AchieveIconBtn onClick={onEdit} title="編集">✎</AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger>×</AchieveIconBtn>
        </div>
      </div>
    </div>
  );
}

function CertificationEditor({
  certifications,
  setCertifications,
}: {
  certifications: Certification[];
  setCertifications: React.Dispatch<React.SetStateAction<Certification[]>>;
}) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState("");
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState("");
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/certifications/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editDraft.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated: Certification = await res.json();
      setCertifications((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...updated } : c)));
      showToast("資格を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft("");
      setEditJustSaved(false);
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setCertifications, showToast]);

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addDraft.trim() }),
      });
      if (!res.ok) throw new Error();
      const inserted: Certification = await res.json();
      setCertifications((prev) => [...prev, inserted]);
      showToast("資格を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft("");
      setAddJustSaved(false);
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setCertifications, showToast]);

  const handleDelete = useCallback(async (cert: Certification) => {
    try {
      const res = await fetch(`/api/jobseeker/certifications/${cert.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCertifications((prev) => prev.filter((c) => c.id !== cert.id));
      showToast("資格を削除しました");
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
  }, [setCertifications, showToast]);

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>資格・認定</div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        取得済みの資格や認定を登録できます。新しい順に入力することをおすすめします。
      </div>
      {certifications.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          資格はまだ登録されていません
        </div>
      )}
      {certifications.map((cert, idx) => (
        <div key={cert.id}>
          {editingId === cert.id ? (
            <div style={formBox}>
              <div>
                <label style={ael()}>資格名 *</label>
                <input type="text" value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  placeholder="例：国家資格キャリアコンサルタント、AWS ソリューションアーキテクト…"
                  maxLength={100} disabled={editSaving} style={aef()} autoFocus />
              </div>
              <AchieveFormActions isSaving={editSaving} justSaved={editJustSaved} canSave={!!editDraft.trim() && !editSaving}
                onSave={() => { void saveEdit(); }}
                onCancel={() => { setEditingId(null); setEditDraft(""); }} />
            </div>
          ) : (
            <CertCard cert={cert}
              onEdit={() => { setEditingId(cert.id); setEditDraft(cert.name); }}
              onDelete={() => { void handleDelete(cert); }} />
          )}
          {idx < certifications.length - 1 && editingId !== cert.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}
      {adding && (
        <div style={{ marginTop: certifications.length > 0 ? 12 : 0 }}>
          <div style={formBox}>
            <div>
              <label style={ael()}>資格名 *</label>
              <input type="text" value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                placeholder="例：国家資格キャリアコンサルタント、AWS ソリューションアーキテクト…"
                maxLength={100} disabled={addSaving} style={aef()} autoFocus />
            </div>
            <AchieveFormActions isSaving={addSaving} justSaved={addJustSaved} canSave={!!addDraft.trim() && !addSaving}
              onSave={() => { void saveAdd(); }}
              onCancel={() => { setAdding(false); setAddDraft(""); }} />
          </div>
        </div>
      )}
      {!adding && <AddSectionBtn label="資格を追加" onClick={() => setAdding(true)} />}
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── 実績・受賞タブ — shared helpers ─────────────────────────────────────────

/** "2024-06-01" → "2024年6月" */
function fmtYM(s: string | null): string {
  if (!s) return "";
  const [y, m] = s.split("-");
  if (!y || !m) return s;
  return `${y}年${parseInt(m, 10)}月`;
}
/** "<input type=month>" value ("2024-06") → "2024-06-01" or null */
function monthToDate(s: string): string | null {
  return s ? `${s}-01` : null;
}
/** "2024-06-01" → "2024-06" (for <input type=month>) */
function dateToMonth(s: string | null): string {
  return s ? s.slice(0, 7) : "";
}

// ── shared micro-components ──────────────────────────────────────────────────

function AchieveIconBtn({
  onClick, title, danger, children,
}: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
        border: "none",
        background: hovered ? (danger ? "var(--error-soft)" : "var(--line-soft)") : "transparent",
        borderRadius: 5, fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer", transition: "background 0.12s", padding: 0, fontFamily: "inherit", flexShrink: 0,
      }}>{children}</button>
  );
}

const aef = (): React.CSSProperties => ({
  width: "100%", border: "1.5px solid var(--line)", borderRadius: 8,
  padding: "8px 10px", fontSize: 13, color: "var(--ink)",
  background: "#fff", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box", transition: "border-color 0.15s",
});
const ael = (): React.CSSProperties => ({
  display: "block", fontSize: 11, fontWeight: 700,
  color: "var(--ink-mute)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 4,
});
const formBox: React.CSSProperties = {
  background: "var(--bg-tint)", border: "1.5px solid var(--royal)", borderRadius: 10, padding: 16,
  display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
};
function AchieveFormActions({ isSaving, justSaved, canSave, onSave, onCancel }: {
  isSaving: boolean; justSaved?: boolean; canSave: boolean; onSave: () => void; onCancel: () => void;
}) {
  const effectivelyDisabled = !canSave || !!justSaved;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
      <button type="button" onClick={onCancel} disabled={isSaving}
        style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}>
        キャンセル
      </button>
      <button type="button" onClick={effectivelyDisabled ? undefined : onSave} disabled={effectivelyDisabled}
        style={{
          padding: "7px 18px", minWidth: 130,
          background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
        }}>
        {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
      </button>
    </div>
  );
}
function AddSectionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 14px", width: "100%", background: "transparent", border: "1px dashed var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s" }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>{label}
    </button>
  );
}

// ─── AchievementEditor ────────────────────────────────────────────────────────

type AchievementDraft = {
  title: string; value: string; unit: string;
  description: string; period_start: string; period_end: string;
};
const EMPTY_ACH_DRAFT: AchievementDraft = {
  title: "", value: "", unit: "", description: "", period_start: "", period_end: "",
};
function draftFromAch(a: Achievement): AchievementDraft {
  return {
    title: a.title, value: a.value !== null ? String(a.value) : "",
    unit: a.unit ?? "", description: a.description ?? "",
    period_start: dateToMonth(a.period_start), period_end: dateToMonth(a.period_end),
  };
}

function AchievementForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel,
}: { draft: AchievementDraft; onDraftChange: (d: AchievementDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; }) {
  const set = useCallback((k: keyof AchievementDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>タイトル（実績の名称）*</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：新規顧客獲得数 150%達成" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: "0 0 120px" }}>
          <label style={ael()}>数値（任意）</label>
          <input type="number" value={draft.value} onChange={(e) => set("value", e.target.value)}
            placeholder="例：150" disabled={isSaving} style={{ ...aef(), width: "100%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={ael()}>単位（任意）</label>
          <input type="text" value={draft.unit} onChange={(e) => set("unit", e.target.value)}
            placeholder="例：%、件、万円" maxLength={20} disabled={isSaving} style={aef()} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={ael()}>開始年月（任意）</label>
          <input type="month" value={draft.period_start} onChange={(e) => set("period_start", e.target.value)}
            disabled={isSaving} style={aef()} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={ael()}>終了年月（任意）</label>
          <input type="month" value={draft.period_end} onChange={(e) => set("period_end", e.target.value)}
            disabled={isSaving} style={aef()} />
        </div>
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="達成背景や取り組み内容など" maxLength={500} rows={3} disabled={isSaving}
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function AchievementCard({
  item, onEdit, onDelete,
}: { item: Achievement; onEdit: () => void; onDelete: () => void; }) {
  const [hovered, setHovered] = useState(false);
  const period = [fmtYM(item.period_start), fmtYM(item.period_end)].filter(Boolean).join(" 〜 ");
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{item.title}</span>
            {item.value !== null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "Inter, sans-serif" }}>
                {item.value.toLocaleString()}{item.unit || ""}
              </span>
            )}
          </div>
          {period && (
            <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>{period}</div>
          )}
          {item.description && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{item.description}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <AchieveIconBtn onClick={onEdit} title="編集">✎</AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger>×</AchieveIconBtn>
        </div>
      </div>
    </div>
  );
}

function AchievementEditor({
  achievements, setAchievements,
}: { achievements: Achievement[]; setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>; }) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const makeBody = (d: AchievementDraft) => ({
    title: d.title.trim(),
    value: d.value !== "" && !isNaN(parseInt(d.value, 10)) ? parseInt(d.value, 10) : null,
    unit: d.unit.trim() || null,
    description: d.description.trim() || null,
    period_start: monthToDate(d.period_start),
    period_end: monthToDate(d.period_end),
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/achievements/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: Achievement = await res.json();
      setAchievements((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
      showToast("実績を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_ACH_DRAFT);
      setEditJustSaved(false);
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setAchievements, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/achievements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: Achievement = await res.json();
      setAchievements((prev) => [...prev, inserted]);
      showToast("実績を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_ACH_DRAFT);
      setAddJustSaved(false);
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setAchievements, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/achievements/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAchievements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("実績を削除しました");
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setAchievements, showToast]);

  return (
    <div style={{ marginTop: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>数値実績</div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        定量的な成果を登録できます。売上達成率・顧客獲得数・コスト削減など。
      </div>
      {achievements.map((item, idx) => (
        <div key={item.id}>
          {editingId === item.id ? (
            <AchievementForm draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
              onSave={() => { void saveEdit(); }} onCancel={() => { setEditingId(null); setEditDraft(EMPTY_ACH_DRAFT); }} />
          ) : (
            <AchievementCard item={item} onEdit={() => { setEditingId(item.id); setEditDraft(draftFromAch(item)); }}
              onDelete={() => setDeleteTarget(item)} />
          )}
          {idx < achievements.length - 1 && editingId !== item.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}
      {achievements.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          数値実績はまだ登録されていません
        </div>
      )}
      {adding && (
        <div style={{ marginTop: achievements.length > 0 ? 12 : 0 }}>
          <AchievementForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }} onCancel={() => { setAdding(false); setAddDraft(EMPTY_ACH_DRAFT); }} />
        </div>
      )}
      {!adding && <AddSectionBtn label="数値実績を追加" onClick={() => setAdding(true)} />}
      <ConfirmDialog isOpen={!!deleteTarget} title="実績を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => setDeleteTarget(null)} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── AwardEditor ──────────────────────────────────────────────────────────────

type AwardDraft = { title: string; issuer: string; awarded_at: string; description: string; };
const EMPTY_AWARD_DRAFT: AwardDraft = { title: "", issuer: "", awarded_at: "", description: "" };
function draftFromAward(a: Award): AwardDraft {
  return { title: a.title, issuer: a.issuer ?? "", awarded_at: dateToMonth(a.awarded_at), description: a.description ?? "" };
}

function AwardForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel,
}: { draft: AwardDraft; onDraftChange: (d: AwardDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; }) {
  const set = useCallback((k: keyof AwardDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>受賞名 *</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：社内MVP賞、〇〇業界アワード最優秀賞" maxLength={200} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>授与機関（任意）</label>
        <input type="text" value={draft.issuer} onChange={(e) => set("issuer", e.target.value)}
          placeholder="例：株式会社○○、〇〇協会" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>受賞年月（任意）</label>
        <input type="month" value={draft.awarded_at} onChange={(e) => set("awarded_at", e.target.value)}
          disabled={isSaving} style={{ ...aef(), maxWidth: 180 }} />
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="受賞の背景や内容など" maxLength={500} rows={3} disabled={isSaving}
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function AwardCard({
  item, onEdit, onDelete,
}: { item: Award; onEdit: () => void; onDelete: () => void; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{item.title}</div>
          {(item.issuer || item.awarded_at) && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 1 }}>
              {[item.issuer, fmtYM(item.awarded_at)].filter(Boolean).join("　")}
            </div>
          )}
          {item.description && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{item.description}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <AchieveIconBtn onClick={onEdit} title="編集">✎</AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger>×</AchieveIconBtn>
        </div>
      </div>
    </div>
  );
}

function AwardEditor({
  awards, setAwards,
}: { awards: Award[]; setAwards: React.Dispatch<React.SetStateAction<Award[]>>; }) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<AwardDraft>(EMPTY_AWARD_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<AwardDraft>(EMPTY_AWARD_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const makeBody = (d: AwardDraft) => ({
    title: d.title.trim(), issuer: d.issuer.trim() || null,
    awarded_at: monthToDate(d.awarded_at), description: d.description.trim() || null,
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/awards/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: Award = await res.json();
      setAwards((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
      showToast("受賞歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_AWARD_DRAFT);
      setEditJustSaved(false);
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setAwards, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/awards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: Award = await res.json();
      setAwards((prev) => [...prev, inserted]);
      showToast("受賞歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_AWARD_DRAFT);
      setAddJustSaved(false);
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setAwards, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/awards/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAwards((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("受賞歴を削除しました");
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setAwards, showToast]);

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>受賞歴</div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        社内外のアワード・表彰・コンペ入賞などを登録できます。
      </div>
      {awards.map((item, idx) => (
        <div key={item.id}>
          {editingId === item.id ? (
            <AwardForm draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
              onSave={() => { void saveEdit(); }} onCancel={() => { setEditingId(null); setEditDraft(EMPTY_AWARD_DRAFT); }} />
          ) : (
            <AwardCard item={item} onEdit={() => { setEditingId(item.id); setEditDraft(draftFromAward(item)); }}
              onDelete={() => setDeleteTarget(item)} />
          )}
          {idx < awards.length - 1 && editingId !== item.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}
      {awards.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          受賞歴はまだ登録されていません
        </div>
      )}
      {adding && (
        <div style={{ marginTop: awards.length > 0 ? 12 : 0 }}>
          <AwardForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }} onCancel={() => { setAdding(false); setAddDraft(EMPTY_AWARD_DRAFT); }} />
        </div>
      )}
      {!adding && <AddSectionBtn label="受賞歴を追加" onClick={() => setAdding(true)} />}
      <ConfirmDialog isOpen={!!deleteTarget} title="受賞歴を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => setDeleteTarget(null)} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── MediaAppearanceEditor ────────────────────────────────────────────────────

type MediaAppearanceDraft = {
  title: string; media_name: string; url: string;
  thumbnail_url: string; appeared_at: string; description: string;
};
const EMPTY_MA_DRAFT: MediaAppearanceDraft = {
  title: "", media_name: "", url: "", thumbnail_url: "", appeared_at: "", description: "",
};
function draftFromMA(m: MediaAppearance): MediaAppearanceDraft {
  return {
    title: m.title, media_name: m.media_name ?? "", url: m.url ?? "",
    thumbnail_url: m.thumbnail_url ?? "", appeared_at: dateToMonth(m.appeared_at),
    description: m.description ?? "",
  };
}

function MediaAppearanceForm({
  draft, onDraftChange, isSaving, justSaved, onSave, onCancel,
}: { draft: MediaAppearanceDraft; onDraftChange: (d: MediaAppearanceDraft) => void; isSaving: boolean; justSaved?: boolean; onSave: () => void; onCancel: () => void; }) {
  const set = useCallback((k: keyof MediaAppearanceDraft, v: string) => onDraftChange({ ...draft, [k]: v }), [draft, onDraftChange]);
  const canSave = !!draft.title.trim() && !isSaving;
  return (
    <div style={formBox}>
      <div>
        <label style={ael()}>掲載タイトル *</label>
        <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)}
          placeholder="例：○○CEOインタビュー「SaaSの未来」" maxLength={200} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>媒体名（任意）</label>
        <input type="text" value={draft.media_name} onChange={(e) => set("media_name", e.target.value)}
          placeholder="例：Forbes Japan、日経ビジネス" maxLength={100} disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>掲載年月（任意）</label>
        <input type="month" value={draft.appeared_at} onChange={(e) => set("appeared_at", e.target.value)}
          disabled={isSaving} style={{ ...aef(), maxWidth: 180 }} />
      </div>
      <div>
        <label style={ael()}>URL（任意）</label>
        <input type="url" value={draft.url} onChange={(e) => set("url", e.target.value)}
          placeholder="https://..." disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>サムネイル URL（任意）</label>
        <input type="url" value={draft.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)}
          placeholder="https://..." disabled={isSaving} style={aef()} />
      </div>
      <div>
        <label style={ael()}>詳細（任意）</label>
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)}
          placeholder="掲載の背景や内容など" maxLength={500} rows={3} disabled={isSaving}
          style={{ ...aef(), resize: "vertical", minHeight: 72 }} />
      </div>
      <AchieveFormActions isSaving={isSaving} justSaved={justSaved} canSave={canSave} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function MediaAppearanceCard({
  item, onEdit, onDelete,
}: { item: MediaAppearance; onEdit: () => void; onDelete: () => void; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                {item.title}
              </a>
            ) : item.title}
          </div>
          {(item.media_name || item.appeared_at) && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 1 }}>
              {[item.media_name, fmtYM(item.appeared_at)].filter(Boolean).join("　")}
            </div>
          )}
          {item.description && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{item.description}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <AchieveIconBtn onClick={onEdit} title="編集">✎</AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger>×</AchieveIconBtn>
        </div>
      </div>
    </div>
  );
}

function MediaAppearanceEditor({
  mediaAppearances, setMediaAppearances,
}: { mediaAppearances: MediaAppearance[]; setMediaAppearances: React.Dispatch<React.SetStateAction<MediaAppearance[]>>; }) {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<MediaAppearanceDraft>(EMPTY_MA_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<MediaAppearanceDraft>(EMPTY_MA_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAppearance | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");
  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant); setToastMsg(msg);
  }, []);

  const makeBody = (d: MediaAppearanceDraft) => ({
    title: d.title.trim(), media_name: d.media_name.trim() || null,
    url: d.url.trim() || null, thumbnail_url: d.thumbnail_url.trim() || null,
    appeared_at: monthToDate(d.appeared_at), description: d.description.trim() || null,
  });

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/media-appearances/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: MediaAppearance = await res.json();
      setMediaAppearances((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...updated } : m)));
      showToast("メディア掲載を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null); setEditDraft(EMPTY_MA_DRAFT);
      setEditJustSaved(false);
    } catch { showToast("保存に失敗しました。もう一度お試しください。", "error"); }
    finally { setEditSaving(false); }
  }, [editingId, editDraft, setMediaAppearances, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/media-appearances", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft)),
      });
      if (!res.ok) throw new Error();
      const inserted: MediaAppearance = await res.json();
      setMediaAppearances((prev) => [...prev, inserted]);
      showToast("メディア掲載を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false); setAddDraft(EMPTY_MA_DRAFT);
      setAddJustSaved(false);
    } catch { showToast("追加に失敗しました。もう一度お試しください。", "error"); }
    finally { setAddSaving(false); }
  }, [addDraft, setMediaAppearances, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/media-appearances/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMediaAppearances((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null); showToast("メディア掲載を削除しました");
    } catch { showToast("削除に失敗しました。もう一度お試しください。", "error"); }
    finally { setDeleting(false); }
  }, [deleteTarget, setMediaAppearances, showToast]);

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>メディア掲載</div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        取材・インタビュー・記事掲載・登壇などを登録できます。
      </div>
      {mediaAppearances.map((item, idx) => (
        <div key={item.id}>
          {editingId === item.id ? (
            <MediaAppearanceForm draft={editDraft} onDraftChange={setEditDraft} isSaving={editSaving} justSaved={editJustSaved}
              onSave={() => { void saveEdit(); }} onCancel={() => { setEditingId(null); setEditDraft(EMPTY_MA_DRAFT); }} />
          ) : (
            <MediaAppearanceCard item={item} onEdit={() => { setEditingId(item.id); setEditDraft(draftFromMA(item)); }}
              onDelete={() => setDeleteTarget(item)} />
          )}
          {idx < mediaAppearances.length - 1 && editingId !== item.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}
      {mediaAppearances.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          メディア掲載はまだ登録されていません
        </div>
      )}
      {adding && (
        <div style={{ marginTop: mediaAppearances.length > 0 ? 12 : 0 }}>
          <MediaAppearanceForm draft={addDraft} onDraftChange={setAddDraft} isSaving={addSaving} justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }} onCancel={() => { setAdding(false); setAddDraft(EMPTY_MA_DRAFT); }} />
        </div>
      )}
      {!adding && <AddSectionBtn label="メディア掲載を追加" onClick={() => setAdding(true)} />}
      <ConfirmDialog isOpen={!!deleteTarget} title="メディア掲載を削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する" confirmVariant="danger" isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }} onCancel={() => setDeleteTarget(null)} />
      {toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileEditClient({
  owUser,
  authEmail,
  initialSkillTags,
  initialEducations,
  initialCertifications,
  initialSocialLinks,
  initialAchievements,
  initialAwards,
  initialMediaAppearances,
}: {
  owUser: OwUser;
  authEmail: string;
  initialSkillTags: SkillTag[];
  initialEducations: Education[];
  initialCertifications: Certification[];
  initialSocialLinks: SocialLinks;
  initialAchievements: Achievement[];
  initialAwards: Award[];
  initialMediaAppearances: MediaAppearance[];
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("basic");

  // ── アカウント設定タブの状態（明示保存方式） ────────────────────────────
  const [settings, setSettings] = useState<SettingsState>({
    avatarColor: owUser?.avatar_color ?? DEFAULT_AVATAR_COLOR,
    coverColor:  owUser?.cover_color  ?? DEFAULT_COVER_COLOR,
    visibility:  (owUser?.visibility ?? "public") as SettingsState["visibility"],
  });
  // 初期値を保持して変更検知（JSON.stringify 比較）
  const [initialSettings, setInitialSettings] = useState<SettingsState>({
    avatarColor: owUser?.avatar_color ?? DEFAULT_AVATAR_COLOR,
    coverColor:  owUser?.cover_color  ?? DEFAULT_COVER_COLOR,
    visibility:  (owUser?.visibility ?? "public") as SettingsState["visibility"],
  });
  const [accountSaving,       setAccountSaving]       = useState(false);
  const [accountJustSaved,    setAccountJustSaved]    = useState(false);
  const [accountToastMsg,     setAccountToastMsg]     = useState<string | null>(null);
  const [accountToastVariant, setAccountToastVariant] = useState<"default" | "error">("default");

  const isAccountDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSaveAccount = useCallback(async () => {
    setAccountSaving(true);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: settings.visibility }),
      });
      if (!res.ok) throw new Error();
      setInitialSettings(settings); // 保存成功: 次回比較の基準点を更新
      setAccountToastVariant("default");
      setAccountToastMsg("アカウント設定を保存しました");
      setAccountJustSaved(true);
      setTimeout(() => setAccountJustSaved(false), 3000);
    } catch {
      setAccountToastVariant("error");
      setAccountToastMsg("保存に失敗しました。もう一度お試しください。");
    } finally {
      setAccountSaving(false);
    }
  }, [settings]);

  const handleCancelAccount = useCallback(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  // ── スキルタブの状態 ─────────────────────────────────────────────────────
  const [skillTags, setSkillTags] = useState<SkillTag[]>(initialSkillTags);

  // ── 学歴タブの状態 ───────────────────────────────────────────────────────
  const [educations, setEducations] = useState<Education[]>(initialEducations);

  // ── 資格タブの状態 ───────────────────────────────────────────────────────
  const [certifications, setCertifications] = useState<Certification[]>(initialCertifications);

  // ── 実績・受賞タブの状態 ─────────────────────────────────────────────────
  const [achievements,     setAchievements]     = useState<Achievement[]>(initialAchievements);
  const [awards,           setAwards]           = useState<Award[]>(initialAwards);
  const [mediaAppearances, setMediaAppearances] = useState<MediaAppearance[]>(initialMediaAppearances);

  // ── SNS タブの状態（明示保存方式） ──────────────────────────────────────
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  // 保存済みの値を保持して変更検知（JSON.stringify 比較）
  const [savedSocialLinks, setSavedSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  const [socialSaving,       setSocialSaving]       = useState(false);
  const [socialJustSaved,    setSocialJustSaved]    = useState(false);
  const [socialToastMsg,     setSocialToastMsg]     = useState<string | null>(null);
  const [socialToastVariant, setSocialToastVariant] = useState<"default" | "error">("default");

  const isSocialDirty = JSON.stringify(socialLinks) !== JSON.stringify(savedSocialLinks);

  const handleSaveSocial = useCallback(async () => {
    setSocialSaving(true);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_links: socialLinks }),
      });
      if (!res.ok) throw new Error();
      setSavedSocialLinks(socialLinks); // 保存成功: 次回比較の基準点を更新
      setSocialToastVariant("default");
      setSocialToastMsg("SNS リンクを保存しました");
      setSocialJustSaved(true);
      setTimeout(() => setSocialJustSaved(false), 3000);
    } catch {
      setSocialToastVariant("error");
      setSocialToastMsg("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSocialSaving(false);
    }
  }, [socialLinks]);

  const handleCancelSocial = useCallback(() => {
    setSocialLinks(savedSocialLinks);
  }, [savedSocialLinks]);

  // ── 基本情報タブの状態 ────────────────────────────────────────────────────
  const parseBirthDate = (s: string | null): { year: string; month: string; day: string } => {
    if (!s) return { year: "", month: "", day: "" };
    const [y, m, d] = s.split("-");
    return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "", day: d ? String(parseInt(d, 10)) : "" };
  };
  const initialParsed = parseBirthDate(owUser?.birth_date ?? null);

  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name:              owUser?.name              ?? "",
    location:          owUser?.location          ?? "",
    aboutMe:           owUser?.about_me          ?? "",
    futureAspirations: owUser?.future_aspirations ?? "",
  });
  const [birthYear,  setBirthYear]  = useState<string>(initialParsed.year);
  const [birthMonth, setBirthMonth] = useState<string>(initialParsed.month);
  const [birthDay,   setBirthDay]   = useState<string>(initialParsed.day);

  // 変更検知用の初期値（保存成功時に更新）
  const [initialBasicInfo, setInitialBasicInfo] = useState<BasicInfo>({
    name:              owUser?.name              ?? "",
    location:          owUser?.location          ?? "",
    aboutMe:           owUser?.about_me          ?? "",
    futureAspirations: owUser?.future_aspirations ?? "",
  });
  const [initialBirthYear,  setInitialBirthYear]  = useState<string>(initialParsed.year);
  const [initialBirthMonth, setInitialBirthMonth] = useState<string>(initialParsed.month);
  const [initialBirthDay,   setInitialBirthDay]   = useState<string>(initialParsed.day);

  const [basicSaving,       setBasicSaving]       = useState(false);
  const [basicJustSaved,    setBasicJustSaved]    = useState(false);
  const [basicToastMsg,     setBasicToastMsg]     = useState<string | null>(null);
  const [basicToastVariant, setBasicToastVariant] = useState<"default" | "error">("default");

  const isBasicDirty =
    JSON.stringify(basicInfo) !== JSON.stringify(initialBasicInfo) ||
    birthYear  !== initialBirthYear  ||
    birthMonth !== initialBirthMonth ||
    birthDay   !== initialBirthDay;

  const handleSaveBasic = useCallback(async () => {
    setBasicSaving(true);
    try {
      const birthDate =
        birthYear && birthMonth && birthDay
          ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
          : null;
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:                basicInfo.name,
          location:            basicInfo.location,
          about_me:            basicInfo.aboutMe,
          future_aspirations:  basicInfo.futureAspirations,
          birth_date:          birthDate,
        }),
      });
      if (!res.ok) throw new Error();
      setInitialBasicInfo(basicInfo);
      setInitialBirthYear(birthYear);
      setInitialBirthMonth(birthMonth);
      setInitialBirthDay(birthDay);
      setBasicToastVariant("default");
      setBasicToastMsg("基本情報を保存しました");
      setBasicJustSaved(true);
      setTimeout(() => setBasicJustSaved(false), 3000);
    } catch {
      setBasicToastVariant("error");
      setBasicToastMsg("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBasicSaving(false);
    }
  }, [basicInfo, birthYear, birthMonth, birthDay]);

  const handleCancelBasic = useCallback(() => {
    setBasicInfo(initialBasicInfo);
    setBirthYear(initialBirthYear);
    setBirthMonth(initialBirthMonth);
    setBirthDay(initialBirthDay);
  }, [initialBasicInfo, initialBirthYear, initialBirthMonth, initialBirthDay]);

  return (
    <MypageMockProvider>
      <MypageLayout activeKey="profile">

        {/* ── ヘッダー行: タイトル + 保存状態 + ← マイページ ───────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
            color: "var(--ink)", margin: 0,
          }}>プロフィール</h1>
          <div style={{ marginLeft: "auto" }}>
            <Link
              href="/mypage"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", color: "var(--ink-soft)",
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              マイページ
            </Link>
          </div>
        </div>

        {/* ── タブナビゲーション ──────────────────────────────────────────────── */}
        <Tabs
          tabs={PROFILE_TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as ProfileTab)}
        />

        {/* ── タブコンテンツ ──────────────────────────────────────────────────── */}

        {/* 基本情報タブ */}
        {activeTab === "basic" && (
          <div style={{ maxWidth: 680 }}>

            {/* ── Section 1: 基本情報（名前・所在地・生年月日） ────────────── */}
            <FormSection
              title="基本情報"
              desc="プロフィールページに表示される情報です。"
            >
              <FormGroup label="名前">
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例：山田 太郎"
                  style={inputStyle()}
                />
              </FormGroup>

              <FormGroup label="所在地" hint="現在お住まいの都道府県を選択してください。">
                <div style={{ position: "relative" }}>
                  <select
                    value={basicInfo.location}
                    onChange={(e) => setBasicInfo((prev) => ({ ...prev, location: e.target.value }))}
                    style={selectStyle()}
                  >
                    <option value="">選択してください</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </FormGroup>

              <FormGroup
                label="生年月日"
                hint="生年月日を入力すると年齢が自動で計算されます。入力しない場合は年齢非公開となります。"
              >
                <div style={{ display: "flex", gap: 8 }}>
                  {/* 年 */}
                  <div style={{ position: "relative", flex: "0 0 110px" }}>
                    <select
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      style={selectStyle()}
                      aria-label="生年（年）"
                    >
                      <option value="">年</option>
                      {Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={String(y)}>{y}年</option>
                      ))}
                    </select>
                  </div>
                  {/* 月 */}
                  <div style={{ position: "relative", flex: "0 0 80px" }}>
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      style={selectStyle()}
                      aria-label="生年月日（月）"
                    >
                      <option value="">月</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={String(m)}>{m}月</option>
                      ))}
                    </select>
                  </div>
                  {/* 日 */}
                  <div style={{ position: "relative", flex: "0 0 80px" }}>
                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      style={selectStyle()}
                      aria-label="生年月日（日）"
                    >
                      <option value="">日</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>{d}日</option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormGroup>

            </FormSection>

            {/* ── Section 2: 自己紹介 ──────────────────────────────────────────── */}
            <FormSection
              title="自己紹介"
              desc="あなたのキャリアや想いを、企業・メンターに伝えるテキストです。200字を目安に。"
            >
              <TextareaField
                value={basicInfo.aboutMe}
                onChange={(v) => setBasicInfo((prev) => ({ ...prev, aboutMe: v }))}
                placeholder="例：リクルートで4年間営業を経験後、SaaS 企業に転じてカスタマーサクセスを担当。「人と組織の可能性を広げる仕事」を軸に、次のキャリアを模索しています。"
                softLimit={200}
                rows={5}
              />
            </FormSection>

            {/* ── Section 3: やってみたいこと ──────────────────────────────────── */}
            <FormSection
              title="この先やってみたいこと"
              desc="中長期でやってみたいこと、挑戦したいことを自由に書いてください。"
            >
              <TextareaField
                value={basicInfo.futureAspirations}
                onChange={(v) => setBasicInfo((prev) => ({ ...prev, futureAspirations: v }))}
                placeholder="例：プロダクトの企画段階から関わり、ユーザーインタビューを起点にして機能をゼロから作る経験をしてみたいです。将来的には自分でプロダクトを立ち上げることも視野に入れています。"
                softLimit={200}
                rows={5}
              />
            </FormSection>

            {/* ── 保存・キャンセルボタン ────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <button
                type="button"
                onClick={handleCancelBasic}
                disabled={!isBasicDirty || basicSaving || basicJustSaved}
                style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 600,
                  background: "#fff", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isBasicDirty || basicSaving || basicJustSaved ? "default" : "pointer",
                  opacity: !isBasicDirty || basicSaving || basicJustSaved ? 0.5 : 1,
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveBasic}
                disabled={!isBasicDirty || basicSaving || basicJustSaved}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 600, minWidth: 140,
                  background: basicJustSaved ? "var(--success)" : (!isBasicDirty || basicSaving) ? "var(--ink-mute)" : "var(--royal)",
                  color: "#fff",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isBasicDirty || basicSaving || basicJustSaved ? "default" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {basicSaving ? "保存中…" : basicJustSaved ? "✓ 保存しました" : "保存"}
              </button>
            </div>
            {basicToastMsg && (
              <Toast
                message={basicToastMsg}
                variant={basicToastVariant}
                onDone={() => setBasicToastMsg(null)}
              />
            )}

          </div>
        )}

        {/* 職歴・学歴タブ */}
        {activeTab === "career" && (
          <div style={{ maxWidth: 680 }}>
            <CareerHistoryEditor />
            <EducationEditor
              educations={educations}
              setEducations={setEducations}
            />
          </div>
        )}

        {/* スキルタブ */}
        {activeTab === "skills" && (
          <div style={{ maxWidth: 680 }}>
            <SkillTagsEditor
              skillTags={skillTags}
              setSkillTags={setSkillTags}
            />
          </div>
        )}

        {/* 資格タブ */}
        {activeTab === "certs" && (
          <CertificationEditor
            certifications={certifications}
            setCertifications={setCertifications}
          />
        )}

        {/* 実績・受賞タブ */}
        {activeTab === "achievements" && (
          <div style={{ maxWidth: 680 }}>
            <AchievementEditor achievements={achievements} setAchievements={setAchievements} />
            <AwardEditor awards={awards} setAwards={setAwards} />
            <MediaAppearanceEditor mediaAppearances={mediaAppearances} setMediaAppearances={setMediaAppearances} />
          </div>
        )}

        {/* SNS タブ */}
        {activeTab === "socials" && (
          <>
            <SocialLinksEditor
              socialLinks={socialLinks}
              setSocialLinks={setSocialLinks}
            />
            {/* 保存・キャンセルボタン */}
            <div style={{ maxWidth: 680, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <button
                type="button"
                onClick={handleCancelSocial}
                disabled={!isSocialDirty || socialSaving || socialJustSaved}
                style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 600,
                  background: "#fff", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isSocialDirty || socialSaving || socialJustSaved ? "default" : "pointer",
                  opacity: !isSocialDirty || socialSaving || socialJustSaved ? 0.5 : 1,
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveSocial}
                disabled={!isSocialDirty || socialSaving || socialJustSaved}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 600, minWidth: 140,
                  background: socialJustSaved ? "var(--success)" : (!isSocialDirty || socialSaving) ? "var(--ink-mute)" : "var(--royal)",
                  color: "#fff",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isSocialDirty || socialSaving || socialJustSaved ? "default" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {socialSaving ? "保存中…" : socialJustSaved ? "✓ 保存しました" : "保存"}
              </button>
            </div>
            {socialToastMsg && (
              <Toast
                message={socialToastMsg}
                variant={socialToastVariant}
                onDone={() => setSocialToastMsg(null)}
              />
            )}
          </>
        )}

        {/* アカウント設定タブ（動作） */}
        {activeTab === "account" && (
          <div style={{ maxWidth: 680 }}>

            {/* ── Section 1: プロフィール画像・カバー ──────────────────────── */}
            <FormSection
              title="プロフィール画像・カバー"
              desc="プロフィールページのヘッダーに表示されます。"
            >
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: 200, height: 80, borderRadius: "10px 10px 0 0",
                      background: settings.coverColor, position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 68, height: 68, borderRadius: "50%",
                        background: settings.avatarColor,
                        color: "#fff", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 26, fontWeight: 600,
                        border: "4px solid #fff",
                        position: "absolute", bottom: -34, left: 14,
                        boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
                      }}
                    >
                      {basicInfo.name.charAt(0) || "?"}
                    </div>
                  </div>
                  <div style={{ height: 34 }} />
                  <div style={{ fontSize: 10, color: "var(--ink-mute)", textAlign: "center", marginTop: 2 }}>
                    プレビュー
                  </div>
                </div>
                <div style={{ flex: 1, paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    プロフィール画像
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.7 }}>
                    未設定の場合、名前の頭文字で自動生成されます。
                  </div>
                  <button
                    type="button"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", background: "#fff", color: "var(--ink)",
                      border: "1px solid var(--line)", borderRadius: 6,
                      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      cursor: "not-allowed", opacity: 0.5,
                    }}
                    disabled
                    title="画像アップロードは近日公開予定です"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    画像をアップロード（近日公開）
                  </button>
                </div>
              </div>
            </FormSection>

            {/* ── Section 2: ログイン情報 ───────────────────────────────────── */}
            <FormSection title="ログイン情報">
              <FormGroup label="メールアドレス">
                <input
                  type="email"
                  value={authEmail}
                  readOnly
                  style={{ ...inputStyle(), background: "var(--bg-tint)", color: "var(--ink-soft)", cursor: "default" }}
                />
              </FormGroup>
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  パスワード
                </div>
                <button
                  type="button"
                  style={{
                    padding: "8px 16px", fontSize: 13, fontWeight: 600,
                    border: "1px solid var(--line)", borderRadius: 8,
                    background: "#fff", color: "var(--ink)", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  パスワードを変更
                </button>
              </div>
            </FormSection>

            {/* ── Section 3: プロフィールの公開設定 ───────────────────────── */}
            <FormSection
              title="プロフィールの公開設定"
              desc="プロフィールページを他のユーザーが閲覧できるかどうかを設定します。"
            >
              <FormGroup label="公開範囲">
                <select
                  value={settings.visibility}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, visibility: e.target.value as SettingsState["visibility"] }))
                  }
                  style={selectStyle()}
                >
                  <option value="public">すべてのOpinioユーザーに公開</option>
                  <option value="login_only">ログインユーザーのみ公開</option>
                  <option value="private">非公開（自分だけ見れる）</option>
                </select>
              </FormGroup>
            </FormSection>

            {/* ── Danger zone ──────────────────────────────────────────────── */}
            <div
              style={{
                background: "var(--error-soft)", border: "1px solid #FECACA",
                borderRadius: 14, padding: "20px 24px", marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--error)", marginBottom: 6 }}>
                ⚠ アカウント削除
              </div>
              <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 14, lineHeight: 1.7 }}>
                アカウントを削除すると、プロフィール・職歴・記事へのコメントなど、すべてのデータが完全に削除されます。
                取材済みの記事は掲載を続ける場合があります。この操作は取り消せません。
              </div>
              <button
                type="button"
                style={{
                  padding: "8px 16px", fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--error)", borderRadius: 8,
                  background: "#fff", color: "var(--error)", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                アカウントを削除する
              </button>
            </div>

            {/* ── アカウント設定タブの保存・キャンセル ───────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleCancelAccount}
                disabled={!isAccountDirty || accountSaving || accountJustSaved}
                style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 600,
                  background: "#fff", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isAccountDirty || accountSaving || accountJustSaved ? "default" : "pointer",
                  opacity: !isAccountDirty || accountSaving || accountJustSaved ? 0.5 : 1,
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                disabled={!isAccountDirty || accountSaving || accountJustSaved}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 600, minWidth: 140,
                  background: accountJustSaved ? "var(--success)" : (!isAccountDirty || accountSaving) ? "var(--ink-mute)" : "var(--royal)",
                  color: "#fff",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit",
                  cursor: !isAccountDirty || accountSaving || accountJustSaved ? "default" : "pointer",
                  transition: "background 0.2s",
                }}
              >
                {accountSaving ? "保存中…" : accountJustSaved ? "✓ 保存しました" : "保存"}
              </button>
            </div>
            {accountToastMsg && (
              <Toast
                message={accountToastMsg}
                variant={accountToastVariant}
                onDone={() => setAccountToastMsg(null)}
              />
            )}

          </div>
        )}

        <style>{`
          input:focus, textarea:focus, select:focus {
            border-color: var(--royal) !important;
            box-shadow: 0 0 0 3px var(--royal-50) !important;
          }
        `}</style>

      </MypageLayout>
    </MypageMockProvider>
  );
}
