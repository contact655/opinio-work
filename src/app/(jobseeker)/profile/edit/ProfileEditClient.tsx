"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Json } from "@/lib/supabase/types";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/Toast";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import {
  EducationEditor,
  AchievementEditor,
  AwardEditor,
  MediaAppearanceEditor,
  /* ⚠️ 元から RecordEditors 側（切り出した範囲）で export されていた型。移動先から import する。 */
  type RoleItem,
} from "./_components/RecordEditors";
/* ⚠️ 型は親と RecordEditors の両方が使う。親に置くと循環 import になる。 */
import {
  type Education,
  type School,
  type Achievement,
  type Award,
  type MediaAppearance,
} from "./_components/recordTypes";
import CareerHistoryEditor, { type Stint } from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS } from "@/lib/profile/mockProfileData";
import {
  DESIRED_WORK_STYLES,
  TRANSFER_TIMINGS,
  DESIRED_PHASES,
  WORRIES,
  SALARY_MAX_MAN,
  MAX_DESIRED_ROLES,
} from "@/lib/constants/careerPreferences";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { CheckPillGroup, type CheckPillOption } from "@/components/ui/CheckPillGroup";
import { calcTotalExperience, formatYmLabel } from "@/lib/profile/tenure";
import { hasCareerPreferences } from "@/lib/profile/completion";
import { EMAIL_SETTING_DEFAULTS, type EmailSettingKey } from "@/lib/constants/emailSettings";
import { ProfileCompletionBar, type CompletionInput } from "@/components/profile/ProfileCompletionBar";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────




// ow_schools マスター行型（Phase 5: datalist 候補用）


/** JSONB キー名は "x"（ν-8 段階6-1 E で twitter → x 移行済み）。値は URL 文字列。空文字列 = 未設定。 */
type SocialLinks = Partial<Record<SocialPlatform, string>>;




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

type ProfileTab = "basic" | "career" | "preferences" | "certs_achievements" | "socials_content" | "privacy" | "account";

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
  social_links: Json | null;
} | null;

// ─── Basic info state ─────────────────────────────────────────────────────────

type BasicInfo = {
  name: string;
  location: string;
  aboutMe: string;
};

type SettingsState = {
  avatarColor: string;
  coverColor: string;
  visibility: "public" | "login_only" | "private";
  isOpenToWork: boolean;
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
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 6 }}>プレビュー（クリックで写真を変更）</div>
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




const PROFILE_TABS: TabItem[] = [
  { key: "basic",             label: "基本情報" },
  { key: "career",            label: "職歴・学歴" },
  { key: "preferences",       label: "希望条件" },
  { key: "certs_achievements", label: "実績・受賞" },
  { key: "socials_content",   label: "SNS・発信" },
  { key: "privacy",           label: "公開設定" },
  { key: "account",           label: "アカウント" },
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
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.6 }}>
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

/* ⚠️ 2026-08-10 まで localStorage に保存していた。cron はそれを読めないので、
      オフにしてもメールは止まらなかった（週次メールを止めていた理由そのもの）。
      いまは `ow_profiles` に保存する。

   ⚠️ **実在するメールと1対1で対応する項目だけを出すこと。**
      以前は「新着企業」「新着記事」という、送っているメールが存在しない項目が
      2つ並んでいて、逆に実在する新着求人メールには項目が無かった。 */
type NotifPrefs = Record<EmailSettingKey, boolean>;
const DEFAULT_NOTIF: NotifPrefs = EMAIL_SETTING_DEFAULTS;

