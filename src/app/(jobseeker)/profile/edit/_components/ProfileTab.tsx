"use client";

/**
 * 「プロフィール」タブ（写真 / 基本情報 / 職歴 / 学歴 / 実績・受賞 / SNS / 発信コンテンツ）。
 *
 * ⚠️ 3-B（2026-08-15）で `ProfileEditClient.tsx` から**そのまま移した**。
 *    差分は「移動」と「props の受け渡し」だけ。ロジックは変えていない。
 *
 * ⚠️ このタブは**アンマウントされない**（親が display:none で残す）。
 *    アンマウントすると、保存していない入力がタブを移った瞬間に消える。
 *
 * ⚠️ 親へ返すのは**保存済みの値だけ**（3-A-1）。入力中の state を `onSavedChange` に
 *    載せないこと。載せると「保存していないのに完成度が上がる」に戻る。
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/Toast";
import { GhostExample } from "@/components/profile/GhostExample";
import {
  Card,
  FormSection,
  FormGroup,
  CardSaveFooter,
  TextareaField,
  inputStyle,
  selectStyle,
} from "./formKit";
import {
  EducationEditor,
  AchievementEditor,
  AwardEditor,
  MediaAppearanceEditor,
  type RoleItem,
} from "./RecordEditors";
import {
  type Education,
  type School,
  type Achievement,
  type Award,
  type MediaAppearance,
} from "./recordTypes";
import CareerHistoryEditor, { type Stint } from "@/components/profile/CareerHistoryEditor";
import { LOCATIONS } from "@/lib/profile/mockProfileData";
import type { Json } from "@/lib/supabase/types";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";
import type { SettingsState } from "./SettingsTab";

/** JSONB キー名は "x"。値は URL 文字列。空文字列 = 未設定。 */
type SocialLinks = Partial<Record<SocialPlatform, string>>;

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
  headline: string | null;
} | null;

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

type BasicInfo = {
  name: string;
  /** 肩書き1行（40字）。⚠️ 上限は DB の CHECK と API と UI の3つに置く */
  headline: string;
  location: string;
  aboutMe: string;
};

/** 肩書きの上限。⚠️ DB の CHECK（`ow_users_headline_length`）と同じ値にすること。 */
const HEADLINE_MAX = 40;

/** 完成度に渡す「保存済み」の値。★入力中の値を混ぜない */
export type ProfileSavedSnapshot = {
  name: string;
  headline: string;
  aboutMe: string;
  location: string;
  hasBirthDate: boolean;
  avatarUrl: string | null;
  experienceCount: number;
  educationCount: number;
  certOrAchievementCount: number;
  socialOrContentCount: number;
};

