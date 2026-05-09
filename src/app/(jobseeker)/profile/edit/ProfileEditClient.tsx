"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import CareerHistoryEditor from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS, AGE_RANGES } from "@/app/profile/edit/mockProfileData";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";

type SkillTag = { id: string; label: string; sort_order: number };

/** JSONB キー名は "twitter"（X の表示名と区別）。値は URL 文字列。空文字列 = 未設定。 */
type SocialLinks = Partial<Record<SocialPlatform, string>>;

type ProfileTab = "basic" | "career" | "skills" | "socials" | "account";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  visibility: string | null;
  location: string | null;
  age_range: string | null;
  about_me: string | null;
  future_aspirations: string | null;
  social_links: Record<string, string> | null;
} | null;

// ─── Basic info state ─────────────────────────────────────────────────────────

type BasicInfo = {
  name: string;
  location: string;
  ageRange: string;
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

const PROFILE_TABS: TabItem[] = [
  { key: "basic",   label: "基本情報" },
  { key: "career",  label: "職歴" },
  { key: "skills",  label: "スキル" },
  { key: "socials", label: "SNS" },
  { key: "account", label: "アカウント設定" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const saving = status === "saving";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 12, padding: "4px 10px", borderRadius: 100,
        color: saving ? "var(--ink-soft)" : "var(--success)",
        background: saving ? "var(--bg-tint)" : "var(--success-soft)",
        transition: "all 0.3s",
      }}
    >
      {saving ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          保存中...
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          自動保存されました
        </>
      )}
    </span>
  );
}

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
  setSaveStatus,
}: {
  skillTags: SkillTag[];
  setSkillTags: React.Dispatch<React.SetStateAction<SkillTag[]>>;
  setSaveStatus: (s: SaveStatus) => void;
}) {
  const [pendingLabel, setPendingLabel] = useState("");
  const [inputError, setInputError]     = useState<string | null>(null);

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
    setSaveStatus("saving");

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
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      // ロールバック: 仮チップを除去 + inline エラー
      setSkillTags((prev) => prev.filter((t) => t.id !== tempId));
      setInputError((e as Error).message ?? "保存に失敗しました。");
      setSaveStatus("idle");
    }
  };

  const handleDelete = async (tag: SkillTag) => {
    // 楽観更新: 即チップを除去
    setSkillTags((prev) => prev.filter((t) => t.id !== tag.id));
    setSaveStatus("saving");

    try {
      const res = await fetch(`/api/jobseeker/skill-tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("削除に失敗しました。");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      // ロールバック: sort_order 順で復元
      setSkillTags((prev) =>
        [...prev, tag].sort((a, b) => a.sort_order - b.sort_order)
      );
      setSaveStatus("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
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
  patchSocialLinks,
}: {
  socialLinks: SocialLinks;
  patchSocialLinks: (patch: Partial<SocialLinks>) => void;
}) {
  return (
    <div style={{ maxWidth: 680 }}>
      <FormSection
        title="SNS・外部リンク"
        desc="登録したリンクはプロフィールページに表示されます。変更すると自動で保存されます。"
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
                onChange={(e) => patchSocialLinks({ [platform]: e.target.value })}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileEditClient({
  owUser,
  authEmail,
  initialSkillTags,
  initialSocialLinks,
}: {
  owUser: OwUser;
  authEmail: string;
  initialSkillTags: SkillTag[];
  initialSocialLinks: SocialLinks;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("basic");

  // ── アカウント設定タブの状態 ────────────────────────────────────────────
  const [settings, setSettings] = useState<SettingsState>({
    avatarColor: owUser?.avatar_color ?? DEFAULT_AVATAR_COLOR,
    coverColor:  owUser?.cover_color  ?? DEFAULT_COVER_COLOR,
    visibility:  (owUser?.visibility ?? "public") as SettingsState["visibility"],
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const settingsRef = useRef<SettingsState>(settings);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: settingsRef.current.visibility }),
      }).catch(() => {});
      setSaveStatus("saved");
    }, 700);
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<SettingsState>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        settingsRef.current = next;
        return next;
      });
      triggerSave();
    },
    [triggerSave]
  );

  // ── スキルタブの状態 ─────────────────────────────────────────────────────
  const [skillTags, setSkillTags] = useState<SkillTag[]>(initialSkillTags);
  const [skillSaveStatus, setSkillSaveStatus] = useState<SaveStatus>("idle");

  // ── SNS タブの状態 ───────────────────────────────────────────────────────
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  const socialRef      = useRef<SocialLinks>(initialSocialLinks);
  const [socialSaveStatus, setSocialSaveStatus] = useState<SaveStatus>("idle");
  const socialSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchSocialLinks = useCallback((patch: Partial<SocialLinks>) => {
    setSocialLinks((prev) => {
      const next = { ...prev, ...patch };
      socialRef.current = next;
      return next;
    });
    setSocialSaveStatus("saving");
    if (socialSaveTimer.current) clearTimeout(socialSaveTimer.current);
    socialSaveTimer.current = setTimeout(async () => {
      await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ social_links: socialRef.current }),
      }).catch(() => {});
      setSocialSaveStatus("saved");
    }, 700);
  }, []);

  // ── 基本情報タブの状態（名前・所在地・年齢層） ──────────────────────────
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name:              owUser?.name              ?? "",
    location:          owUser?.location          ?? "",
    ageRange:          owUser?.age_range         ?? "",
    aboutMe:           owUser?.about_me          ?? "",
    futureAspirations: owUser?.future_aspirations ?? "",
  });
  const basicInfoRef   = useRef<BasicInfo>(basicInfo);
  const [basicSaveStatus, setBasicSaveStatus] = useState<SaveStatus>("idle");
  const basicSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchBasicInfo = useCallback((patch: Partial<BasicInfo>) => {
    setBasicInfo((prev) => {
      const next = { ...prev, ...patch };
      basicInfoRef.current = next;
      return next;
    });
    setBasicSaveStatus("saving");
    if (basicSaveTimer.current) clearTimeout(basicSaveTimer.current);
    basicSaveTimer.current = setTimeout(async () => {
      await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               basicInfoRef.current.name,
          location:           basicInfoRef.current.location,
          age_range:          basicInfoRef.current.ageRange,
          about_me:           basicInfoRef.current.aboutMe,
          future_aspirations: basicInfoRef.current.futureAspirations,
        }),
      }).catch(() => {});
      setBasicSaveStatus("saved");
    }, 700);
  }, []);

  return (
    <MypageMockProvider>
      <MypageLayout activeKey="profile">

        {/* ── ヘッダー行: タイトル + 保存状態 + ← マイページ ───────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
            color: "var(--ink)", margin: 0,
          }}>プロフィール</h1>
          {activeTab === "basic"   && <SaveStatusPill status={basicSaveStatus} />}
          {activeTab === "skills"  && <SaveStatusPill status={skillSaveStatus} />}
          {activeTab === "socials" && <SaveStatusPill status={socialSaveStatus} />}
          {activeTab === "account" && <SaveStatusPill status={saveStatus} />}
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

            {/* ── Section 1: 基本情報（名前・所在地・年齢層） ──────────────── */}
            <FormSection
              title="基本情報"
              desc="プロフィールページに表示される情報です。変更すると自動で保存されます。"
            >
              <FormGroup label="名前">
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={(e) => patchBasicInfo({ name: e.target.value })}
                  placeholder="例：山田 太郎"
                  style={inputStyle()}
                />
              </FormGroup>

              <FormGroup label="所在地" hint="現在お住まいの都道府県を選択してください。">
                <div style={{ position: "relative" }}>
                  <select
                    value={basicInfo.location}
                    onChange={(e) => patchBasicInfo({ location: e.target.value })}
                    style={selectStyle()}
                  >
                    <option value="">選択してください</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </FormGroup>

              <FormGroup label="年齢層" hint="おおよその年齢層を選択してください。">
                <div style={{ position: "relative" }}>
                  <select
                    value={basicInfo.ageRange}
                    onChange={(e) => patchBasicInfo({ ageRange: e.target.value })}
                    style={selectStyle()}
                  >
                    <option value="">選択してください</option>
                    {AGE_RANGES.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
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
                onChange={(v) => patchBasicInfo({ aboutMe: v })}
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
                onChange={(v) => patchBasicInfo({ futureAspirations: v })}
                placeholder="例：プロダクトの企画段階から関わり、ユーザーインタビューを起点にして機能をゼロから作る経験をしてみたいです。将来的には自分でプロダクトを立ち上げることも視野に入れています。"
                softLimit={200}
                rows={5}
              />
            </FormSection>

          </div>
        )}

        {/* 職歴タブ */}
        {activeTab === "career" && (
          <div style={{ maxWidth: 680 }}>
            <CareerHistoryEditor />
          </div>
        )}

        {/* スキルタブ */}
        {activeTab === "skills" && (
          <div style={{ maxWidth: 680 }}>
            <SkillTagsEditor
              skillTags={skillTags}
              setSkillTags={setSkillTags}
              setSaveStatus={setSkillSaveStatus}
            />
          </div>
        )}

        {/* SNS タブ */}
        {activeTab === "socials" && (
          <SocialLinksEditor
            socialLinks={socialLinks}
            patchSocialLinks={patchSocialLinks}
          />
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
                    patchSettings({ visibility: e.target.value as SettingsState["visibility"] })
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

            {/* ── アカウント設定タブの「保存」ボタン ──────────────────────── */}
            {/* 公開設定は自動保存のため、「保存」ボタンは情報提供用 */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
              <SaveStatusPill status={saveStatus} />
              <button
                type="button"
                onClick={triggerSave}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 600,
                  background: "var(--royal)", color: "#fff",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                変更を保存
              </button>
            </div>

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
