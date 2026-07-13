"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import CareerHistoryEditor, { type Stint } from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS } from "@/lib/profile/mockProfileData";
import { JOB_TYPE_CATEGORIES, JOB_TYPE_DISPLAY_LABELS, getVisibleCategories } from "@/lib/constants/jobTypes";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkillTag = { id: string; label: string; category?: string | null; sort_order: number };

type EducationSchoolMaster = {
  id: string;
  name: string;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
};

type Education = {
  id: string;
  school: string;
  school_id: string | null;             // Phase 3: FK to ow_schools (nullable)
  school_master: EducationSchoolMaster | null; // Phase 3: JOIN result
  faculty: string | null;
  degree: string | null;
  enrolled_at: string | null;
  graduated_at: string | null;
  is_current: boolean;
  sort_order: number;
};

// ow_schools マスター行型（Phase 5: datalist 候補用）
type School = {
  id: string;
  name: string;
  name_kana: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
  type: string;
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

type ContentLink = {
  id: string;
  url: string;
  platform: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
};

const PLATFORM_OPTIONS = [
  { value: "youtube",     label: "YouTube" },
  { value: "note",        label: "note" },
  { value: "zenn",        label: "Zenn" },
  { value: "speakerdeck", label: "Speaker Deck" },
  { value: "podcast",     label: "Podcast" },
  { value: "github",      label: "GitHub" },
  { value: "other",       label: "その他（Web記事など）" },
] as const;

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/note\.com/.test(url)) return "note";
  if (/zenn\.dev/.test(url)) return "zenn";
  if (/speakerdeck\.com/.test(url)) return "speakerdeck";
  if (/anchor\.fm|spotify\.com\/show|podcasts\.apple\.com/.test(url)) return "podcast";
  if (/github\.com/.test(url)) return "github";
  return "other";
}

type ProfileTab = "basic" | "career" | "skills" | "preferences" | "certs_achievements" | "socials_content" | "account";

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
  cover_color: string | null;
  cover_photo_url: string | null;
  visibility: string | null;
  location: string | null;
  birth_date: string | null;
  about_me: string | null;
  future_aspirations: string | null;
  is_open_to_work: boolean | null;
  can_talk_to_candidates: boolean | null;
  can_talk_to_hr: boolean | null;
  social_links: Record<string, string> | null;
} | null;

// ─── Basic info state ─────────────────────────────────────────────────────────

type BasicInfo = {
  name: string;
  location: string;
  aboutMe: string;
  strengthsFinder: string[];
};