function ProfilePhotoUploader({
  owUser,
  basicInfoName,
  settings,
  onAvatarSaved,
}: {
  owUser: OwUser;
  basicInfoName: string;
  settings: SettingsState;
  /** DB への保存が成功したときだけ呼ぶ。完成度は親の保存済みスナップショットから出す */
  onAvatarSaved?: (url: string | null) => void;
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
    /* ⚠️ 応答を捨てない。以前は res を見ずに publicUrl を返していたので、
          DB 保存に失敗しても画面には新しい写真が出ていた（保存済みに見える）。 */
    const res = await fetch("/api/jobseeker/profile-photo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, url: publicUrl }),
    });
    if (!res.ok) {
      console.error("[profile] photo save failed:", res.status);
      setUploadError("写真の保存に失敗しました。もう一度お試しください。");
      setTimeout(() => setUploadError(null), 5000);
      return null;
    }
    if (type === "avatar") onAvatarSaved?.(publicUrl);
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
    const res = await fetch("/api/jobseeker/profile-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) {
      console.error("[profile] photo delete failed:", res.status);
      setUploadError("写真の削除に失敗しました。もう一度お試しください。");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }
    if (type === "avatar") { setAvatarUrl(null); onAvatarSaved?.(null); }
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

function SocialLinksEditor({
  socialLinks,
  setSocialLinks,
  footer,
}: {
  socialLinks: SocialLinks;
  setSocialLinks: React.Dispatch<React.SetStateAction<SocialLinks>>;
  /** カード内の右下に置く操作行。⚠️ カードの外に浮かせないために受け取る */
  footer?: React.ReactNode;
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
        {footer}
      </FormSection>
    </div>
  );
}


export default function ProfileTab({
  owUser,
  settings,
  roles,
  roleAliases = {},
  initialExperiences,
  initialEducations,
  schools,
  initialAchievements,
  initialAwards,
  initialMediaAppearances,
  initialSocialLinks,
  initialContentLinks,
  onSavedChange,
  onDirtyChange,
  notifyGlobalSave,
}: {
  owUser: OwUser;
  /** 写真カードのプレビューに使う色。★保存済みの設定を親から受け取る */
  settings: SettingsState;
  roles: RoleItem[];
  roleAliases?: Record<string, string[]>;
  initialExperiences: Stint[];
  initialEducations: Education[];
  /** 学校マスター。★親が1度だけ取得する（タブ側で取ると開くたびに走る） */
  schools: School[];
  initialAchievements: Achievement[];
  initialAwards: Award[];
  initialMediaAppearances: MediaAppearance[];
  initialSocialLinks: SocialLinks;
  initialContentLinks: ContentLink[];
  onSavedChange: (snapshot: ProfileSavedSnapshot) => void;
  onDirtyChange: (dirty: boolean) => void;
  notifyGlobalSave: (status: "saving" | "saved" | "error") => void;
}) {
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
    headline:         owUser?.headline  ?? "",
    location:         owUser?.location  ?? "",
    aboutMe:          owUser?.about_me  ?? "",
  });
  const [birthYear,  setBirthYear]  = useState<string>(initialParsed.year);
  const [birthMonth, setBirthMonth] = useState<string>(initialParsed.month);
  const [birthDay,   setBirthDay]   = useState<string>(initialParsed.day);

  // 変更検知用の初期値（保存成功時に更新）
  const [initialBasicInfo, setInitialBasicInfo] = useState<BasicInfo>({
    name:             owUser?.name      ?? "",
    headline:         owUser?.headline  ?? "",
    location:         owUser?.location  ?? "",
    aboutMe:          owUser?.about_me  ?? "",
  });
  const [initialBirthYear,  setInitialBirthYear]  = useState<string>(initialParsed.year);
  const [initialBirthMonth, setInitialBirthMonth] = useState<string>(initialParsed.month);
  const [initialBirthDay,   setInitialBirthDay]   = useState<string>(initialParsed.day);

  /* 保存済みのアバターURLと職歴件数。**完成度だけが見る。**
     画像は ProfilePhotoUploader、職歴は CareerHistoryEditor が
     それぞれ自前の state を持っているので、保存成功の通知を受けてここに写す。 */
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(owUser?.avatar_url ?? null);
  const [savedExperienceCount, setSavedExperienceCount] = useState<number>(initialExperiences.length);

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
          headline:         basicInfo.headline,
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

  /* ── 親へ返す（★保存済みの値だけ）───────────────────────────────────── */
  useEffect(() => {
    onSavedChange({
      name:      initialBasicInfo.name,
      headline:  initialBasicInfo.headline,
      aboutMe:   initialBasicInfo.aboutMe,
      location:  initialBasicInfo.location,
      hasBirthDate: !!initialBirthYear && !!initialBirthMonth && !!initialBirthDay,
      avatarUrl: savedAvatarUrl,
      experienceCount: savedExperienceCount,
      educationCount:  educations.length,
      certOrAchievementCount: achievements.length + awards.length + mediaAppearances.length,
      socialOrContentCount:   contentLinks.length + Object.values(savedSocialLinks).filter(Boolean).length,
    });
  }, [
    onSavedChange, initialBasicInfo, initialBirthYear, initialBirthMonth, initialBirthDay,
    savedAvatarUrl, savedExperienceCount, educations, achievements, awards, mediaAppearances,
    contentLinks, savedSocialLinks,
  ]);

  const dirty = isBasicDirty || isSocialDirty;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  return (
    <>
        {/* 基本情報タブ */}
        {/* ⚠️ 写真は「設定」から「プロフィール」の先頭へ移した（2026-08-15）。
               アップロードのロジックは触らず、コンポーネントごと移動しただけ。 */}
          <div style={{ maxWidth: 680 }}>
            <FormSection
              title="プロフィール画像・カバー"
              desc="プロフィールページのヘッダーに表示されます。"
            >
              <ProfilePhotoUploader owUser={owUser} basicInfoName={basicInfo.name} settings={settings} onAvatarSaved={setSavedAvatarUrl} />
            </FormSection>
          </div>

          <div style={{ maxWidth: 680 }}>

            {/* ── 基本情報（名前・肩書き・所在地・生年月日・自己紹介）────────
                ⚠️ **自己紹介を別カードに戻さないこと。**（2026-08-15 統合）
                   保存ボタンは1つで、送る中身も1回の PUT のまま。2枚に分かれていた頃は
                   **保存ボタンが自己紹介側にしか無く**、基本情報カードの中を探しても
                   見つからない状態だった（カード境界とボタンの帰属が1対1でなかった）。 */}
            <FormSection
              title="基本情報"
              desc="プロフィールページの先頭に出ます。"
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

              {/* ⚠️ 肩書きは名前の直下（モックのとおり）。40字の上限は
                     DB の CHECK / API / ここ の3つに置く。 */}
              <FormGroup
                label="肩書き（1行）"
                hint={`${HEADLINE_MAX}字まで ・ 一覧やスカウト画面で最初に読まれる行です`}
                htmlFor="pe-headline"
              >
                <input
                  id="pe-headline"
                  type="text"
                  value={basicInfo.headline}
                  maxLength={HEADLINE_MAX}
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, headline: e.target.value }))}
                  placeholder="例：SaaSの法人営業／IS→FSを6年。次はカスタマーサクセスへ"
                  style={inputStyle()}
                />
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4, textAlign: "right" }}>
                  {basicInfo.headline.length} / {HEADLINE_MAX}
                </div>
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

              <FormGroup
                label="自己紹介"
                hint="あなたのキャリアや想いを、企業・メンターに伝えるテキストです。200字を目安に。"
              >
                <TextareaField
                  value={basicInfo.aboutMe}
                  onChange={(v) => setBasicInfo((prev) => ({ ...prev, aboutMe: v }))}
                  placeholder="例：リクルートで4年間営業を経験後、SaaS 企業に転じてカスタマーサクセスを担当。「人と組織の可能性を広げる仕事」を軸に、次のキャリアを模索しています。"
                  softLimit={200}
                  rows={5}
                  ariaLabel="自己紹介"
                />
              </FormGroup>

            {/* ⚠️ 保存行はカードの中（右下）。処理・送信内容は変えていない。
                   ★他のカードと同じ `CardSaveFooter` を使う。未保存の出し方を揃えるため。 */}
              <CardSaveFooter
                dirty={isBasicDirty}
                saving={basicSaving}
                justSaved={basicJustSaved}
                error={null}
                onSave={handleSaveBasic}
                onCancel={handleCancelBasic}
              />
            </FormSection>

            {basicToastMsg && (
              <Toast
                message={basicToastMsg}
                variant={basicToastVariant}
                onDone={() => setBasicToastMsg(null)}
              />
            )}

          </div>

        {/* 職歴・学歴タブ */}
          <div style={{ maxWidth: 680 }}>

            {/* ⚠️ 中の部品が自前の見出しを描くので `Card`（見出し無し）で包む。 */}
            <Card>
              <CareerHistoryEditor initialExperiences={initialExperiences} roles={roles} roleAliases={roleAliases} birthDate={owUser?.birth_date} onSavedCountChange={setSavedExperienceCount} />
            </Card>
            <Card>
              <EducationEditor
                educations={educations}
                setEducations={setEducations}
                schools={schools}
              />
            </Card>
          </div>

        {/* 実績・受賞（数値実績 / 受賞歴 / メディア掲載 を1枚に）
            ⚠️ 3つを別カードにすると、この画面だけでカードが10枚になる。
               中の見出し（数値実績・受賞歴・メディア掲載）がそのままブロックになる。 */}
          <div style={{ maxWidth: 680 }}>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>
                実績・受賞
              </div>
              {/* ⚠️ 色付きバナーにしない。カード内の補助テキストとして置く。 */}
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
                埋めると、公開プロフィールの説得力が上がり、メンターやキャリアの先輩からの声かけ率が上がります。
              </div>
              <AchievementEditor achievements={achievements} setAchievements={setAchievements} />
              <div style={{ height: 1, background: "var(--line-soft)", margin: "24px 0" }} />
              <AwardEditor awards={awards} setAwards={setAwards} />
              <div style={{ height: 1, background: "var(--line-soft)", margin: "24px 0" }} />
              <MediaAppearanceEditor mediaAppearances={mediaAppearances} setMediaAppearances={setMediaAppearances} />
            </Card>
          </div>

        {/* SNS・発信コンテンツタブ */}
          <>
            <SocialLinksEditor
              socialLinks={socialLinks}
              setSocialLinks={setSocialLinks}
              /* ⚠️ 保存行はカードの中（右下）。処理・送信内容は変えていない。 */
              footer={
                <CardSaveFooter
                  dirty={isSocialDirty}
                  saving={socialSaving}
                  justSaved={socialJustSaved}
                  error={null}
                  onSave={handleSaveSocial}
                  onCancel={handleCancelSocial}
                />
              }
            />
            {socialToastMsg && (
              <Toast
                message={socialToastMsg}
                variant={socialToastVariant}
                onDone={() => setSocialToastMsg(null)}
              />
            )}
          </>

        {/* 発信コンテンツ（SNS・発信タブ内） */}
          <div style={{ maxWidth: 680 }}>
            {/* ⚠️ 色付きバナーにしない（2026-08-15）。カードの desc に混ぜて1行にする。
                   1画面に色付きバナーを2つ以上出さない。 */}
            <FormSection
              title="発信コンテンツ"
              desc="note・Zenn・YouTube・Speaker Deck・GitHub など、外部で発信しているコンテンツのURLを登録できます。繋ぐと、あなたの考え方が企業に伝わり、価値観マッチが起きやすくなります。"
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

              {/* 空のときは記入例を出す（何を登録する欄なのかを文章で説明しない） */}
              {contentLinks.length === 0 && (
                <div style={{ marginBottom: 12 }}>
                  <GhostExample line1="SaaSの立ち上げで学んだこと" line2="note ・ https://note.com/yourname/n/xxxx" />
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
    </>
  );
}