function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/jobseeker/email-settings");
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!alive) return;
        setPrefs({
          email_weekly_enabled: json.email_weekly_enabled !== false,
          email_scout_enabled: json.email_scout_enabled !== false,
        });
      } catch {
        /* ⚠️ 読めなかったときに既定値のトグルを操作可能にしない。
              保存されていない値を「保存済み」に見せることになる。 */
        if (alive) setError("設定を読み込めませんでした。再読み込みしてください");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = async (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    const prev = prefs;
    setPrefs(next); // 楽観的更新
    setError(null);
    try {
      const res = await fetch("/api/jobseeker/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setPrefs(prev); // ⚠️ 失敗したら戻す。「保存済み」と誤解させない
      setError("保存に失敗しました。時間をおいて試してください");
    }
  };

  const items: { key: keyof NotifPrefs; label: string; desc: string; icon: string }[] = [
    { key: "email_weekly_enabled", label: "週1回のおすすめメール", desc: "新着求人と、希望条件に合う求人をまとめてお送りします", icon: "💼" },
    { key: "email_scout_enabled",  label: "スカウトのお知らせ", desc: "企業からスカウトが届いたときにメールでお知らせします", icon: "📬" },
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
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--error)" }}>{error}</div>
      )}
      {/* ⚠️ 読み込みが終わるまで操作させない。既定値のまま触らせると、
             保存されていない値を「保存済み」と見せることになる */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: "var(--space-3)", opacity: loaded ? 1 : 0.5, pointerEvents: loaded ? "auto" : "none" }}>
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
      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        💡 メール通知の配信は登録メールアドレスに送られます。迷惑メールフォルダもご確認ください。
      </div>
    </div>
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

        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.7 }}>
          空欄の SNS はプロフィールページに表示されません。
        </div>
      </FormSection>
    </div>
  );
}

// ─── Education Editor ─────────────────────────────────────────────────────────