type SettingsState = {
  avatarColor: string;
  coverColor: string;
  visibility: "public" | "login_only" | "private";
  isOpenToWork: boolean;
  canTalkToCandidates: boolean;
  canTalkToHr: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR_COLOR = "linear-gradient(135deg, var(--royal), #3B5FD9)";
const DEFAULT_COVER_COLOR  = "linear-gradient(135deg, var(--royal), #3B5FD9, #818CF8)";

// ─── ProfilePhotoUploader ─────────────────────────────────────────────────────

function ProfilePhotoUploader({
  owUser,
  basicInfoName,
  settings,
}: {
  owUser: OwUser;
  basicInfoName: string;
  settings: SettingsState;
}) {
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(owUser?.avatar_url ?? null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(owUser?.cover_photo_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File, type: "avatar" | "cover") => {
    if (!owUser?.id) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `users/${type}s/${owUser.id}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("ow-uploads")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error || !data) {
      console.error("[profile] upload failed:", error);
      setUploadError("写真のアップロードに失敗しました。ファイルサイズや形式を確認してください。");
      setTimeout(() => setUploadError(null), 5000);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from("ow-uploads").getPublicUrl(data.path);

    // DB に保存
    await fetch("/api/jobseeker/profile-photo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, url: publicUrl }),
    });
    return publicUrl;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadPhoto(file, "avatar");
    if (url) setAvatarUrl(url);
    setUploadingAvatar(false);
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    const url = await uploadPhoto(file, "cover");
    if (url) setCoverPhotoUrl(url);
    setUploadingCover(false);
  };

  const removePhoto = async (type: "avatar" | "cover") => {
    await fetch("/api/jobseeker/profile-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (type === "avatar") setAvatarUrl(null);
    else setCoverPhotoUrl(null);
  };

  const uploadBtn = (label: string, loading: boolean, onClick: () => void): React.ReactNode => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px", background: "#fff", color: "var(--ink)",
        border: "1px solid var(--line)", borderRadius: 6,
        fontFamily: "inherit", fontSize: "var(--text-xs)", fontWeight: 600,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      {loading ? "アップロード中..." : label}
    </button>
  );

  return (
    <div>
      {/* Upload error */}
      {uploadError && (
        <div role="alert" aria-live="polite" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", marginBottom: 14, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: "var(--text-sm)", color: "var(--error)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} aria-label="エラーを閉じる" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}
      {/* Preview */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          width: "100%", maxWidth: 360, borderRadius: 12, overflow: "hidden",
          border: "1px solid var(--line)", position: "relative",
        }}>
          {/* Cover */}
          <div style={{
            height: 90, position: "relative",
            background: coverPhotoUrl ? undefined : settings.coverColor,
            overflow: "hidden",
          }}>
            {coverPhotoUrl && (
              <Image src={coverPhotoUrl} alt="" fill style={{ objectFit: "cover" }} />
            )}
            {/* Upload cover overlay */}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.35)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "var(--text-xs)", fontWeight: 600, gap: 4,
                opacity: 0,
                transition: "opacity 0.2s",
              }}
              className="cover-upload-overlay"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              カバー写真を変更
            </button>
          </div>
          {/* Avatar */}
          <div style={{ padding: "0 14px 14px", marginTop: -28 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: avatarUrl ? undefined : settings.avatarColor,
                overflow: "hidden",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "var(--text-xl)", fontWeight: 600,
                border: "3px solid #fff",
                boxShadow: "0 2px 8px rgba(15,23,42,0.1)",
                cursor: "pointer",
              }}
              onClick={() => avatarInputRef.current?.click()}
              >
                {avatarUrl
                  ? <Image src={avatarUrl} alt="" fill style={{ objectFit: "cover" }} />
                  : (basicInfoName.charAt(0) || "?")}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "var(--royal)", border: "2px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <style>{`.cover-upload-overlay:hover { opacity: 1 !important; }`}</style>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6 }}>プレビュー（クリックで写真を変更）</div>
      </div>

      {/* Upload controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Avatar */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>プロフィール画像</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginBottom: "var(--space-2)", lineHeight: 1.7 }}>
            JPG / PNG・推奨サイズ 400×400px以上
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {uploadBtn("画像をアップロード", uploadingAvatar, () => avatarInputRef.current?.click())}
            {avatarUrl && (
              <button
                type="button"
                onClick={() => removePhoto("avatar")}
                style={{
                  padding: "7px 12px", fontSize: "var(--text-xs)", fontWeight: 600,
                  color: "var(--error)", border: "1px solid var(--error)",
                  background: "#fff", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                削除
              </button>
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>

        {/* Cover */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>カバー写真</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginBottom: "var(--space-2)", lineHeight: 1.7 }}>
            JPG / PNG・推奨サイズ 1200×400px以上（横長）
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {uploadBtn("カバー写真をアップロード", uploadingCover, () => coverInputRef.current?.click())}
            {coverPhotoUrl && (
              <button
                type="button"
                onClick={() => removePhoto("cover")}
                style={{
                  padding: "7px 12px", fontSize: "var(--text-xs)", fontWeight: 600,
                  color: "var(--error)", border: "1px solid var(--error)",
                  background: "#fff", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                削除
              </button>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
        </div>
      </div>
    </div>
  );
}

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
  { key: "basic",             label: "基本情報" },
  { key: "career",            label: "職歴・学歴" },
  { key: "skills",            label: "スキル" },
  { key: "preferences",       label: "希望条件" },
  { key: "certs_achievements", label: "資格・実績" },
  { key: "socials_content",   label: "SNS・発信" },
  { key: "account",           label: "アカウント設定" },
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
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: desc ? 6 : 20 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </section>
  );
}

function FormGroup({
  label, hint, children, htmlFor,
}: {
  label: string; hint?: string; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {htmlFor ? (
        <label htmlFor={htmlFor} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          {label}
        </label>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          {label}
        </div>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", padding: "10px var(--space-3)",
    border: "1.5px solid var(--line)", borderRadius: 8,
    fontFamily: "inherit", fontSize: "var(--text-sm)", color: "var(--ink)",
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

// ─── Notification Settings Section ───────────────────────────────────────────

const NOTIF_KEY = "opinio-notif-prefs";
type NotifPrefs = { newCompanies: boolean; weeklyMatch: boolean; articleNews: boolean };
const DEFAULT_NOTIF: NotifPrefs = { newCompanies: true, weeklyMatch: true, articleNews: false };

function loadNotifPrefs(): NotifPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIF;
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    if (!stored) return DEFAULT_NOTIF;
    return { ...DEFAULT_NOTIF, ...JSON.parse(stored) };
  } catch { return DEFAULT_NOTIF; }
}

function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPrefs(loadNotifPrefs()); }, []);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const items: { key: keyof NotifPrefs; label: string; desc: string; icon: string }[] = [
    { key: "newCompanies", label: "新着企業のお知らせ", desc: "新しい企業が掲載されたらメールでお知らせします（週1回）", icon: "🏢" },
    { key: "weeklyMatch",  label: "マッチング求人のお知らせ", desc: "あなたの希望条件に合う求人が追加されたらお知らせします（週1回）", icon: "💼" },
    { key: "articleNews",  label: "新着記事のお知らせ", desc: "OPINIOの新着取材記事が公開されたときにお知らせを受け取ります", icon: "📄" },
  ];

  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px 24px 20px", marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>メール通知設定</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            受け取りたいお知らせを選択してください。設定はいつでも変更できます。
          </div>
        </div>
        {saved && (
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            保存済み
          </span>
        )}
      </div>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {items.map(({ key, label, desc, icon }) => (
          <label
            key={key}
            style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "14px 16px", borderRadius: 10,
              border: `1px solid ${prefs[key] ? "var(--royal-100)" : "var(--line)"}`,
              background: prefs[key] ? "var(--royal-50)" : "var(--bg-tint)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "var(--text-lg)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.6 }}>{desc}</div>
            </div>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              {/* Toggle switch */}
              <div
                onClick={(e) => { e.preventDefault(); toggle(key); }}
                style={{
                  width: 40, height: 22, borderRadius: 100,
                  background: prefs[key] ? "var(--royal)" : "#CBD5E1",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3,
                  left: prefs[key] ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
          </label>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        💡 メール通知の配信は登録メールアドレスに送られます。迷惑メールフォルダもご確認ください。
      </div>
    </div>
  );
}

// ─── Placeholder Tab Content ──────────────────────────────────────────────────

function _PlaceholderTabContent({ label }: { label: string }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div
        style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "48px 32px",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "var(--space-3)", marginBottom: "var(--space-6)",
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
  const [newTagCategory, setNewTagCategory] = useState("");
  const [inputError, setInputError]     = useState<string | null>(null);
  const [skillToastMsg,     setSkillToastMsg]     = useState<string | null>(null);
  const [skillToastVariant, setSkillToastVariant] = useState<"default" | "error">("default");
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

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
    const category = newTagCategory || undefined;
    const tempTag: SkillTag = { id: tempId, label, category, sort_order: 9999 };
    setSkillTags((prev) => [...prev, tempTag]);
    setPendingLabel("");
    setNewTagCategory("");

    try {
      const res = await fetch("/api/jobseeker/skill-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, category: category ?? null }),
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
      // 即時フィードバック
      setAddedFeedback("この技術に注目している企業：12社（サンプル）");
      setTimeout(() => setAddedFeedback(null), 4000);
    } catch (e) {
      // ロールバック: 仮チップを除去 + inline エラー
      setSkillTags((prev) => prev.filter((t) => t.id !== tempId));
      setNewTagCategory(category ?? "");
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
      {/* why-fill hint */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "10px 12px", borderRadius: 8, marginBottom: 14,
        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{ fontSize: 12, color: "var(--royal)", lineHeight: 1.6 }}>
          埋めると、同じ技術スタックの企業ページで「相性の良い人」として表示されます
        </span>
      </div>

      {/* スキル追加直後の即時フィードバック */}
      {addedFeedback && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 8, marginBottom: 12,
          background: "var(--warm-soft)", border: "1px solid #FDE68A",
          animation: "fadeInUp 0.2s ease",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>{addedFeedback}</span>
        </div>
      )}

      {/* 確定済みタグのチップ列 */}
      {skillTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {skillTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px 5px 12px", borderRadius: 100,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                fontSize: "var(--text-sm)", color: "var(--royal)", fontWeight: 500,
                opacity: tag.id.startsWith("pending-") ? 0.55 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {tag.label}
              {tag.category && (
                <span style={{ fontSize: 9, color: "var(--ink-mute)", marginLeft: 4 }}>
                  {tag.category}
                </span>
              )}
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
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
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
                  fontSize: "var(--text-xs)",
                  color: charIsAmber ? "var(--warm)" : "var(--ink-mute)",
                  fontFamily: "Inter, sans-serif",
                  pointerEvents: "none",
                }}>
                  {charLen} / 50
                </span>
              )}
            </div>
            <select
              value={newTagCategory}
              onChange={(e) => setNewTagCategory(e.target.value)}
              aria-label="スキルカテゴリ"
              style={{
                padding: "7px 10px", borderRadius: 7,
                border: "1px solid var(--line)", fontSize: 12,
                fontFamily: "inherit", color: "var(--ink)",
                background: "#fff", flexShrink: 0,
              }}
            >
              <option value="">カテゴリなし</option>
              <option value="技術・開発">技術・開発</option>
              <option value="プロダクト・UX">プロダクト・UX</option>
              <option value="ビジネス・営業">ビジネス・営業</option>
              <option value="マーケティング">マーケティング</option>
              <option value="データ・分析">データ・分析</option>
              <option value="マネジメント">マネジメント</option>
              <option value="その他">その他</option>
            </select>
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-3)" }}>
        <span style={{
          fontSize: "var(--text-xs)", fontFamily: "Inter, sans-serif",
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
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  softLimit?: number;
  rows?: number;
  ariaLabel?: string;
}) {
  const len    = value.length;
  const isOver = len > softLimit;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        style={{
          ...inputStyle({ resize: "vertical", lineHeight: 1.8, minHeight: rows * 24 }),
        }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginTop: 6, gap: "var(--space-2)",
      }}>
        {isOver ? (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--warm)", lineHeight: 1.6, flex: 1 }}>
            {softLimit}字の目安を超えています。保存は可能ですが、読み手が読みやすい長さを意識してみてください。
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{
          fontSize: "var(--text-xs)",
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
                display: "flex", alignItems: "center", gap: "var(--space-3)",
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
  school_id:     string | null;  // Phase 5: FK to ow_schools (null = フリー入力 or 未選択)
  faculty:       string;
  degree:        string;
  enrolledYear:  string;
  enrolledMonth: string;
  graduatedYear: string;
  graduatedMonth: string;
  isCurrent:     boolean;
};

const EMPTY_EDU_DRAFT: EducationDraft = {
  school: "", school_id: null, faculty: "", degree: "",
  enrolledYear: "", enrolledMonth: "",
  graduatedYear: "", graduatedMonth: "",
  isCurrent: false,
};

function draftFromEducation(edu: Education): EducationDraft {
  const enrolledYM  = parseDateToYM(edu.enrolled_at);
  const graduatedYM = parseDateToYM(edu.graduated_at);
  return {
    school:         edu.school,
    school_id:      edu.school_id ?? null,  // Phase 5: 既存の school_id を引き継ぐ
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
        fontSize: "var(--text-sm)",
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
      style={{
        padding: "12px 14px",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--line)",
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      {/* Graduation cap icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: "linear-gradient(135deg, #7C3AED 0%, #a855f7 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      </div>

      {/* Content + controls */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* School name + "在学中" badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
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
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 2 }}>
              {[edu.faculty, edu.degree].filter(Boolean).join(" / ")}
            </div>
          )}
          {/* Period */}
          <div style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            {formatEduPeriod(edu.enrolled_at, edu.graduated_at, edu.is_current)}
          </div>
        </div>
        {/* Controls: ✎ and × on hover */}
        <div style={{
          display: "flex", alignItems: "center", gap: 1,
          opacity: hovered ? 1 : 0.45, transition: "opacity 0.15s", flexShrink: 0,
        }}>
          <EduIconButton onClick={onEdit} title="編集"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></EduIconButton>
          <EduIconButton onClick={onDelete} title="削除" danger><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></EduIconButton>
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
  schools,
}: {
  draft: EducationDraft;
  onDraftChange: (d: EducationDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
  schools: School[];
}) {
  const set = useCallback(
    (key: keyof EducationDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange],
  );

  const canSave = !!draft.school.trim() && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  const ef = (): React.CSSProperties => ({
    width: "100%", border: "1.5px solid transparent", borderRadius: 8,
    padding: "13px 14px", fontSize: 14, color: "var(--ink)",
    background: "#F2F4F7", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box", transition: "border-color 0.15s, background 0.15s",
  });
  const el = (): React.CSSProperties => ({
    display: "block", fontSize: 14, fontWeight: 700,
    color: "#111", marginBottom: 6,
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
      borderRadius: 10, padding: "var(--space-4)",
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
    }}>
      {/* 学校名 — Phase 5: datalist コンボボックス */}
      <div>
        <label htmlFor="edu-school" style={el()}>学校名 *</label>
        <input
          id="edu-school"
          type="text"
          list="school-options"
          value={draft.school}
          onChange={(e) => {
            let newSchool = e.target.value;
            // datalist の表示値は "name (name_kana)" 形式の場合があるため、
            // その形式と一致するマスターを先に探す（カナ検索でのマッチ）
            const displayMatched = schools.find((s) =>
              s.name_kana
                ? `${s.name} (${s.name_kana})` === newSchool
                : s.name === newSchool
            );
            if (displayMatched) {
              // カナ付き表示値 → クリーンな学校名に変換してから保存
              newSchool = displayMatched.name;
            }
            const matched =
              displayMatched ?? schools.find((s) => s.name === newSchool);
            onDraftChange({
              ...draft,
              school:    newSchool,
              school_id: matched?.id ?? null,
            });
          }}
          placeholder="例：○○大学（候補リストから選択または手動入力）"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
        <datalist id="school-options">
          {schools.map((s) => (
            <option
              key={s.id}
              value={s.name_kana ? `${s.name} (${s.name_kana})` : s.name}
            />
          ))}
        </datalist>
      </div>

      {/* 学位 */}
      <div>
        <label htmlFor="edu-degree" style={el()}>学校種別・学位（任意）</label>
        <select
          id="edu-degree"
          value={draft.degree}
          onChange={(e) => set("degree", e.target.value)}
          disabled={isSaving}
          style={{ ...ef(), ...selectExtra, cursor: isSaving ? "default" : "pointer" }}
        >
          <option value="">選択してください（任意）</option>
          <optgroup label="初等・中等教育">
            <option value="小学校卒">小学校卒</option>
            <option value="中学校卒">中学校卒</option>
            <option value="高校卒">高校卒</option>
          </optgroup>
          <optgroup label="高等教育">
            <option value="専門卒">専門卒</option>
            <option value="短大卒">短大卒</option>
            <option value="学士">学士</option>
            <option value="修士">修士</option>
            <option value="博士">博士</option>
          </optgroup>
          <option value="その他">その他</option>
        </select>
      </div>

      {/* 学部・学科 */}
      <div>
        <label htmlFor="edu-faculty" style={el()}>学部・学科（任意）</label>
        <input
          id="edu-faculty"
          type="text"
          value={draft.faculty}
          onChange={(e) => set("faculty", e.target.value)}
          placeholder="例：経済学部 経営学科"
          maxLength={100}
          disabled={isSaving}
          style={ef()}
        />
      </div>

      {/* 入学年月 */}
      <div>
        <label style={el()}>入学年月</label>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <select
            value={draft.enrolledYear}
            onChange={(e) => set("enrolledYear", e.target.value)}
            disabled={isSaving}
            aria-label="入学年"
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: isSaving ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.enrolledMonth}
            onChange={(e) => set("enrolledMonth", e.target.value)}
            disabled={isSaving}
            aria-label="入学月"
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
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <select
            value={draft.graduatedYear}
            onChange={(e) => set("graduatedYear", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            aria-label="卒業年"
            style={{ ...ef(), ...selectExtra, flex: "1 1 110px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">年</option>
            {EDU_YEAR_OPTS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={draft.graduatedMonth}
            onChange={(e) => set("graduatedMonth", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            aria-label="卒業月"
            style={{ ...ef(), ...selectExtra, flex: "0 0 72px", width: "auto", cursor: (isSaving || draft.isCurrent) ? "default" : "pointer" }}
          >
            <option value="">月</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: 2 }}>
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

// ── SchoolRequestBanner ───────────────────────────────────────────────────────

function SchoolRequestBanner({
  schoolName,
  kana,
  onKanaChange,
  status,
  error,
  onSubmit,
  onClose,
}: {
  schoolName: string;
  kana: string;
  onKanaChange: (v: string) => void;
  status: "idle" | "submitting" | "success" | "error";
  error: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const bannerBase: React.CSSProperties = {
    marginBottom: "var(--space-4)",
    padding: "14px var(--space-4)",
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 1.7,
  };

  if (status === "success") {
    return (
      <div style={{ ...bannerBase, background: "var(--success-soft)", border: "1px solid #6ee7b7", color: "var(--ink-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>
            ✓ 「{schoolName}」のマスター追加リクエストを送信しました
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0, padding: "3px 10px",
              background: "transparent", border: "1px solid var(--success)",
              borderRadius: 6, fontSize: 11, color: "var(--success)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...bannerBase, background: "var(--purple-soft)", border: "1px solid #c4b5fd", color: "var(--ink-soft)" }}>
      <div style={{ marginBottom: "var(--space-2)" }}>
        あなたの学校「<strong style={{ color: "var(--ink)" }}>{schoolName}</strong>」はマスターにありません。
        運営に追加リクエストを送信できます。
      </div>
      <div style={{ marginBottom: error ? 6 : 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ flexShrink: 0, color: "var(--ink-mute)" }}>ふりがな（任意）：</span>
          <input
            type="text"
            value={kana}
            onChange={(e) => onKanaChange(e.target.value)}
            placeholder="例: とうきょうだいがく"
            disabled={status === "submitting"}
            style={{
              flex: 1, minWidth: 0, padding: "4px var(--space-2)",
              border: "1px solid var(--line)", borderRadius: 6,
              fontSize: 12, fontFamily: "inherit",
              background: status === "submitting" ? "var(--bg-tint)" : "#fff",
            }}
          />
        </label>
      </div>
      {error && (
        <div style={{ marginBottom: 8, color: "var(--error)", fontSize: 11 }}>
          エラー: {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={status === "submitting"}
          style={{
            padding: "5px 14px",
            background: "var(--purple)", border: "none",
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: "#fff", cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {status === "submitting" ? "送信中..." : "リクエストを送る"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={status === "submitting"}
          style={{
            padding: "5px 14px",
            background: "transparent", border: "1px solid var(--line)",
            borderRadius: 6, fontSize: 12, color: "var(--ink-mute)",
            cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          今は送らない
        </button>
      </div>
    </div>
  );
}

// ── EducationEditor ───────────────────────────────────────────────────────────

function EducationEditor({
  educations,
  setEducations,
  schools,
}: {
  educations: Education[];
  setEducations: React.Dispatch<React.SetStateAction<Education[]>>;
  schools: School[];  // 段階6-7 Phase 1: ProfileEditClient トップレベルから受け取る
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
  // School request banner state（段階6-8 Phase 3）
  const [bannerSchoolName, setBannerSchoolName] = useState<string | null>(null);
  const [bannerKana,       setBannerKana]       = useState<string>("");
  const [bannerStatus,     setBannerStatus]     = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [bannerError,      setBannerError]      = useState<string>("");

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
          school_id:    editDraft.school_id,  // Phase 5: 明示的に送信(null = クリア, uuid = セット)
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
      // 段階6-8 Phase 3: school_id が null の場合、バナー表示
      if (updated.school_id === null && updated.school.trim().length > 0) {
        setBannerSchoolName(updated.school);
        setBannerKana("");
        setBannerStatus("idle");
        setBannerError("");
      }
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
          school_id:    addDraft.school_id,   // Phase 5: datalist 選択時にセットされた id
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
      // 段階6-8 Phase 3: school_id が null の場合、バナー表示
      if (inserted.school_id === null && inserted.school.trim().length > 0) {
        setBannerSchoolName(inserted.school);
        setBannerKana("");
        setBannerStatus("idle");
        setBannerError("");
      }
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

  // ── School request banner handlers（段階6-8 Phase 3）──────────────────────────
  const handleBannerSubmit = useCallback(async () => {
    if (!bannerSchoolName) return;
    setBannerStatus("submitting");
    setBannerError("");
    try {
      const res = await fetch("/api/jobseeker/school-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name:      bannerSchoolName,
          school_name_kana: bannerKana.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setBannerError(body.error ?? "リクエストの送信に失敗しました");
        setBannerStatus("error");
        return;
      }
      setBannerStatus("success");
    } catch {
      setBannerError("ネットワークエラーが発生しました");
      setBannerStatus("error");
    }
  }, [bannerSchoolName, bannerKana]);

  const handleBannerClose = useCallback(() => {
    setBannerSchoolName(null);
    setBannerKana("");
    setBannerStatus("idle");
    setBannerError("");
  }, []);

  return (
    <div style={{ marginTop: "var(--space-8)" }}>
      {/* Section header — フラット（職歴と同じ構造、白カードなし） */}
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
        学歴
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
        大学・大学院・専門学校・高校などを登録できます。新しい順に入力することをおすすめします。
      </div>
      {/* School request banner（段階6-8 Phase 3）— 教育リストの上に表示 */}
      {bannerSchoolName && (
        <SchoolRequestBanner
          schoolName={bannerSchoolName}
          kana={bannerKana}
          onKanaChange={setBannerKana}
          status={bannerStatus}
          error={bannerError}
          onSubmit={() => { void handleBannerSubmit(); }}
          onClose={handleBannerClose}
        />
      )}

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
              schools={schools}
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
            <div style={{ height: 8 }} />
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
            schools={schools}
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", flex: 1, minWidth: 0 }}>
          {cert.name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <AchieveIconBtn onClick={onEdit} title="編集"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></AchieveIconBtn>
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
        borderRadius: 5, fontSize: "var(--text-sm)",
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer", transition: "background 0.12s", padding: 0, fontFamily: "inherit", flexShrink: 0,
      }}>{children}</button>
  );
}

const aef = (): React.CSSProperties => ({
  width: "100%", border: "1.5px solid var(--line)", borderRadius: 8,
  padding: "8px 10px", fontSize: "var(--text-sm)", color: "var(--ink)",
  background: "#fff", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box", transition: "border-color 0.15s",
});
const ael = (): React.CSSProperties => ({
  display: "block", fontSize: "var(--text-xs)", fontWeight: 700,
  color: "var(--ink-mute)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 4,
});
const formBox: React.CSSProperties = {
  background: "var(--bg-tint)", border: "1.5px solid var(--royal)", borderRadius: 10, padding: "var(--space-4)",
  display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
};
function AchieveFormActions({ isSaving, justSaved, canSave, onSave, onCancel }: {
  isSaving: boolean; justSaved?: boolean; canSave: boolean; onSave: () => void; onCancel: () => void;
}) {
  const effectivelyDisabled = !canSave || !!justSaved;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: 2 }}>
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
          aria-label="実績の詳細"
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)" }}>{item.title}</span>
            {item.value !== null && (
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--accent)", fontFamily: "Inter, sans-serif" }}>
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
          <AchieveIconBtn onClick={onEdit} title="編集"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></AchieveIconBtn>
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
          aria-label="受賞の詳細"
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{item.title}</div>
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
          <AchieveIconBtn onClick={onEdit} title="編集"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></AchieveIconBtn>
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
          aria-label="メディア掲載の詳細"
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
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
          <AchieveIconBtn onClick={onEdit} title="編集"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></AchieveIconBtn>
          <AchieveIconBtn onClick={onDelete} title="削除" danger><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></AchieveIconBtn>
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

export type RoleItem = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
};

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
  initialExperiences,
  initialContentLinks,
  roles,
  isWelcome = false,
  initialScoutEnabled = null,
  initialProfilePrefs = null,
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
  initialExperiences: Stint[];
  initialContentLinks: ContentLink[];
  roles: RoleItem[];
  isWelcome?: boolean;
  initialScoutEnabled?: boolean | null;
  initialProfilePrefs?: {
    job_type: string | null;
    experience_years: string | null;
    desired_work_style: string | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
  } | null;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("basic");
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // ── 希望条件 (ow_profiles) state ─────────────────────────────────────────────
  const [prefJobType, setPrefJobType] = useState(initialProfilePrefs?.job_type ?? "");
  const [prefExpYears, setPrefExpYears] = useState(initialProfilePrefs?.experience_years ?? "");
  const [prefWorkStyle, setPrefWorkStyle] = useState(initialProfilePrefs?.desired_work_style ?? "");
  const [prefSalaryMin, setPrefSalaryMin] = useState(initialProfilePrefs?.desired_salary_min?.toString() ?? "");
  const [prefSalaryMax, setPrefSalaryMax] = useState(initialProfilePrefs?.desired_salary_max?.toString() ?? "");
  const [prefTiming, setPrefTiming] = useState(initialProfilePrefs?.transfer_timing ?? "");
  const [prefWorry, setPrefWorry] = useState(initialProfilePrefs?.worry ?? "");
  const [prefPhase, setPrefPhase] = useState<string[]>(initialProfilePrefs?.desired_phase ?? []);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const prefSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 発信コンテンツリンク state ──────────────────────────────────────────────
  const [contentLinks, setContentLinks] = useState<ContentLink[]>(initialContentLinks);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkDesc, setNewLinkDesc] = useState("");
  const [newLinkThumbnail, setNewLinkThumbnail] = useState<string | null>(null);
  const [newLinkPlatform, setNewLinkPlatform] = useState("other");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpFetched, setOgpFetched] = useState(false);

  const handleUrlBlur = async () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { return; } // 不正URLはスキップ
    setOgpFetching(true);
    setOgpFetched(false);
    try {
      const res = await fetch(`/api/jobseeker/content-links/ogp?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data: { title: string | null; thumbnail_url: string | null; description: string | null } = await res.json();
      if (data.title && !newLinkTitle.trim()) setNewLinkTitle(data.title);
      if (data.description && !newLinkDesc.trim()) setNewLinkDesc(data.description.slice(0, 200));
      if (data.thumbnail_url) setNewLinkThumbnail(data.thumbnail_url);
      if (data.title || data.thumbnail_url) setOgpFetched(true);
    } catch {
      // サイレントフェイル
    } finally {
      setOgpFetching(false);
    }
  };

  const handleAddContentLink = async () => {
    const url = newLinkUrl.trim();
    if (!url) { setLinkError("URLを入力してください"); return; }
    setLinkSaving(true); setLinkError(null);
    try {
      const res = await fetch("/api/jobseeker/content-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          platform: newLinkPlatform,
          title: newLinkTitle.trim() || null,
          description: newLinkDesc.trim() || null,
          thumbnail_url: newLinkThumbnail || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLinkError(err.message ?? "保存に失敗しました");
        return;
      }
      const inserted: ContentLink = await res.json();
      setContentLinks((prev) => [...prev, inserted]);
      setNewLinkUrl(""); setNewLinkTitle(""); setNewLinkDesc("");
      setNewLinkThumbnail(null); setNewLinkPlatform("other");
      setOgpFetched(false);
    } catch {
      setLinkError("通信エラーが発生しました");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteContentLink = async (id: string) => {
    setContentLinks((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/jobseeker/content-links/${id}`, { method: "DELETE" });
  };

  // ── グローバル保存ステータス（全タブ共通のインジケーター用） ─────────────
  // isSaving: いずれかのタブで保存中, justSaved: 直近3秒以内に保存完了
  const [globalSaveStatus, setGlobalSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // 各タブの保存アクション後にグローバルステータスを更新するヘルパー
  const notifyGlobalSave = useCallback((status: "saving" | "saved" | "error") => {
    setGlobalSaveStatus(status);
    if (status === "saved" || status === "error") {
      setTimeout(() => setGlobalSaveStatus("idle"), 4000);
    }
  }, []);

  // ── 希望条件 save callback（notifyGlobalSave 宣言後） ─────────────────────
  const savePreferences = useCallback(async (patch: Record<string, unknown>) => {
    setPrefSaving(true);
    notifyGlobalSave("saving");
    try {
      const res = await fetch("/api/jobseeker/career-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        if (prefSavedTimerRef.current) clearTimeout(prefSavedTimerRef.current);
        setPrefSaved(true);
        notifyGlobalSave("saved");
        prefSavedTimerRef.current = setTimeout(() => setPrefSaved(false), 3000);
      } else {
        notifyGlobalSave("error");
      }
    } catch { notifyGlobalSave("error"); }
    finally { setPrefSaving(false); }
  }, [notifyGlobalSave]);

  // ── schools マスター（段階6-7 Phase 1: EducationEditor から hoisted） ───────
  // EducationEditor が mount される度に fetch しないよう、ProfileEditClient
  // トップレベルで 1 度だけ fetch して props で渡す。
  const [schools, setSchools] = useState<School[]>([]);
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ow_schools")
      .select("id, name, name_kana, logo_letter, logo_gradient, logo_url, type")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setSchools(data as School[]);
      });
  }, []);

  // ── アカウント設定タブの状態（明示保存方式） ────────────────────────────
  const [settings, setSettings] = useState<SettingsState>({
    avatarColor:          owUser?.avatar_color  ?? DEFAULT_AVATAR_COLOR,
    coverColor:           owUser?.cover_color   ?? DEFAULT_COVER_COLOR,
    visibility:           (owUser?.visibility ?? "public") as SettingsState["visibility"],
    isOpenToWork:         owUser?.is_open_to_work         ?? false,
    canTalkToCandidates:  owUser?.can_talk_to_candidates  ?? false,
    canTalkToHr:          owUser?.can_talk_to_hr          ?? false,
  });
  // 初期値を保持して変更検知（JSON.stringify 比較）
  const [initialSettings, setInitialSettings] = useState<SettingsState>({
    avatarColor:          owUser?.avatar_color  ?? DEFAULT_AVATAR_COLOR,
    coverColor:           owUser?.cover_color   ?? DEFAULT_COVER_COLOR,
    visibility:           (owUser?.visibility ?? "public") as SettingsState["visibility"],
    isOpenToWork:         owUser?.is_open_to_work         ?? false,
    canTalkToCandidates:  owUser?.can_talk_to_candidates  ?? false,
    canTalkToHr:          owUser?.can_talk_to_hr          ?? false,
  });
  const [accountSaving,       setAccountSaving]       = useState(false);
  const [accountJustSaved,    setAccountJustSaved]    = useState(false);
  const [accountToastMsg,     setAccountToastMsg]     = useState<string | null>(null);
  const [accountToastVariant, setAccountToastVariant] = useState<"default" | "error">("default");

  const isAccountDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSaveAccount = useCallback(async () => {
    setAccountSaving(true);
    notifyGlobalSave("saving");
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility:             settings.visibility,
          is_open_to_work:        settings.isOpenToWork,
          can_talk_to_candidates: settings.canTalkToCandidates,
          can_talk_to_hr:         settings.canTalkToHr,
        }),
      });
      if (!res.ok) throw new Error();
      setInitialSettings(settings); // 保存成功: 次回比較の基準点を更新
      setAccountToastVariant("default");
      setAccountToastMsg("アカウント設定を保存しました");
      setAccountJustSaved(true);
      notifyGlobalSave("saved");
      setTimeout(() => setAccountJustSaved(false), 3000);
    } catch {
      setAccountToastVariant("error");
      setAccountToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setAccountSaving(false);
    }
  }, [settings, notifyGlobalSave]);

  const handleCancelAccount = useCallback(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  // ── スカウト設定の状態（ow_profiles.scout_enabled） ─────────────────────
  const [scoutEnabled, setScoutEnabled] = useState<boolean | null>(initialScoutEnabled ?? null);
  const [scoutSaving, setScoutSaving] = useState(false);
  const [scoutSaved, setScoutSaved] = useState(false);

  type BlockedCompany = {
    id: string | null;
    company_id: string | null;
    company_name: string;
    block_reason: "experience" | "manual";
  };
  const [blockedCompanies, setBlockedCompanies] = useState<BlockedCompany[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  const loadBlockedCompanies = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const res = await fetch("/api/jobseeker/scout-settings");
      if (res.ok) {
        const data = await res.json();
        setBlockedCompanies(data.blocks ?? []);
      }
    } catch {
      // best-effort
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedCompanies();
  }, [loadBlockedCompanies]);

  const handleRemoveBlock = useCallback(async (blockId: string) => {
    setRemovingBlockId(blockId);
    try {
      await fetch(`/api/jobseeker/scout-settings?id=${blockId}`, { method: "DELETE" });
      setBlockedCompanies(prev => prev.filter(b => b.id !== blockId));
    } catch {
      // best-effort
    } finally {
      setRemovingBlockId(null);
    }
  }, []);

  // 企業追加ブロック
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [blockSearchLoading, setBlockSearchLoading] = useState(false);
  const [addingBlockId, setAddingBlockId] = useState<string | null>(null);
  const blockSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBlockSearch = useCallback((q: string) => {
    setBlockSearchQuery(q);
    if (blockSearchTimer.current) clearTimeout(blockSearchTimer.current);
    if (!q.trim()) { setBlockSearchResults([]); return; }
    blockSearchTimer.current = setTimeout(async () => {
      setBlockSearchLoading(true);
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q.trim())}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setBlockSearchResults((data.results ?? []) as { id: string; name: string }[]);
        }
      } catch {
        // best-effort
      } finally {
        setBlockSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleAddBlock = useCallback(async (company: { id: string; name: string }) => {
    setAddingBlockId(company.id);
    try {
      const res = await fetch("/api/jobseeker/scout-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id }),
      });
      if (res.ok) {
        setBlockedCompanies(prev => {
          if (prev.some(b => b.company_id === company.id)) return prev;
          return [...prev, { id: null, company_id: company.id, company_name: company.name, block_reason: "manual" }];
        });
        // reload to get the real block id
        await loadBlockedCompanies();
        setBlockSearchQuery("");
        setBlockSearchResults([]);
      }
    } catch {
      // best-effort
    } finally {
      setAddingBlockId(null);
    }
  }, [loadBlockedCompanies]);

  const handleSaveScout = useCallback(async (value: boolean | null) => {
    setScoutEnabled(value);
    setScoutSaving(true);
    try {
      await fetch("/api/jobseeker/scout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_enabled: value }),
      });
      setScoutSaved(true);
      setTimeout(() => setScoutSaved(false), 2000);
    } catch {
      // best-effort
    } finally {
      setScoutSaving(false);
    }
  }, []);

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
    notifyGlobalSave("saving");
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
      notifyGlobalSave("saved");
      setTimeout(() => setSocialJustSaved(false), 3000);
    } catch {
      setSocialToastVariant("error");
      setSocialToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setSocialSaving(false);
    }
  }, [socialLinks, notifyGlobalSave]);

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
    name:             owUser?.name      ?? "",
    location:         owUser?.location  ?? "",
    aboutMe:          owUser?.about_me  ?? "",
    strengthsFinder:  [],
  });
  const [birthYear,  setBirthYear]  = useState<string>(initialParsed.year);
  const [birthMonth, setBirthMonth] = useState<string>(initialParsed.month);
  const [birthDay,   setBirthDay]   = useState<string>(initialParsed.day);

  // 変更検知用の初期値（保存成功時に更新）
  const [initialBasicInfo, setInitialBasicInfo] = useState<BasicInfo>({
    name:             owUser?.name      ?? "",
    location:         owUser?.location  ?? "",
    aboutMe:          owUser?.about_me  ?? "",
    strengthsFinder:  [],
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
    notifyGlobalSave("saving");
    try {
      const birthDate =
        birthYear && birthMonth && birthDay
          ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
          : null;
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:             basicInfo.name,
          location:         basicInfo.location,
          about_me:         basicInfo.aboutMe,
          birth_date:       birthDate,
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
      notifyGlobalSave("saved");
      setTimeout(() => setBasicJustSaved(false), 3000);
    } catch {
      setBasicToastVariant("error");
      setBasicToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setBasicSaving(false);
    }
  }, [basicInfo, birthYear, birthMonth, birthDay, notifyGlobalSave]);

  const handleCancelBasic = useCallback(() => {
    setBasicInfo(initialBasicInfo);
    setBirthYear(initialBirthYear);
    setBirthMonth(initialBirthMonth);
    setBirthDay(initialBirthDay);
  }, [initialBasicInfo, initialBirthYear, initialBirthMonth, initialBirthDay]);

  // ── タブ完成度（各タブにデータがあれば green dot） ─────────────────────────
  const tabCompletion: Record<ProfileTab, boolean> = {
    basic:             !!(basicInfo.name.trim() || basicInfo.aboutMe.trim()),
    career:            initialExperiences.length > 0 || educations.length > 0,
    skills:            skillTags.length > 0,
    preferences:       !!(prefJobType || prefWorkStyle || prefSalaryMin || prefSalaryMax || prefTiming),
    certs_achievements: certifications.length > 0 || achievements.length > 0 || awards.length > 0 || mediaAppearances.length > 0,
    socials_content:   Object.values(socialLinks).some((v) => !!v) || contentLinks.length > 0,
    account:           true,
  };

  const profileTabsWithCompletion = PROFILE_TABS.map((tab) => ({
    ...tab,
    completed: tabCompletion[tab.key as ProfileTab],
  }));

  return (
    <MypageMockProvider>
      <MypageLayout activeKey="profile">

        {/* ── ウェルカムバナー（新規登録後 ?welcome=1 のみ表示） ─────────────── */}
        {isWelcome && !welcomeDismissed && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
            border: "1.5px solid #F59E0B",
            borderRadius: 14,
            padding: "var(--space-4) 20px",
            marginBottom: "var(--space-6)",
            marginTop: -8,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "#F59E0B",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                <path d="M6 14a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-3" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "#92400E", marginBottom: 4 }}>
                ようこそ！まずはプロフィールを完成させましょう
              </div>
              <div style={{ fontSize: 12, color: "#B45309", lineHeight: 1.7 }}>
                自己紹介・職歴・スキルを入力すると、企業のカジュアル面談やメンター相談が
                スムーズになります。<strong>入力内容は自動保存</strong>されます。
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { tab: "basic" as ProfileTab, label: "① 基本情報" },
                  { tab: "career" as ProfileTab, label: "② 職歴" },
                  { tab: "skills" as ProfileTab, label: "③ スキル" },
                ].map(({ tab, label }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "4px 12px", borderRadius: 100,
                      background: activeTab === tab ? "#F59E0B" : "rgba(245,158,11,0.15)",
                      color: activeTab === tab ? "#fff" : "#92400E",
                      border: `1px solid ${activeTab === tab ? "#D97706" : "transparent"}`,
                      fontFamily: "inherit", fontSize: "var(--text-xs)", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="バナーを閉じる"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#B45309", padding: 4, flexShrink: 0,
                fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── ヘッダー行: タイトル + 保存状態 + ← マイページ ───────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: -16, marginBottom: "var(--space-3)" }}>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: "var(--text-xl)", fontWeight: 700,
            color: "var(--ink)", margin: 0,
          }}>プロフィール</h1>

          {/* グローバル保存ステータスインジケーター */}
          {globalSaveStatus !== "idle" && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600,
              background: globalSaveStatus === "saved" ? "var(--success-soft)" : globalSaveStatus === "error" ? "var(--error-soft)" : "var(--bg-tint)",
              color: globalSaveStatus === "saved" ? "var(--success)" : globalSaveStatus === "error" ? "var(--error)" : "var(--ink-mute)",
              border: `1px solid ${globalSaveStatus === "saved" ? "#6ee7b7" : globalSaveStatus === "error" ? "#FCA5A5" : "var(--line)"}`,
              transition: "all 0.2s",
            }}>
              {globalSaveStatus === "saving" ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" strokeDasharray="56" strokeDashoffset="14" />
                  </svg>
                  保存中…
                </>
              ) : globalSaveStatus === "error" ? (
                <>⚠ 保存失敗 — 再度お試しください</>
              ) : (
                <>✓ 保存済み</>
              )}
            </div>
          )}

          <div style={{ marginLeft: "auto" }}>
            <Link
              href="/mypage"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", fontWeight: 600,
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
          tabs={profileTabsWithCompletion}
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
              <FormGroup label="名前" htmlFor="pe-name">
                <input
                  id="pe-name"
                  type="text"
                  value={basicInfo.name}
                  autoComplete="name"
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例：山田 太郎"
                  style={inputStyle()}
                />
              </FormGroup>

              <FormGroup label="所在地" hint="現在お住まいの都道府県を選択してください。" htmlFor="pe-location">
                <div style={{ position: "relative" }}>
                  <select
                    id="pe-location"
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
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
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
                ariaLabel="自己紹介"
              />
            </FormSection>

            {/* ── Section 3: StrengthsFinder ───────────────────────────────────── */}
            <FormSection
              title="StrengthsFinder TOP5"
              desc="CliftonStrengths（ストレングスファインダー）の診断結果を登録すると、公開プロフィールのサイドバーに表示されます。"
            >
              {(() => {
                const ALL_THEMES: { name: string; domain: string }[] = [
                  // 実行力
                  { name: "達成欲",   domain: "実行力" },
                  { name: "アレンジ", domain: "実行力" },
                  { name: "信念",     domain: "実行力" },
                  { name: "公平性",   domain: "実行力" },
                  { name: "慎重さ",   domain: "実行力" },
                  { name: "規律性",   domain: "実行力" },
                  { name: "集中力",   domain: "実行力" },
                  { name: "責任感",   domain: "実行力" },
                  { name: "回復志向", domain: "実行力" },
                  // 影響力
                  { name: "活発性",           domain: "影響力" },
                  { name: "指揮",             domain: "影響力" },
                  { name: "コミュニケーション", domain: "影響力" },
                  { name: "競争性",           domain: "影響力" },
                  { name: "最上志向",         domain: "影響力" },
                  { name: "自己確信",         domain: "影響力" },
                  { name: "自我",             domain: "影響力" },
                  { name: "社交性",           domain: "影響力" },
                  // 人間関係構築
                  { name: "適応性",   domain: "関係構築" },
                  { name: "つながり", domain: "関係構築" },
                  { name: "成長促進", domain: "関係構築" },
                  { name: "共感",     domain: "関係構築" },
                  { name: "調和性",   domain: "関係構築" },
                  { name: "包含",     domain: "関係構築" },
                  { name: "個別化",   domain: "関係構築" },
                  { name: "ポジティブ", domain: "関係構築" },
                  { name: "親密性",   domain: "関係構築" },
                  // 戦略的思考
                  { name: "分析思考", domain: "戦略思考" },
                  { name: "文脈",     domain: "戦略思考" },
                  { name: "未来志向", domain: "戦略思考" },
                  { name: "着想",     domain: "戦略思考" },
                  { name: "収集心",   domain: "戦略思考" },
                  { name: "内省",     domain: "戦略思考" },
                  { name: "学習欲",   domain: "戦略思考" },
                  { name: "戦略性",   domain: "戦略思考" },
                ];

                const DOMAIN_COLORS: Record<string, string> = {
                  "実行力": "#7C3AED",
                  "影響力": "#D97706",
                  "関係構築": "var(--success)",
                  "戦略思考": "var(--royal)",
                };

                const current = basicInfo.strengthsFinder;

                const setStrength = (idx: number, val: string) => {
                  setBasicInfo((prev) => {
                    const next = [...prev.strengthsFinder];
                    if (val === "") {
                      next.splice(idx, 1);
                    } else {
                      next[idx] = val;
                    }
                    return { ...prev, strengthsFinder: next };
                  });
                };

                const removeStrength = (idx: number) => {
                  setBasicInfo((prev) => {
                    const next = [...prev.strengthsFinder];
                    next.splice(idx, 1);
                    return { ...prev, strengthsFinder: next };
                  });
                };

                const slots = Array.from({ length: Math.min(5, current.length + 1) });
                if (slots.length < 5 && current.length < 5) slots.push(undefined);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const val = current[idx] ?? "";
                      const domain = ALL_THEMES.find(t => t.name === val)?.domain;
                      const color = domain ? DOMAIN_COLORS[domain] : undefined;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          {/* 順位バッジ */}
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                            background: val ? (color ?? "var(--royal)") : "var(--line)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: val ? "#fff" : "var(--ink-mute)",
                            fontFamily: "Inter, sans-serif", transition: "background 0.2s",
                          }}>
                            {idx + 1}
                          </div>
                          {/* ドロップダウン */}
                          <select
                            value={val}
                            onChange={(e) => setStrength(idx, e.target.value)}
                            style={{
                              flex: 1,
                              padding: "7px 10px", borderRadius: 7,
                              border: `1.5px solid ${val ? (color ?? "var(--royal)") : "var(--line)"}`,
                              fontSize: "var(--text-sm)", fontFamily: "inherit",
                              color: val ? (color ?? "var(--ink)") : "var(--ink-mute)",
                              fontWeight: val ? 600 : 400,
                              background: "#fff",
                              cursor: "pointer",
                              outline: "none",
                              transition: "border-color 0.15s",
                            }}
                          >
                            <option value="">{idx === 0 ? "1位を選択…" : `${idx + 1}位を選択（任意）`}</option>
                            <optgroup label="── 実行力 ──">
                              {ALL_THEMES.filter(t => t.domain === "実行力").map(t => (
                                <option key={t.name} value={t.name} disabled={current.includes(t.name) && current[idx] !== t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="── 影響力 ──">
                              {ALL_THEMES.filter(t => t.domain === "影響力").map(t => (
                                <option key={t.name} value={t.name} disabled={current.includes(t.name) && current[idx] !== t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="── 関係構築 ──">
                              {ALL_THEMES.filter(t => t.domain === "関係構築").map(t => (
                                <option key={t.name} value={t.name} disabled={current.includes(t.name) && current[idx] !== t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="── 戦略的思考 ──">
                              {ALL_THEMES.filter(t => t.domain === "戦略思考").map(t => (
                                <option key={t.name} value={t.name} disabled={current.includes(t.name) && current[idx] !== t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {/* 削除ボタン */}
                          {val && (
                            <button
                              type="button"
                              onClick={() => removeStrength(idx)}
                              style={{
                                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                background: "var(--line)", border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", fontSize: 13, color: "var(--ink-mute)",
                                fontFamily: "inherit",
                              }}
                              title="削除"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: "4px 0 0", lineHeight: 1.6 }}>
                      未受診の場合は空欄のままで OK。順位どおりに入力してください。
                    </p>
                  </div>
                );
              })()}
            </FormSection>

            {/* ── 保存・キャンセルボタン ────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
              <button
                type="button"
                onClick={handleCancelBasic}
                disabled={!isBasicDirty || basicSaving || basicJustSaved}
                style={{
                  padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
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
                  padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 140,
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

            <CareerHistoryEditor initialExperiences={initialExperiences} roles={roles} birthDate={owUser?.birth_date} />
            <EducationEditor
              educations={educations}
              setEducations={setEducations}
              schools={schools}
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

        {/* 希望条件タブ */}
        {activeTab === "preferences" && (
          <div style={{ maxWidth: 680 }}>
            {/* why-fill hint */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
                希望条件を埋めると、条件に合う企業や求人とのマッチング精度が上がります
              </span>
            </div>
            {/* 保存状態インジケーター */}
            {(prefSaving || prefSaved) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-4)",
                padding: "var(--space-2) 14px", borderRadius: 8,
                background: prefSaved ? "var(--success-soft)" : "var(--royal-50)",
                border: `1px solid ${prefSaved ? "#A7F3D0" : "var(--royal-100)"}`,
                fontSize: 12, fontWeight: 600,
                color: prefSaved ? "var(--success)" : "var(--royal)",
              }}>
                {prefSaving ? (
                  <><span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.6s linear infinite" }} /> 保存中…</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> 保存しました</>
                )}
              </div>
            )}

            <FormSection
              title="希望職種・経験年数"
              desc="企業側の候補者サーチに表示されます。カジュアル面談の申込をもらいやすくなります。"
            >
              <FormGroup label="希望職種" htmlFor="pe-job-type">
                <select
                  id="pe-job-type"
                  value={prefJobType}
                  onChange={async (e) => {
                    setPrefJobType(e.target.value);
                    await savePreferences({ job_type: e.target.value || null });
                  }}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  {/* legacy値保持ユーザー向けフォールバック: カテゴリに含まれない値を今持っている場合のみ先頭に表示 */}
                  {prefJobType !== "" &&
                    !JOB_TYPE_CATEGORIES.some((cat) => (cat.types as readonly string[]).includes(prefJobType)) && (
                    <option value={prefJobType}>{prefJobType}</option>
                  )}
                  {getVisibleCategories().map((cat) => (
                    <optgroup key={cat.key} label={`${cat.emoji} ${cat.label}`}>
                      {cat.types.map((jt) => (
                        <option key={jt} value={jt}>
                          {JOB_TYPE_DISPLAY_LABELS[jt] ?? jt}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="社会人経験年数" htmlFor="pe-exp-years">
                <select
                  id="pe-exp-years"
                  value={prefExpYears}
                  onChange={async (e) => {
                    setPrefExpYears(e.target.value);
                    await savePreferences({ experience_years: e.target.value || null });
                  }}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  <option value="1〜2年">1〜2年</option>
                  <option value="3〜5年">3〜5年</option>
                  <option value="6〜10年">6〜10年</option>
                  <option value="11年以上">11年以上</option>
                </select>
              </FormGroup>
            </FormSection>

            <FormSection
              title="勤務スタイル・転職時期"
              desc="希望する働き方と転職のタイミングを教えてください。"
            >
              <FormGroup label="希望勤務スタイル" htmlFor="pe-work-style">
                <select
                  id="pe-work-style"
                  value={prefWorkStyle}
                  onChange={async (e) => {
                    setPrefWorkStyle(e.target.value);
                    await savePreferences({ desired_work_style: e.target.value || null });
                  }}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  <option value="full_remote">フルリモート希望</option>
                  <option value="hybrid">ハイブリッド（週1〜3出社）</option>
                  <option value="on_site">出社中心</option>
                  <option value="flexible">柔軟に対応できる</option>
                </select>
              </FormGroup>
              <FormGroup label="転職検討時期" htmlFor="pe-timing">
                <select
                  id="pe-timing"
                  value={prefTiming}
                  onChange={async (e) => {
                    setPrefTiming(e.target.value);
                    await savePreferences({ transfer_timing: e.target.value || null });
                  }}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  <option value="即時">すぐにでも（即時）</option>
                  <option value="1〜3ヶ月以内">1〜3ヶ月以内</option>
                  <option value="半年以内">半年以内</option>
                  <option value="1年以内">1年以内</option>
                  <option value="情報収集中">まだ情報収集段階</option>
                </select>
              </FormGroup>
            </FormSection>

            <FormSection
              title="希望年収"
              desc="非公開にしたい場合は未入力のままにしてください。入力した場合は企業側に表示されます。"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <FormGroup label="希望年収（下限）" htmlFor="pe-salary-min">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      id="pe-salary-min"
                      type="number"
                      value={prefSalaryMin}
                      onChange={(e) => setPrefSalaryMin(e.target.value)}
                      onBlur={async (e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        await savePreferences({ desired_salary_min: val });
                      }}
                      placeholder="例: 600"
                      min={0}
                      max={9999}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                </FormGroup>
                <FormGroup label="希望年収（上限）" htmlFor="pe-salary-max">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      id="pe-salary-max"
                      type="number"
                      value={prefSalaryMax}
                      onChange={(e) => setPrefSalaryMax(e.target.value)}
                      onBlur={async (e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        await savePreferences({ desired_salary_max: val });
                      }}
                      placeholder="例: 900"
                      min={0}
                      max={9999}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                </FormGroup>
              </div>
              {prefSalaryMin && prefSalaryMax && parseInt(prefSalaryMin) > parseInt(prefSalaryMax) && (
                <div role="alert" style={{ fontSize: 11, color: "var(--error)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>下限が上限を超えています
                </div>
              )}
            </FormSection>

            <FormSection
              title="興味のある企業フェーズ"
              desc="どのステージの企業に関心がありますか？複数選択できます。"
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {["シリーズA", "シリーズB", "シリーズC", "上場"].map((phase) => {
                  const checked = prefPhase.includes(phase);
                  return (
                    <label
                      key={phase}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                        padding: "7px var(--space-3)", borderRadius: 8,
                        background: checked ? "var(--royal-50)" : "var(--bg-tint)",
                        border: `1.5px solid ${checked ? "var(--accent)" : "var(--line)"}`,
                        color: checked ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: "var(--text-sm)", fontWeight: checked ? 600 : 400,
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ display: "none" }}
                        onChange={async () => {
                          const next = checked
                            ? prefPhase.filter((p) => p !== phase)
                            : [...prefPhase, phase];
                          setPrefPhase(next);
                          await savePreferences({ desired_phase: next.length > 0 ? next : null });
                        }}
                      />
                      <span style={{
                        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${checked ? "var(--accent)" : "var(--line)"}`,
                        background: checked ? "var(--accent)" : "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </span>
                      {phase}
                    </label>
                  );
                })}
              </div>
            </FormSection>

            <FormSection
              title="今一番の悩み・相談テーマ"
              desc="メンター相談やカジュアル面談のマッチングに使われます。"
            >
              <FormGroup label="今一番の悩み" htmlFor="pe-worry">
                <select
                  id="pe-worry"
                  value={prefWorry}
                  onChange={async (e) => {
                    setPrefWorry(e.target.value);
                    await savePreferences({ worry: e.target.value || null });
                  }}
                  style={selectStyle()}
                >
                  <option value="">未設定</option>
                  <option value="転職すべきか迷っている">転職すべきか迷っている</option>
                  <option value="年収を大幅に上げたい">年収を大幅に上げたい</option>
                  <option value="外資・グローバル企業に行きたい">外資・グローバル企業に行きたい</option>
                  <option value="キャリアチェンジを考えている">キャリアチェンジを考えている</option>
                  <option value="スタートアップに興味がある">スタートアップに興味がある</option>
                  <option value="まず話を聞いてみたい">まず話を聞いてみたい</option>
                </select>
              </FormGroup>
            </FormSection>

            <div style={{
              padding: "14px 18px", background: "var(--royal-50)",
              border: "1px solid var(--royal-100)", borderRadius: 10,
              fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <strong style={{ color: "var(--royal)" }}>希望条件は企業側に公開されます。</strong>
              しかし OPINIO ではスカウトはできない設計です。
              企業はこの情報を参考に、自社への関心を持ちやすい求職者に気づきます。
              ダイレクトメッセージは送れません。
            </div>
          </div>
        )}

        {/* 資格・実績タブ */}
        {activeTab === "certs_achievements" && (
          <div style={{ maxWidth: 680 }}>
            <CertificationEditor
              certifications={certifications}
              setCertifications={setCertifications}
            />
            <div style={{ marginTop: 24 }}>
              {/* why-fill hint */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: "var(--royal)", lineHeight: 1.6 }}>
                  埋めると、公開プロフィールの説得力が上がり、メンターやキャリアの先輩からの声かけ率が上がります
                </span>
              </div>
              <AchievementEditor achievements={achievements} setAchievements={setAchievements} />
              <AwardEditor awards={awards} setAwards={setAwards} />
              <MediaAppearanceEditor mediaAppearances={mediaAppearances} setMediaAppearances={setMediaAppearances} />
            </div>
          </div>
        )}

        {/* SNS・発信コンテンツタブ */}
        {activeTab === "socials_content" && (
          <>
            <SocialLinksEditor
              socialLinks={socialLinks}
              setSocialLinks={setSocialLinks}
            />
            {/* 保存・キャンセルボタン */}
            <div style={{ maxWidth: 680, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
              <button
                type="button"
                onClick={handleCancelSocial}
                disabled={!isSocialDirty || socialSaving || socialJustSaved}
                style={{
                  padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
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
                  padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 140,
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

        {/* 発信コンテンツ（SNS・発信タブ内） */}
        {activeTab === "socials_content" && (
          <div style={{ maxWidth: 680 }}>
            {/* why-fill hint */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
                note / YouTube を繋ぐと、あなたの考え方が企業に伝わり、価値観マッチが起きやすくなります
              </span>
            </div>
            <FormSection
              title="発信コンテンツ"
              desc="note・Zenn・YouTube・Speaker Deck・GitHub など、外部で発信しているコンテンツのURLを登録できます。プロフィールページに表示されます。"
            >
              {/* 既存リスト */}
              {contentLinks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: 20 }}>
                  {contentLinks.map((link) => (
                    <div key={link.id} style={{
                      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                      padding: "12px 14px", borderRadius: 10,
                      border: "1px solid var(--line)", background: "var(--bg-tint)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--royal)", fontWeight: 700, marginBottom: 2 }}>
                          {PLATFORM_OPTIONS.find(p => p.value === link.platform)?.label ?? link.platform ?? "Web"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {link.title || link.url}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {link.url}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteContentLink(link.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 4, flexShrink: 0 }}
                        title="削除"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 新規追加フォーム */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>新しいコンテンツを追加</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>URL *</label>
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => {
                        setNewLinkUrl(e.target.value);
                        setOgpFetched(false);
                        if (e.target.value.trim()) {
                          setNewLinkPlatform(detectPlatform(e.target.value.trim()));
                        }
                      }}
                      onBlur={handleUrlBlur}
                      placeholder="https://note.com/..."
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                    {ogpFetching && (
                      <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid var(--ink-mute)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        ページ情報を取得中...
                      </p>
                    )}
                    {ogpFetched && !ogpFetching && (
                      <p style={{ fontSize: 11, color: "var(--success)", margin: "4px 0 0" }}>✓ タイトル・サムネイルを自動取得しました</p>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>プラットフォーム（URL入力で自動判定）</label>
                    <select
                      value={newLinkPlatform}
                      onChange={(e) => setNewLinkPlatform(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>タイトル（任意）</label>
                    <input
                      type="text"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="例：SaaS営業で学んだこと"
                      maxLength={200}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>説明（任意）</label>
                    <input
                      type="text"
                      value={newLinkDesc}
                      onChange={(e) => setNewLinkDesc(e.target.value)}
                      placeholder="一言コメント"
                      maxLength={500}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>

                  {linkError && (
                    <p style={{ fontSize: 12, color: "var(--error)", margin: 0 }}>{linkError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleAddContentLink}
                    disabled={linkSaving || !newLinkUrl.trim()}
                    style={{
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: linkSaving || !newLinkUrl.trim() ? "var(--bg-tint)" : "var(--royal)",
                      color: linkSaving || !newLinkUrl.trim() ? "var(--ink-mute)" : "#fff",
                      border: "none", cursor: linkSaving || !newLinkUrl.trim() ? "default" : "pointer",
                      fontFamily: "inherit", alignSelf: "flex-start",
                    }}
                  >
                    {linkSaving ? "保存中..." : "追加する"}
                  </button>
                </div>
              </div>
            </FormSection>
          </div>
        )}

        {/* アカウント設定タブ（動作） */}
        {activeTab === "account" && (
          <div style={{ maxWidth: 680 }}>

            {/* ── Section 1: プロフィール画像・カバー ──────────────────────── */}
            <FormSection
              title="プロフィール画像・カバー"
              desc="プロフィールページのヘッダーに表示されます。"
            >
              <ProfilePhotoUploader owUser={owUser} basicInfoName={basicInfo.name} settings={settings} />
            </FormSection>

            {/* ── Section 2: ログイン情報 ───────────────────────────────────── */}
            <FormSection title="ログイン情報">
              <FormGroup label="メールアドレス" htmlFor="pe-email">
                <input
                  id="pe-email"
                  type="email"
                  autoComplete="email"
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(
                  [
                    { value: "public",     label: "すべてのOPINIOユーザーに公開",  desc: "ログイン中の求職者・企業担当者が閲覧できます" },
                    { value: "login_only", label: "ログインユーザーのみ（初期設定）", desc: "ログインしていないゲストには表示されません" },
                    { value: "private",    label: "非公開",                       desc: "自分だけ閲覧できます" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                      padding: "10px 14px", borderRadius: 8,
                      border: `1.5px solid ${settings.visibility === opt.value ? "var(--royal)" : "var(--line)"}`,
                      background: settings.visibility === opt.value ? "var(--royal-50)" : "#fff",
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={settings.visibility === opt.value}
                      onChange={() => setSettings((prev) => ({ ...prev, visibility: opt.value }))}
                      style={{ marginTop: 2, accentColor: "var(--royal)", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{
                marginTop: 12, padding: "8px 12px", borderRadius: 6,
                background: "var(--success-soft)", fontSize: 12, color: "var(--success)",
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                <span style={{ flexShrink: 0 }}>✓</span>
                <span>どの設定でも、在籍企業からのスカウトは自動的にブロックされます。</span>
              </div>
              {owUser?.id && settings.visibility !== "private" && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <a
                    href={`/u/${owUser.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 12, color: "var(--royal)", fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    公開プロフィールを見る
                  </a>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 10 }}>
                    企業側からはこのページが表示されます
                  </span>
                </div>
              )}
            </FormSection>

            {/* ── Section 3b: 転職検討状況 ─────────────────────────────────── */}
            <FormSection
              title="転職検討状況"
              desc="ONにすると、企業側の候補者検索でフィルタリングでき、プロフィールに「転職検討中」バッジが表示されます。"
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                background: settings.isOpenToWork ? "#ECFDF5" : "var(--bg-tint)",
                border: `1px solid ${settings.isOpenToWork ? "#A7F3D0" : "var(--line)"}`,
                borderRadius: 10,
                transition: "all 0.2s",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    転職を検討しています
                    {settings.isOpenToWork && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px var(--space-2)", borderRadius: 100,
                        fontSize: 10, fontWeight: 700,
                        background: "linear-gradient(135deg, var(--success), #10B981)",
                        color: "#fff",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        ✓ 有効
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {settings.isOpenToWork
                      ? "プロフィールに「転職検討中」バッジが表示されます"
                      : "非公開（企業側には表示されません）"}
                  </div>
                </div>
                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.isOpenToWork}
                  onClick={() => setSettings((prev) => ({ ...prev, isOpenToWork: !prev.isOpenToWork }))}
                  style={{
                    width: 44, height: 24, borderRadius: 100,
                    background: settings.isOpenToWork ? "var(--success)" : "var(--line)",
                    border: "none", cursor: "pointer",
                    position: "relative", flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3,
                    left: settings.isOpenToWork ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            </FormSection>

            {/* ── Section 3c: 話しかけを受け付ける ────────────────────────── */}
            <FormSection
              title="話しかけを受け付ける"
              desc="ONにすると、対象の人からの話しかけ・相談リクエストを受け付けます。コンタクト方法はOPINIOが仲介します。"
            >
              {/* ① 他の候補者と話してOK */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", marginBottom: 8,
                background: settings.canTalkToCandidates ? "var(--royal-50)" : "var(--bg-tint)",
                border: `1px solid ${settings.canTalkToCandidates ? "var(--royal-100)" : "var(--line)"}`,
                borderRadius: 10,
                transition: "all 0.2s",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    他の候補者と話してOK
                    {settings.canTalkToCandidates && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px var(--space-2)", borderRadius: 100,
                        fontSize: 10, fontWeight: 700,
                        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                        color: "#fff",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        ✓ 有効
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    同じような立場の候補者からの相談・話しかけを受け付けます
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.canTalkToCandidates}
                  onClick={() => setSettings((prev) => ({ ...prev, canTalkToCandidates: !prev.canTalkToCandidates }))}
                  style={{
                    width: 44, height: 24, borderRadius: 100,
                    background: settings.canTalkToCandidates ? "var(--royal)" : "var(--line)",
                    border: "none", cursor: "pointer",
                    position: "relative", flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3,
                    left: settings.canTalkToCandidates ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>

              {/* ② 企業の人事と話してOK */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                background: settings.canTalkToHr ? "var(--royal-50)" : "var(--bg-tint)",
                border: `1px solid ${settings.canTalkToHr ? "var(--royal-100)" : "var(--line)"}`,
                borderRadius: 10,
                transition: "all 0.2s",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    企業の人事と話してOK
                    {settings.canTalkToHr && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px var(--space-2)", borderRadius: 100,
                        fontSize: 10, fontWeight: 700,
                        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                        color: "#fff",
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        ✓ 有効
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    企業の人事担当者からの話しかけ・面談依頼を受け付けます
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.canTalkToHr}
                  onClick={() => setSettings((prev) => ({ ...prev, canTalkToHr: !prev.canTalkToHr }))}
                  style={{
                    width: 44, height: 24, borderRadius: 100,
                    background: settings.canTalkToHr ? "var(--royal)" : "var(--line)",
                    border: "none", cursor: "pointer",
                    position: "relative", flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3,
                    left: settings.canTalkToHr ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            </FormSection>

            {/* ── Section 3d: スカウト設定 ─────────────────────────────────── */}
            <FormSection
              title="スカウト設定"
              desc="企業からのスカウトを受け取るかどうかを設定します。在籍企業・過去の在籍企業からは自動的にブロックされます。"
            >
              {/* scout_enabled 未設定の注意 */}
              {scoutEnabled === null && (
                <div style={{
                  background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                  padding: "10px 14px", fontSize: 12, color: "#92400E", marginBottom: 12,
                }}>
                  オンボーディングで設定されていません。下記から設定してください。
                </div>
              )}
              {/* 受け取る */}
              <div
                role="radio"
                aria-checked={scoutEnabled === true}
                onClick={() => !scoutSaving && handleSaveScout(true)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", marginBottom: 8, cursor: "pointer",
                  background: scoutEnabled === true ? "var(--royal-50)" : "var(--bg-tint)",
                  border: `1.5px solid ${scoutEnabled === true ? "var(--royal)" : "var(--line)"}`,
                  borderRadius: 10, transition: "all 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    受け取る（推奨）
                    {scoutEnabled === true && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg, var(--royal), #3B5FD9)", color: "#fff" }}>
                        ✓ 設定中
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>企業があなたのプロフィールを見て、直接連絡できるようになります</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${scoutEnabled === true ? "var(--royal)" : "var(--line)"}`,
                  background: scoutEnabled === true ? "var(--royal)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {scoutEnabled === true && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                </div>
              </div>
              {/* 受け取らない */}
              <div
                role="radio"
                aria-checked={scoutEnabled === false}
                onClick={() => !scoutSaving && handleSaveScout(false)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", cursor: "pointer",
                  background: scoutEnabled === false ? "var(--bg-tint)" : "#fff",
                  border: `1.5px solid ${scoutEnabled === false ? "var(--ink-mute)" : "var(--line)"}`,
                  borderRadius: 10, transition: "all 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    受け取らない
                    {scoutEnabled === false && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 700, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>
                        ✓ 設定中
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>企業からは一切見えません</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${scoutEnabled === false ? "var(--ink-mute)" : "var(--line)"}`,
                  background: scoutEnabled === false ? "var(--ink-mute)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {scoutEnabled === false && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                </div>
              </div>
              {/* 保存フィードバック */}
              {(scoutSaving || scoutSaved) && (
                <div style={{ fontSize: 12, color: scoutSaved ? "var(--success)" : "var(--ink-mute)", marginTop: 8 }}>
                  {scoutSaved ? "✓ 保存しました" : "保存中..."}
                </div>
              )}
              {/* ブロック企業一覧 */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  あなたのプロフィールをブロックしている企業
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
                  職務経歴に登録した企業からは自動的に見えません。転職活動が今の会社に知られることはありません。
                </div>
                {blockedLoading ? (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: "10px 0" }}>読み込み中…</div>
                ) : blockedCompanies.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, border: "1px solid var(--line)" }}>
                    ブロック中の企業はありません
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {blockedCompanies.map((b, i) => (
                      <div key={b.id ?? `${b.company_id}-${i}`} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8,
                        background: b.block_reason === "experience" ? "var(--bg-tint)" : "#fff",
                        border: `1px solid ${b.block_reason === "experience" ? "var(--line)" : "var(--line)"}`,
                      }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{b.company_name}</span>
                          <span style={{
                            marginLeft: 8, fontSize: 11, fontWeight: 600,
                            padding: "2px 7px", borderRadius: 100,
                            background: b.block_reason === "experience" ? "var(--royal-50)" : "var(--line-soft)",
                            color: b.block_reason === "experience" ? "var(--royal)" : "var(--ink-soft)",
                          }}>
                            {b.block_reason === "experience" ? "在籍企業（自動）" : "手動でブロック中"}
                          </span>
                        </div>
                        {b.block_reason === "manual" && b.id && (
                          <button
                            type="button"
                            disabled={removingBlockId === b.id}
                            onClick={() => handleRemoveBlock(b.id!)}
                            style={{
                              fontSize: 11, padding: "4px 10px", borderRadius: 6,
                              border: "1px solid var(--line)", background: "#fff",
                              color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit",
                              opacity: removingBlockId === b.id ? 0.5 : 1,
                            }}
                          >
                            {removingBlockId === b.id ? "解除中…" : "解除"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 企業を追加でブロックする */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                    + 企業を追加でブロックする
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={blockSearchQuery}
                      onChange={e => handleBlockSearch(e.target.value)}
                      placeholder="企業名を検索…"
                      style={{
                        width: "100%", padding: "9px 12px", fontSize: 13,
                        border: "1px solid var(--line)", borderRadius: 8,
                        fontFamily: "inherit", boxSizing: "border-box",
                        color: "var(--ink)", background: "#fff",
                      }}
                    />
                    {blockSearchLoading && (
                      <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--ink-mute)" }}>検索中…</div>
                    )}
                    {blockSearchResults.length > 0 && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
                        background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden",
                      }}>
                        {blockSearchResults.map(c => {
                          const alreadyBlocked = blockedCompanies.some(b => b.company_id === c.id);
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 14px", borderBottom: "1px solid var(--line-soft)",
                              }}
                            >
                              <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.name}</span>
                              {alreadyBlocked ? (
                                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>ブロック済み</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={addingBlockId === c.id}
                                  onClick={() => handleAddBlock(c)}
                                  style={{
                                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                                    border: "1px solid var(--line)", background: "var(--bg-tint)",
                                    color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit",
                                    opacity: addingBlockId === c.id ? 0.5 : 1,
                                  }}
                                >
                                  {addingBlockId === c.id ? "追加中…" : "ブロック"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 5 }}>
                    OPINIOに掲載されている企業のみ検索できます
                  </div>
                </div>
              </div>
            </FormSection>

            {/* ── Section 4: メール通知設定 ────────────────────────────────── */}
            <NotificationSettingsSection />

            {/* ── Danger zone ──────────────────────────────────────────────── */}
            <div
              style={{
                background: "var(--error-soft)", border: "1px solid #FECACA",
                borderRadius: 14, padding: "20px 24px", marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--error)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>アカウント削除
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
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)" }}>
              <button
                type="button"
                onClick={handleCancelAccount}
                disabled={!isAccountDirty || accountSaving || accountJustSaved}
                style={{
                  padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
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
                  padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 140,
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