// Draft type for the education edit/add form
export default function ProfileEditClient({
  owUser,
  authEmail,
  initialEducations,
  initialSocialLinks,
  initialAchievements,
  initialAwards,
  initialMediaAppearances,
  initialExperiences,
  initialContentLinks,
  roles,
  roleAliases = {},
  initialTab,
  isWelcome = false,
  initialScoutEnabled = null,
  initialDesiredRoleIds = [],
  desiredRoleOptions,
  initialProfilePrefs = null,
}: {
  owUser: OwUser;
  authEmail: string;
  initialEducations: Education[];
  initialSocialLinks: SocialLinks;
  initialAchievements: Achievement[];
  initialAwards: Award[];
  initialMediaAppearances: MediaAppearance[];
  initialExperiences: Stint[];
  initialContentLinks: ContentLink[];
  roles: RoleItem[];
  /** role_id → 別名[]。職種の検索セレクトでヒットさせる（ow_role_aliases） */
  roleAliases?: Record<string, string[]>;
  /** `?tab=` の値。不正な値は無視して既定タブを開く */
  initialTab?: string;
  isWelcome?: boolean;
  initialScoutEnabled?: boolean | null;
  /** 希望職種（ow_profile_desired_roles）。本人が選んだ role_id（展開前） */
  initialDesiredRoleIds?: string[];
  /** 希望職種ピッカーの候補。**職歴の roles とは母集団が違う**（is_it_saas で絞る） */
  desiredRoleOptions?: RoleItem[];
  initialProfilePrefs?: {
    // ⚠️ job_type / desired_work_style / experience_years は受け取らない。
    //    希望職種は ow_profile_desired_roles、勤務スタイルは desired_work_styles、
    //    経験年数は職歴から自動計算に移った（2026-08-07）。列は残置。
    desired_work_styles: string[] | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
  } | null;
}) {
  const VALID_TABS: ProfileTab[] = [
    "basic", "career", "preferences",
    "certs_achievements", "socials_content", "privacy", "account",
  ];
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    VALID_TABS.includes(initialTab as ProfileTab) ? (initialTab as ProfileTab) : "basic"
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // ── 希望条件 (ow_profiles) state ─────────────────────────────────────────────
  const [prefRoleIds, setPrefRoleIds] = useState<string[]>(initialDesiredRoleIds);
  const [prefWorkStyles, setPrefWorkStyles] = useState<string[]>(initialProfilePrefs?.desired_work_styles ?? []);
  const [prefSalaryMin, setPrefSalaryMin] = useState(initialProfilePrefs?.desired_salary_min?.toString() ?? "");
  const [prefSalaryMax, setPrefSalaryMax] = useState(initialProfilePrefs?.desired_salary_max?.toString() ?? "");
  const [prefTiming, setPrefTiming] = useState(initialProfilePrefs?.transfer_timing ?? "");
  const [prefWorry, setPrefWorry] = useState(initialProfilePrefs?.worry ?? "");
  const [prefPhase, setPrefPhase] = useState<string[]>(initialProfilePrefs?.desired_phase ?? []);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const prefSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 希望条件が1つでも入っているか。**判定は completion.ts の1本に寄せる。**
     こことタブ完了ドットと /mypage で式が分かれると完成度がずれる（2026-08-07）。 */
  const hasPrefs = hasCareerPreferences({
    desiredRoleCount:    prefRoleIds.length,
    desired_work_styles: prefWorkStyles,
    desired_salary_min:  prefSalaryMin ? Number(prefSalaryMin) : null,
    desired_salary_max:  prefSalaryMax ? Number(prefSalaryMax) : null,
    transfer_timing:     prefTiming || null,
    desired_phase:       prefPhase,
    worry:               prefWorry || null,
  });

  /** role_id → 職種名。希望職種チップの表示に使う */
  const roleNameById = useMemo(
    () => new Map(roles.map((r) => [r.id, r.name])),
    [roles]
  );

  /* ⚠️ 選択肢から外した値（"flexible"）を今持っている人には足し戻す。
        出さないと画面から消えたまま保存され続け、別項目を保存した拍子に失われる。 */
  const workStyleOptions = useMemo<CheckPillOption[]>(() => {
    const base: CheckPillOption[] = DESIRED_WORK_STYLES.map((o) => ({ value: o.value, label: o.label }));
    const known = new Set(base.map((o) => o.value));
    const extra = prefWorkStyles
      .filter((v) => !known.has(v))
      .map((v) => ({ value: v, label: v, legacy: true }));
    return [...base, ...extra];
  }, [prefWorkStyles]);

  // ── 社会人経験年数（職歴から自動計算・表示のみ）──────────────────────────
  // ⚠️ 職歴が0件なら null。呼び出し側は項目ごと非表示にする（「0年」と出さない）。
  // ⚠️ initialExperiences は SSR 時点のスナップショット。職歴タブで追加した直後は
  //    再読み込みまで反映されない。CareerHistoryEditor が router.refresh() する。
  const oldestCareerStart = useMemo(() => {
    const starts = initialExperiences.map((e) => e.startedAt).filter(Boolean);
    return starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  }, [initialExperiences]);
  const totalExperience = useMemo(
    () => calcTotalExperience(initialExperiences.map((e) => e.startedAt)),
    [initialExperiences]
  );

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

  // ── 公開設定タブの状態（明示保存方式） ──────────────────────────────────
  const [settings, setSettings] = useState<SettingsState>({
    avatarColor:  owUser?.avatar_color  ?? DEFAULT_AVATAR_COLOR,
    coverColor:   owUser?.cover_color   ?? DEFAULT_COVER_COLOR,
    visibility:   (owUser?.visibility ?? "public") as SettingsState["visibility"],
    isOpenToWork: owUser?.is_open_to_work ?? false,
  });
  // 初期値を保持して変更検知（JSON.stringify 比較）
  const [initialSettings, setInitialSettings] = useState<SettingsState>({
    avatarColor:  owUser?.avatar_color  ?? DEFAULT_AVATAR_COLOR,
    coverColor:   owUser?.cover_color   ?? DEFAULT_COVER_COLOR,
    visibility:   (owUser?.visibility ?? "public") as SettingsState["visibility"],
    isOpenToWork: owUser?.is_open_to_work ?? false,
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
          visibility:      settings.visibility,
          is_open_to_work: settings.isOpenToWork,
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

  // ── 学歴タブの状態 ───────────────────────────────────────────────────────
  const [educations, setEducations] = useState<Education[]>(initialEducations);

  // ── 実績・受賞タブの状態 ───────────────────────────────────────────────────────

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
  });
  const [birthYear,  setBirthYear]  = useState<string>(initialParsed.year);
  const [birthMonth, setBirthMonth] = useState<string>(initialParsed.month);
  const [birthDay,   setBirthDay]   = useState<string>(initialParsed.day);

  // 変更検知用の初期値（保存成功時に更新）
  const [initialBasicInfo, setInitialBasicInfo] = useState<BasicInfo>({
    name:             owUser?.name      ?? "",
    location:         owUser?.location  ?? "",
    aboutMe:          owUser?.about_me  ?? "",
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
    preferences:       hasPrefs,
    certs_achievements: achievements.length > 0 || awards.length > 0 || mediaAppearances.length > 0,
    socials_content:   Object.values(socialLinks).some((v) => !!v) || contentLinks.length > 0,
    privacy:           true,
    account:           true,
  };

  const profileTabsWithCompletion = PROFILE_TABS.map((tab) => ({
    ...tab,
    completed: tabCompletion[tab.key as ProfileTab],
  }));

  // ── プロフィール完成度 ───────────────────────────────────────────────────
  // 本文の先頭に置いていたが、タブと入力欄がその分だけ下に押し出されて
  // スクロールしないと見えなかったため、右カラムへ移した（2026-08-07）。
  // ⚠️ 右カラムは 1100px 未満で消える（rightColumnCollapse="hide"）。
  //    その幅では本文側の `.mypage-narrow-only` の控えが出る。
  const completionData: CompletionInput = {
    hasName:               !!basicInfo.name && basicInfo.name.trim() !== "" && basicInfo.name !== "ユーザー",
    hasAboutMe:            !!basicInfo.aboutMe && basicInfo.aboutMe.trim().length > 0,
    hasLocation:           !!basicInfo.location && basicInfo.location.trim().length > 0,
    hasBirthDate:          !!birthYear && !!birthMonth && !!birthDay,
    hasAvatar:             !!owUser?.avatar_url,
    experienceCount:       initialExperiences.length,
    educationCount:        educations.length,
    hasPreferences:        hasPrefs,
    certOrAchievementCount: achievements.length + awards.length + mediaAppearances.length,
    socialOrContentCount:  contentLinks.length + Object.values(initialSocialLinks).filter(Boolean).length,
  };

  return (
    <MypageMockProvider>
      <MypageLayout
        activeKey="profile"
        rightColumnCollapse="hide"
        breadcrumb={[
          { label: "OPINIO", href: "/" },
          { label: "マイページ", href: "/mypage" },
          { label: "プロフィール" },
        ]}
        rightColumn={
          <ProfileCompletionBar
            data={completionData}
            mode="sidebar"
            onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
          />
        }
      >

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
              <div style={{ fontSize: 12, fontWeight: 600, color: "#B45309", lineHeight: 1.7 }}>
                自己紹介・職歴・学歴を入力すると、企業のカジュアル面談やメンター相談が
                スムーズになります。<strong>入力内容は自動保存</strong>されます。
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { tab: "basic" as ProfileTab, label: "① 基本情報" },
                  { tab: "career" as ProfileTab, label: "② 職歴" },
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

        {/* ── ヘッダー行: 保存状態 ─────────────────────────────────────────
            「← マイページ」ボタンはページ上部のパンくずに移した（2026-08-07）。
            戻り先は パンくずの「マイページ」リンクが担う。 */}
        {/* パンくずで現在地が分かるため、見出しは画面に出さない（2026-08-07）。
            ただし h1 が1つも無いページにしないよう sr-only で残す。 */}
        <h1 className="sr-only">プロフィール</h1>

        {/* グローバル保存ステータスインジケーター。
            ⚠️ idle のときは行ごと出さない。空の行が余白だけ残るのを避ける */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: -16, marginBottom: globalSaveStatus === "idle" ? 0 : "var(--space-3)" }}>
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

        </div>

        {/* ── プロフィール完成度（1100px 未満のみ。それ以上は右カラム） ────── */}
        <div className="mypage-narrow-only">
          <ProfileCompletionBar
            data={completionData}
            mode="edit"
            onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
          />
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
                hint="生年月日を入力すると年齢が自動で計算され、プロフィールページと登録ユーザー一覧に表示されます。入力しない場合は年齢非公開となります。"
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

            <CareerHistoryEditor initialExperiences={initialExperiences} roles={roles} roleAliases={roleAliases} birthDate={owUser?.birth_date} />
            <EducationEditor
              educations={educations}
              setEducations={setEducations}
              schools={schools}
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
              <span style={{ fontSize: 12, fontWeight: 500, color: "#92400E", lineHeight: 1.6 }}>
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

            {/* ── 希望職種（複数選択）────────────────────────────────────────
                職歴からは「やってきたこと」しか分からない。**キャリアチェンジ希望は
                ここにしか出ない**ので、希望条件の中で最も重要な項目。
                ⚠️ selectableParent は true。求職者は「営業」のような粗い希望も出したい
                   （求人フォームは false。あちらは求人の職種を1つに定める用途）。 */}
            <FormSection
              title="希望職種"
              desc="複数選べます。企業側の候補者サーチと、あなたへの求人おすすめに使われます。"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <RoleSearchSelect
                  roles={desiredRoleOptions ?? roles}
                  aliases={roleAliases}
                  value=""
                  onSelect={async (roleId) => {
                    if (prefRoleIds.includes(roleId)) return;
                    if (prefRoleIds.length >= MAX_DESIRED_ROLES) return;
                    const next = [...prefRoleIds, roleId];
                    setPrefRoleIds(next);
                    await savePreferences({ desired_role_ids: next });
                  }}
                  selectableParent
                  clearOnSelect
                  disabled={prefRoleIds.length >= MAX_DESIRED_ROLES}
                  placeholder={
                    prefRoleIds.length >= MAX_DESIRED_ROLES
                      ? `希望職種は ${MAX_DESIRED_ROLES} 件までです`
                      : "職種名で検索（例: 法人営業、AE、営業）"
                  }
                  ariaLabel="希望職種を検索して追加"
                />

                {prefRoleIds.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
                    まだ選ばれていません。
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {prefRoleIds.map((id) => (
                      <span
                        key={id}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 8px 6px 12px", borderRadius: 100,
                          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                          color: "var(--royal)", fontSize: "var(--text-sm)", fontWeight: 600,
                        }}
                      >
                        {roleNameById.get(id) ?? "（不明な職種）"}
                        <button
                          type="button"
                          aria-label={`${roleNameById.get(id) ?? "この職種"} を外す`}
                          onClick={async () => {
                            const next = prefRoleIds.filter((r) => r !== id);
                            setPrefRoleIds(next);
                            await savePreferences({ desired_role_ids: next });
                          }}
                          style={{
                            border: "none", background: "none", cursor: "pointer",
                            color: "var(--royal)", fontSize: 15, lineHeight: 1, padding: "0 2px",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>

            {/* ── 社会人経験年数（自動計算・表示のみ）────────────────────────
                入力欄は 2026-08-07 に廃止した。理由は2つ:
                ① API が parseNum() に通していたため "3〜5年" が必ず null に落ち、
                   **選んでも保存されていなかった**
                ② 職歴を入れた人には二重入力になり、食い違ったときどちらが正か決められない
                ⚠️ 職歴が0件なら項目ごと出さない。「0年」と出さないこと。 */}
            {totalExperience && (
              <FormSection
                title="社会人経験年数"
                desc="職歴の最も古い開始日から自動で計算しています。直すには「職歴・学歴」タブの職歴を編集してください。"
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 10,
                  background: "var(--bg-tint)", border: "1px solid var(--line-soft)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
                    {totalExperience.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    （{formatYmLabel(oldestCareerStart)} から）
                  </span>
                </div>
              </FormSection>
            )}

            <FormSection
              title="勤務スタイル・転職時期"
              desc="希望する働き方と転職のタイミングを教えてください。"
            >
              <FormGroup label="希望勤務スタイル">
                {/* ⚠️ 複数選べる。「フルリモート希望」と「週2出社まで可」を
                       並べられないと幅が表現できない、というのが作り直しの理由。 */}
                <CheckPillGroup
                  ariaLabel="希望勤務スタイル"
                  value={prefWorkStyles}
                  options={workStyleOptions}
                  onChange={async (next) => {
                    setPrefWorkStyles(next);
                    await savePreferences({ desired_work_styles: next });
                  }}
                />
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
                  {TRANSFER_TIMINGS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
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
                      max={SALARY_MAX_MAN}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
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
                      max={SALARY_MAX_MAN}
                      style={{ ...inputStyle(), width: "100%" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
                  </div>
                </FormGroup>
              </div>
              {prefSalaryMin && prefSalaryMax && parseInt(prefSalaryMin) > parseInt(prefSalaryMax) && (
                <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>下限が上限を超えています
                </div>
              )}
            </FormSection>

            <FormSection
              title="興味のある企業フェーズ"
              desc="どのステージの企業に関心がありますか？複数選択できます。"
            >
              <CheckPillGroup
                ariaLabel="興味のある企業フェーズ"
                value={prefPhase}
                options={DESIRED_PHASES.map((p) => ({ value: p, label: p }))}
                onChange={async (next) => {
                  setPrefPhase(next);
                  await savePreferences({ desired_phase: next.length > 0 ? next : null });
                }}
              />
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
                  {WORRIES.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </FormGroup>
            </FormSection>

            <div style={{
              padding: "14px 18px", background: "var(--royal-50)",
              border: "1px solid var(--royal-100)", borderRadius: 10,
              fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.7,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <strong style={{ color: "var(--royal)" }}>希望条件は企業側に公開されます。</strong>
              条件に合う企業からスカウトが届きやすくなります。
            </div>
          </div>
        )}

        {/* 実績・受賞タブ */}
        {activeTab === "certs_achievements" && (
          <div style={{ maxWidth: 680 }}>
            <div>
              {/* why-fill hint */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--royal)", lineHeight: 1.6 }}>
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
              <span style={{ fontSize: 12, fontWeight: 500, color: "#92400E", lineHeight: 1.6 }}>
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
                        <div style={{ fontSize: 12, color: "var(--royal)", fontWeight: 700, marginBottom: 2 }}>
                          {PLATFORM_OPTIONS.find(p => p.value === link.platform)?.label ?? link.platform ?? "Web"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {link.title || link.url}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid var(--ink-mute)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        ページ情報を取得中...
                      </p>
                    )}
                    {ogpFetched && !ogpFetching && (
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success)", margin: "4px 0 0" }}>✓ タイトル・サムネイルを自動取得しました</p>
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
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", margin: 0 }}>{linkError}</p>
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
        {/* ══════════════════════════════════════════════════════════════════
            公開設定タブ
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "privacy" && (() => {
          const isPrivate = settings.visibility === "private";
          const effectiveScout = !isPrivate && scoutEnabled === true;
          const currentEmployerNames = initialExperiences
            .filter((e) => e.isCurrent && e.companyType !== "anon" && e.displayCompanyName)
            .map((e) => e.displayCompanyName);

          return (
            <div style={{ maxWidth: 680 }}>

              {/* ── サマリーカード ──────────────────────────────────────────── */}
              <div style={{
                background: "linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)",
                border: "1.5px solid var(--royal-100)",
                borderRadius: 14, padding: "20px 24px", marginBottom: 24,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  あなたの現在の公開状態
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {/* 公開範囲 */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isPrivate ? "var(--error-soft)" : "var(--success-soft)",
                      color: isPrivate ? "var(--error)" : "var(--success)", fontSize: 12, fontWeight: 700,
                    }}>{isPrivate ? "✗" : "✓"}</span>
                    <span>
                      {/* 現在の挙動をそのまま書く。public と login_only は
                          いま同じ見え方になるので、違いは「将来の扱い」であることを示す。 */}
                      {settings.visibility === "public" && "公開（ログイン中のOPINIOユーザーが閲覧可）"}
                      {settings.visibility === "login_only" && "ログイン中のOPINIOユーザーのみ閲覧可"}
                      {settings.visibility === "private" && <span style={{ color: "var(--ink-soft)" }}>非公開（自分のみ閲覧可）</span>}
                    </span>
                  </div>
                  {/* スカウト */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: effectiveScout ? "var(--success-soft)" : "var(--bg-tint)",
                      color: effectiveScout ? "var(--success)" : "var(--ink-mute)", fontSize: 12, fontWeight: 700,
                    }}>{effectiveScout ? "✓" : "✗"}</span>
                    <span style={{ color: effectiveScout ? "var(--ink)" : "var(--ink-soft)" }}>
                      {isPrivate
                        ? "非公開設定のため、スカウトは届きません"
                        : scoutEnabled === true
                          ? "企業からスカウトを受け取る"
                          : scoutEnabled === false
                            ? "スカウトを受け取らない設定"
                            : "スカウト設定が未設定です"}
                    </span>
                  </div>
                  {/* 自動ブロック */}
                  {currentEmployerNames.length > 0 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                      <span style={{
                        flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "var(--royal-50)", color: "var(--royal)", fontSize: 12, fontWeight: 700,
                      }}>✓</span>
                      <span>
                        在籍企業からは自動でブロック中
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>
                          ({currentEmployerNames.join("・")})
                        </span>
                      </span>
                    </div>
                  )}
                  {/* 転職検討状況 */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink)" }}>
                    <span style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: settings.isOpenToWork ? "var(--success-soft)" : "var(--bg-tint)",
                      color: settings.isOpenToWork ? "var(--success)" : "var(--ink-mute)", fontSize: 12, fontWeight: 700,
                    }}>{settings.isOpenToWork ? "✓" : "✗"}</span>
                    <span style={{ color: settings.isOpenToWork ? "var(--ink)" : "var(--ink-soft)" }}>
                      {settings.isOpenToWork ? "「転職検討中」バッジを表示中" : "転職検討中バッジは非表示"}
                    </span>
                  </div>
                </div>
                {owUser?.id && !isPrivate && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--royal-100)" }}>
                    <a
                      href={`/u/${owUser.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      公開プロフィールを確認する →
                    </a>
                  </div>
                )}
              </div>

              {/* ── Section 1: プロフィールの公開範囲 ───────────────────────── */}
              <FormSection
                title="プロフィールの公開範囲"
                desc="プロフィールページを誰が閲覧できるかを設定します。"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(
                    [
                      // ⚠️ public の説明は「ログイン中の…」ではない。
                      //    現在は /people と /u/[id] が middleware でログイン必須のため
                      //    public でも未ログインには出ないが、その制限が外れたときに
                      //    意味が変わる設定なので、いま同意を取るべき範囲で書く。
                      //    設定の意味を後から拡大しないこと（2026-08-04）。
                      {
                        value: "public",
                        label: "公開",
                        desc: "OPINIO にログインしている人が閲覧できます。将来この制限を外す場合は、事前にお知らせします（外れると、ログインしていない人や検索エンジンからも見える状態になります）。",
                      },
                      {
                        value: "login_only",
                        label: "ログインユーザーのみ（初期設定）",
                        desc: "OPINIO にログインしている人だけが閲覧できます。ログインしていない人には、この制限が外れた後も表示されません。",
                      },
                      {
                        value: "private",
                        label: "非公開",
                        desc: "自分だけが閲覧できます。企業の候補者検索にも表示されません。",
                      },
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
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </FormSection>

              {/* ── Section 2: スカウト設定 ──────────────────────────────────── */}
              <FormSection
                title="スカウト設定"
                desc="企業からのスカウトを受け取るかどうかを設定します。"
              >
                {isPrivate ? (
                  /* 非公開時グレーアウト */
                  <div style={{
                    background: "var(--bg-tint)", borderRadius: 10, padding: "16px 18px",
                    border: "1px solid var(--line)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                      非公開設定のため、企業からのスカウトは届きません。
                    </span>
                  </div>
                ) : (
                  <>
                    {scoutEnabled === null && (
                      <div style={{
                        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                        padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "#92400E", marginBottom: 12,
                      }}>
                        下記から設定してください。
                      </div>
                    )}
                    <div
                      role="radio"
                      aria-checked={scoutEnabled === true}
                      onClick={() => !scoutSaving && handleSaveScout(true)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "13px 16px", marginBottom: 8, cursor: "pointer",
                        background: scoutEnabled === true ? "var(--royal-50)" : "var(--bg-tint)",
                        border: `1.5px solid ${scoutEnabled === true ? "var(--royal)" : "var(--line)"}`,
                        borderRadius: 10, transition: "all 0.15s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                          受け取る（推奨）
                          {scoutEnabled === true && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--royal), #3B5FD9)", color: "#fff" }}>
                              ✓ 設定中
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>条件に合う企業からスカウトが届きやすくなります。</div>
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
                    <div
                      role="radio"
                      aria-checked={scoutEnabled === false}
                      onClick={() => !scoutSaving && handleSaveScout(false)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "13px 16px", cursor: "pointer",
                        background: "#fff",
                        border: `1.5px solid ${scoutEnabled === false ? "var(--ink-mute)" : "var(--line)"}`,
                        borderRadius: 10, transition: "all 0.15s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                          受け取らない
                          {scoutEnabled === false && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>
                              ✓ 設定中
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>企業からは一切見えません</div>
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
                    {(scoutSaving || scoutSaved) && (
                      <div style={{ fontSize: 12, fontWeight: 500, color: scoutSaved ? "var(--success)" : "var(--ink-mute)", marginTop: 8 }}>
                        {scoutSaved ? "✓ 保存しました" : "保存中..."}
                      </div>
                    )}

                    {/* ブロック企業一覧 */}
                    <div style={{
                      marginTop: 20,
                      opacity: scoutEnabled === false ? 0.45 : 1,
                      pointerEvents: scoutEnabled === false ? "none" : "auto",
                      transition: "opacity 0.2s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                        ブロック中の企業
                      </div>
                      {scoutEnabled === false && (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 8 }}>
                          スカウトを受け取らない設定のため、ブロック設定は使用されません。
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 8, lineHeight: 1.6 }}>
                        職務経歴に登録した企業からは自動的に見えません。転職活動が今の会社に知られることはありません。
                      </div>
                      {blockedLoading ? (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", padding: "10px 0" }}>読み込み中…</div>
                      ) : blockedCompanies.length === 0 ? (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, border: "1px solid var(--line)" }}>
                          ブロック中の企業はありません
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {blockedCompanies.map((b, i) => (
                            <div key={b.id ?? `${b.company_id}-${i}`} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", borderRadius: 8,
                              background: "var(--bg-tint)", border: "1px solid var(--line)",
                            }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{b.company_name}</span>
                                <span style={{
                                  marginLeft: 8, fontSize: 12, fontWeight: 600,
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
                                    fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
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
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                          + 企業を追加でブロック
                        </div>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={blockSearchQuery}
                            onChange={e => handleBlockSearch(e.target.value)}
                            placeholder="企業名を検索…"
                            style={{
                              width: "100%", padding: "8px 12px", fontSize: 13,
                              border: "1px solid var(--line)", borderRadius: 8,
                              fontFamily: "inherit", boxSizing: "border-box",
                              color: "var(--ink)", background: "#fff",
                            }}
                          />
                          {blockSearchLoading && (
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>検索中…</div>
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
                                  <div key={c.id} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 14px", borderBottom: "1px solid var(--line-soft)",
                                  }}>
                                    <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.name}</span>
                                    {alreadyBlocked ? (
                                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>ブロック済み</span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={addingBlockId === c.id}
                                        onClick={() => handleAddBlock(c)}
                                        style={{
                                          fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
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
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4 }}>
                          OPINIOに掲載されている企業のみ検索できます
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </FormSection>

              {/* ── Section 3: 転職検討状況 ──────────────────────────────────── */}
              <FormSection
                title="転職検討状況"
                desc="ONにすると、プロフィールに「転職検討中」バッジが表示されます。"
              >
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 16px",
                  background: settings.isOpenToWork ? "#ECFDF5" : "var(--bg-tint)",
                  border: `1px solid ${settings.isOpenToWork ? "#A7F3D0" : "var(--line)"}`,
                  borderRadius: 10, transition: "all 0.2s",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                      転職を検討しています
                      {settings.isOpenToWork && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 100,
                          fontSize: 12, fontWeight: 700,
                          background: "linear-gradient(135deg, var(--success), #10B981)",
                          color: "#fff", fontFamily: "'Inter', sans-serif",
                        }}>
                          ✓ 有効
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                      {settings.isOpenToWork
                        ? "企業側の候補者検索でフィルタリングできます"
                        : "非公開（企業側には表示されません）"}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.isOpenToWork}
                    onClick={() => setSettings((prev) => ({ ...prev, isOpenToWork: !prev.isOpenToWork }))}
                    style={{
                      width: 44, height: 24, borderRadius: 100,
                      background: settings.isOpenToWork ? "var(--success)" : "var(--line)",
                      border: "none", cursor: "pointer",
                      position: "relative", flexShrink: 0, transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3,
                      left: settings.isOpenToWork ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              </FormSection>

              {/* ── 公開設定タブの保存・キャンセル ─────────────────────────── */}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={handleCancelAccount}
                  disabled={!isAccountDirty || accountSaving || accountJustSaved}
                  style={{
                    padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
                    background: "#fff", color: "var(--ink-soft)",
                    border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit",
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
                    color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit",
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
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            アカウントタブ
        ══════════════════════════════════════════════════════════════════ */}
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

            {/* ── Section 3: メール通知設定 ────────────────────────────────── */}
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "#991B1B", marginBottom: 14, lineHeight: 1.7 }}>
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
