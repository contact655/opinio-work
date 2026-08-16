"use client";

/**
 * 「プロフィール」タブ（写真 / 基本情報 / 職歴〈実績・受賞を内包〉 / 学歴 / メディア掲載 / SNS / 発信コンテンツ）。
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

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/Toast";
import {
  FormGroup,
  CardSaveFooter,
  CardDoneFooter,
  EditableSection,
  TextareaField,
  inputStyle,
  selectStyle,
} from "./formKit";
import {
  EducationEditor,
  MediaAppearanceEditor,
  AchievementEditor,
  AwardEditor,
  type RoleItem,
  type ExperienceOption,
} from "./RecordEditors";
import {
  type Education,
  type School,
  type Achievement,
  type Award,
  type MediaAppearance,
} from "./recordTypes";
import CareerHistoryEditor, { type Stint } from "@/components/profile/CareerHistoryEditor";
/* ★学歴の表示は公開プロフィールと同じ部品（2026-08-16 / 2-5）。
      `careers={[]}` で学歴だけを描く。並び替え・年マーカーは部品側が持つ。 */
import MergedTimeline from "@/components/profile/MergedTimeline";
import { RowActionButtons, PencilIcon } from "@/components/profile/view/RowActions";
import { buildFutureData } from "@/lib/utils/timeline";
import { ProfileHeader } from "@/components/profile/view/ProfileHeader";
import {
  toTimelineEducationEntries, buildTimelineCareerEntriesFromRaw,
  type RawEducation, type RawExperienceRow, type CompanyLogoInfo, type RoleInfo,
} from "@/lib/utils/timeline";
/* ⚠️ 表示は**公開プロフィールと同じ部品**を使う（2026-08-16）。
      同じ見た目を2箇所に書かない。片方だけ直る状態を作らない。 */
import {
  ProfileContentLinksSection,
  ProfileMediaSection,
  ProfileAchievementsSection,
  ProfileAwardsSection,
  ProfileTimelineSection,
  ProfileAboutSection,
} from "@/components/profile/view/ProfileSections";
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

/** 促しの「追加する →」。⚠️ 見た目はリンクだが**ボタン**（同じページのカードを開く） */
const promoBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
  fontSize: "inherit", fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
  textDecoration: "underline", textUnderlineOffset: 2,
};

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
  onCoverSaved,
  savedAvatarUrl,
  savedCoverPhotoUrl,
}: {
  owUser: OwUser;
  basicInfoName: string;
  settings: SettingsState;
  /** DB への保存が成功したときだけ呼ぶ。完成度は親の保存済みスナップショットから出す */
  onAvatarSaved?: (url: string | null) => void;
  /** ★カバーも同じ形で親へ返す（2026-08-16）。表示モードのプレビューが使う */
  onCoverSaved?: (url: string | null) => void;
  /** ★初期値は**親の保存済みスナップショット**から受け取る（2026-08-16）。
      ⚠️ `owUser`（SSR 時点のプロップ）から初期化しないこと。この部品は
         編集モードを閉じるたびに**アンマウントされる**ので、次に開いたときに
         古い値へ戻り、いま保存した写真が「未登録」に見える（実測で踏んだ）。 */
  savedAvatarUrl: string | null;
  savedCoverPhotoUrl: string | null;
}) {
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(savedAvatarUrl);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(savedCoverPhotoUrl);
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
    else onCoverSaved?.(publicUrl);
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
    else { setCoverPhotoUrl(null); onCoverSaved?.(null); }
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

/**
 * SNS の**編集フォームだけ**（2026-08-16 に表示の枝を落とした）。
 *
 * ⚠️ **表示（アイコン列・空状態・見出し・説明文）をここに書かないこと。**
 *    見出しと説明文は `EditableSection`、アイコン列は `ProfileSocialLinks`（公開と共通）、
 *    0件の1行は `SocialLinksView` が持つ。
 *    以前はここに `FormSection`（枠＋見出し＋説明文）を描く分岐があったが、
 *    `EditableSection` の中で使う今は**通らない枝**だったので消した。
 */
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
    <>
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
    </>
  );
}


/** 発信コンテンツの入力値。追加と編集で同じ形を使う */
type LinkDraft = {
  url: string;
  platform: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
};

const EMPTY_LINK_DRAFT: LinkDraft = {
  url: "", platform: "other", title: "", description: "", thumbnail_url: null,
};

const draftFromLink = (l: ContentLink): LinkDraft => ({
  url: l.url,
  platform: l.platform ?? "other",
  title: l.title ?? "",
  description: l.description ?? "",
  thumbnail_url: l.thumbnail_url,
});

/**
 * 発信コンテンツの入力フォーム。**追加と編集で同じものを使う**（2026-08-16）。
 *
 * ⚠️ 編集用のフォームを別に作らない。項目・検証・OGP 取得が2箇所に割れると、
 *    片方だけ直る形の不具合が生まれる（週次メールの配信停止で実際に起きた形）。
 *
 * ⚠️ ★初期値は呼び出し側が渡す `initial` から取る。**閉じるとアンマウントされる**ので、
 *    `initial` には必ず**保存済みの行**（親の `contentLinks`）を渡すこと。
 *    SSR 時点のプロップを渡すと、保存した値が開き直しで消える
 *    （`.claude/rules/ui-debugging.md` ⑦）。
 */
function ContentLinkForm({
  heading, initial, submitLabel, saving, error, onSubmit, onCancel,
}: {
  heading: string;
  initial: LinkDraft;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (draft: LinkDraft) => void;
  /** 省略すると「キャンセル」を出さない（追加フォームはカードの「完了」が出口） */
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<LinkDraft>(initial);
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpFetched, setOgpFetched] = useState(false);

  const set = <K extends keyof LinkDraft>(k: K, v: LinkDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /* URL を離れたときに OGP を取りに行く。★埋まっている項目は上書きしない
     （編集で開いたときに、本人が書いたタイトルを消さないため） */
  const handleUrlBlur = async () => {
    const url = draft.url.trim();
    if (!url) return;
    try { new URL(url); } catch { return; }
    setOgpFetching(true);
    setOgpFetched(false);
    try {
      const res = await fetch(`/api/jobseeker/content-links/ogp?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data: { title: string | null; thumbnail_url: string | null; description: string | null } = await res.json();
      setDraft((d) => ({
        ...d,
        title: data.title && !d.title.trim() ? data.title : d.title,
        description: data.description && !d.description.trim() ? data.description.slice(0, 200) : d.description,
        thumbnail_url: data.thumbnail_url ?? d.thumbnail_url,
      }));
      if (data.title || data.thumbnail_url) setOgpFetched(true);
    } catch {
      // サイレントフェイル（OGP は補助。取れなくても入力は続けられる）
    } finally {
      setOgpFetching(false);
    }
  };

  const disabled = saving || !draft.url.trim();

  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>{heading}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>URL *</label>
          <input
            type="url"
            value={draft.url}
            onChange={(e) => {
              const v = e.target.value;
              setOgpFetched(false);
              setDraft((d) => ({ ...d, url: v, platform: v.trim() ? detectPlatform(v.trim()) : d.platform }));
            }}
            onBlur={() => { void handleUrlBlur(); }}
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
            value={draft.platform}
            onChange={(e) => set("platform", e.target.value)}
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
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例：SaaS営業で学んだこと"
            maxLength={200}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>説明（任意）</label>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="一言コメント"
            maxLength={500}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onSubmit(draft)}
            disabled={disabled}
            style={{
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: disabled ? "var(--bg-tint)" : "var(--royal)",
              color: disabled ? "var(--ink-mute)" : "#fff",
              border: "none", cursor: disabled ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "保存中..." : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "#fff", color: "var(--ink-soft)",
                border: "1px solid var(--line)", cursor: saving ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 発信コンテンツ1行の読み取り表示（表示モードと編集モードの一覧で共用） */
/* ⚠️ 発信コンテンツの表示（`ContentLinksView` / `ContentLinkRow`・110行）は
      2026-08-16 に削除した。**公開プロフィールと同じ `ProfileContentLinksSection`**
      を使う。ここに描き直さないこと。 */

/** 生年月日3つから年齢を出す。★揃っていなければ null（「0歳」を出さない） */
function ageFromBirth({ year, month, day }: { year: string; month: string; day: string }): number | null {
  if (!year || !month || !day) return null;
  const y = Number(year), m = Number(month), d = Number(day);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
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
  companyLogoInfo = [],
  followCounts,
  openBasicNonce = 0, openHeaderNonce = 0,
  openCareerNonce = 0,
}: {
  owUser: OwUser;
  /* ── 外からカードを開く合図。0 のときは何もしない ────────────────────
        ⚠️ 値が**変わるたび**に開く。真偽値にしないこと（2回目が効かなくなる）。 */
  /** ★職歴の表示を組み直すための企業ロゴ情報（2026-08-16 / 2-6） */
  companyLogoInfo?: ({ id: string } & CompanyLogoInfo)[];
  /** ★ヘッダーに出すフォロー数（2026-08-16 / 2-7）。0 の項目は出ない */
  followCounts?: { followers: number; following: number };
  /** ★「自己紹介を入力する →」から `#about` を編集モードで開く（2026-08-16 / 2-7） */
  openBasicNonce?: number;
  /** ★「名前を入力する →」からヘッダーを編集モードで開く。名前はヘッダー側にある */
  openHeaderNonce?: number;
  openCareerNonce?: number;
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
  /** 行編集の対象。★常に1つ。別の行の鉛筆を押すと前の行は閉じる（差し替わるだけ） */
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  /** 追加フォームを初期化するための鍵。追加が成功したら +1 して作り直す */
  const [addFormNonce, setAddFormNonce] = useState(0);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  /* ⚠️ `linkSaving` / `linkError` を追加と編集で共有している。
        **同時に出るフォームは常に1つ**（行を編集している間は追加フォームを出さない）
        なので取り違えは起きない。モードを切り替えるときにエラーを消すこと。 */
  const startEditLink = (id: string) => { setLinkError(null); setEditingLinkId(id); };
  const cancelEditLink = () => { setLinkError(null); setEditingLinkId(null); };

  const handleAddContentLink = async (draft: LinkDraft) => {
    const url = draft.url.trim();
    if (!url) { setLinkError("URLを入力してください"); return; }
    setLinkSaving(true); setLinkError(null);
    try {
      const res = await fetch("/api/jobseeker/content-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          platform: draft.platform,
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          thumbnail_url: draft.thumbnail_url || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLinkError(err.message ?? "保存に失敗しました");
        return;
      }
      const inserted: ContentLink = await res.json();
      setContentLinks((prev) => [...prev, inserted]);
      setAddFormNonce((n) => n + 1); // 入力欄を空に戻す（フォームを作り直す）
    } catch {
      setLinkError("通信エラーが発生しました");
    } finally {
      setLinkSaving(false);
    }
  };

  /* ⚠️ 保存後は**API の戻り値で該当行を置き換える**。手元の draft で置き換えない
        （サーバー側の正規化（trim・切り詰め・null 化）が反映されなくなる）。 */
  const handleUpdateContentLink = async (id: string, draft: LinkDraft) => {
    const url = draft.url.trim();
    if (!url) { setLinkError("URLを入力してください"); return; }
    setLinkSaving(true); setLinkError(null);
    try {
      const res = await fetch(`/api/jobseeker/content-links/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          platform: draft.platform,
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          thumbnail_url: draft.thumbnail_url || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLinkError(err.message ?? "保存に失敗しました");
        return; // ★失敗時は編集モードのまま（入力を捨てない）
      }
      const updated: ContentLink = await res.json();
      setContentLinks((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingLinkId(null);
      /* ★行の編集は保存したら**カードごと表示モードに戻す**（2026-08-16）。
            戻さないと「新しいコンテンツを追加」のフォームが出たままになり、
            直したはずの行が画面から消えたように見える（実測で確認）。
         ⚠️ 追加のときは閉じない（続けて足せるように。出口は「完了」）。 */
      setEditingContent(false);
    } catch {
      setLinkError("通信エラーが発生しました");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteContentLink = async (id: string) => {
    if (editingLinkId === id) setEditingLinkId(null);
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

  /* ⚠️ 「その他の実績・受賞」というまとめ方は 2026-08-16 にやめた。
        実績・受賞が独立セクションになり、紐づけの有無で置き場所を分ける必要が
        無くなったため（紐づけはフォームのセレクトで見える）。 */

  // ── SNS タブの状態（明示保存方式） ──────────────────────────────────────
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  // 保存済みの値を保持して変更検知（JSON.stringify 比較）
  const [savedSocialLinks, setSavedSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  const [socialSaving,       setSocialSaving]       = useState(false);
  const [socialToastMsg,     setSocialToastMsg]     = useState<string | null>(null);
  const socialToastVariant = "default" as const;

  const isSocialDirty = JSON.stringify(socialLinks) !== JSON.stringify(savedSocialLinks);

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
  /* ★カバーも保存済みの値を親で持つ（2026-08-16）。表示モードのプレビューが見る。
     ⚠️ アップローダー内部の state（coverPhotoUrl）を表示モードに使わない。 */
  const [savedCoverPhotoUrl, setSavedCoverPhotoUrl] = useState<string | null>(owUser?.cover_photo_url ?? null);
  const [savedExperienceCount, setSavedExperienceCount] = useState<number>(initialExperiences.length);

  /* 表示 ⇄ 編集（2026-08-16 / LinkedIn 型）。既定は表示モード。
     ⚠️ カードごとに独立させる。複数のカードを同時に開けてよい。 */
  /* ★ヘッダー（写真・カバー・名前・肩書き・所在地・生年月日・SNS）と自己紹介（2026-08-16 / 2-7）。
        `editingBasic` は「ヘッダーの編集」に置き換えた。促し（`openBasicNonce`）もこちらを開く。 */
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingAbout,  setEditingAbout]  = useState(false);
  const [aboutSaving,    setAboutSaving]    = useState(false);
  const [aboutJustSaved, setAboutJustSaved] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  /* 職歴カードの見出し「＋」→ 追加モーダルを開く合図。値が変わるたびに開く */
  const [careerAddNonce, setCareerAddNonce] = useState(0);
  /* 職歴（2026-08-16 / 2-6）。表示は公開部品が描くので、保存済みの職歴を親でも持つ。
     ⚠️ **所有者は `CareerHistoryEditor` のまま**（保存の成否を知っているのは向こう）。
        ここは `onStintsChange` で受け取った控え。編集用モーダルは常にマウントしておく
        （アンマウントすると控えが初期値に巻き戻る）。 */
  const [careerStints, setCareerStints] = useState<Stint[]>(initialExperiences);
  const [editingCareerId, setEditingCareerId] = useState<string | null>(null);
  const [deleteCareerId,  setDeleteCareerId]  = useState<string | null>(null);
  const [addRoleForId,    setAddRoleForId]    = useState<string | null>(null);
  /* `Stint`（編集用）→ `CareerEntry`（表示用）。`/u/[id]` と同じ関数を通す。
     ⚠️ 新しく選んだ企業のロゴは `companyLogoInfo` に無い。頭文字＋既定色に落ちるだけで
        再読み込みすれば正しく出る（`CompanyLogoIcon` が logo_url null を扱える）。 */
  const timelineCareers = useMemo(() => {
    const companyMap = new Map<string, CompanyLogoInfo>(companyLogoInfo.map((c) => [c.id, c]));
    const roleMap = new Map<string, RoleInfo>(
      roles.map((r) => [r.id, { name: r.name, parent_name: r.parent_id ? (roles.find((p) => p.id === r.parent_id)?.name ?? null) : null }]),
    );
    const rows: RawExperienceRow[] = careerStints.map((s) => ({
      id: s.id,
      company_id: s.companyId ?? null,
      company_text: s.companyText ?? null,
      company_anonymized: s.companyAnonymized ?? null,
      role_category_id: s.roleCategoryId,
      role_title: s.roleTitle ?? null,
      department: s.department ?? null,
      rank: s.rank ?? null,
      /* ⚠️ `Stint` は "YYYY-MM"、`CareerEntry` は "YYYY-MM-DD"。1日を足す */
      started_at: `${s.startedAt}-01`,
      ended_at: s.isCurrent ? null : (s.endedAt ? `${s.endedAt}-01` : null),
      is_current: s.isCurrent,
      description: s.description ?? null,
      join_reason: s.joinReason ?? null,
      employment_type: s.employmentType ?? null,
      visibility_company_profile: s.visibilityCompanyProfile,
    }));
    return buildTimelineCareerEntriesFromRaw(rows, roleMap, companyMap, true);
  }, [careerStints, companyLogoInfo, roles]);
  const [eduAddNonce, setEduAddNonce] = useState(0);
  /* 学歴（2026-08-16 / 2-5）。行の鉛筆・ゴミ箱から編集フォームを開くための id */
  const [editingEdu,   setEditingEdu]   = useState(false);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [deleteEduId,  setDeleteEduId]  = useState<string | null>(null);
  /* 年表の行にも、年表に載らない行にも同じものを渡す */
  const eduActions = {
    onEditRow:   (id: string) => { setEditingEduId(id); setEditingEdu(true); },
    onDeleteRow: (id: string) => { setDeleteEduId(id); setEditingEdu(true); },
  };
  const [mediaAddNonce, setMediaAddNonce] = useState(0);
  /* 数値実績・受賞（2026-08-16 / 2-4）。表示⇄編集は 2-2/2-3 と同じ形 */
  /* 紐づけセレクトの選択肢。★職歴の表示名だけを渡す（実績側は職歴の中身を知らない）。
     ⚠️ `initialExperiences` ではなく **`savedExperienceCount` を動かしている一覧**を
        見たいが、職歴の実体は `CareerHistoryEditor` が持つ。ここでは初期値を使う。
        職歴を足した直後にセレクトへ出ないのは既知の割り切り（再読み込みで出る）。 */
  const experienceOptions: ExperienceOption[] = initialExperiences.map((e) => ({
    id: e.id,
    label: `${e.displayCompanyName}（${e.startedAt}〜${e.isCurrent ? "現在" : e.endedAt ?? ""}）`,
  }));

  const [editingAch, setEditingAch] = useState(false);
  const [editingAchId, setEditingAchId] = useState<string | null>(null);
  const [deleteAchId, setDeleteAchId] = useState<string | null>(null);
  const [achAddNonce, setAchAddNonce] = useState(0);
  const [editingAwd, setEditingAwd] = useState(false);
  const [editingAwdId, setEditingAwdId] = useState<string | null>(null);
  const [deleteAwdId, setDeleteAwdId] = useState<string | null>(null);
  const [awdAddNonce, setAwdAddNonce] = useState(0);
  /* メディア掲載: 表示⇄編集（2026-08-16 / 2-3）。行の鉛筆から来たときは id を持つ */
  const [editingMedia, setEditingMedia] = useState(false);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  /* ⚠️ 削除は既存の確認ダイアログを使う。エディタ側が持っているので id を渡して開く */
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);

  /* ── 外（ヘッダーカードの促し・右カラムの「あと2つ」）から特定のカードを開く ──
        ⚠️ **`openAddNonce` と同じ形**（nonce を受けて useEffect で開く）。
           新しい仕組みを作らない。

        ⚠️ **nonce は消費しても 0 に戻らない。** だから「受け側がアンマウントするか」で
           意味が変わる（2026-08-16 に実測）。

           | 受け側 | アンマウントするか | 結果 |
           |---|---|---|
           | この `ProfileTab`（`openBasicNonce` / `openSocialNonce` / `openCareerNonce`） | **しない**（`ProfileEditor` が `display:none` で残す） | 安全 |
           | `CareerHistoryEditor`（`careerAddNonce`） | **しない**（カードの children にいる） | 安全 |
           | 学歴・実績・受賞・メディア掲載（`openAddNonce`） | **する**（`editContent` にいる） | **一度追加を使うと、次に鉛筆・ゴミ箱で開いたとき追加フォームまで開いていた**（修正済み） |

        ⚠️ **`CareerHistoryEditor` を `editContent` に移すときは、同じガードを入れること**
           （`openEditId` / `openDeleteId` が立っているときは追加を開かない）。
           移した瞬間にアンマウントする側に変わる。
        ⚠️ **スクロールは編集モードが開いたあと**に呼ぶ。開く前に呼ぶと
           カードの高さが変わって着地位置がずれる。 */
  /* ⚠️ **ref は実際の要素に付けること。** 2-7 でカードを作り直したとき
        `basicCardRef` の付け先が消え、押しても開くだけでスクロールしなくなっていた
        （2026-08-16 に実測。`scrollAfterPaint(null)` は黙って何もしない）。 */
  const aboutCardRef  = useRef<HTMLDivElement>(null);
  const headerCardRef = useRef<HTMLDivElement>(null);

  const scrollAfterPaint = (el: HTMLElement | null) => {
    if (!el) return;
    /* ⚠️ **`requestAnimationFrame` に頼らない。** 描画されていないタブ・
          非表示のプレビューでは rAF が発火せず、**スクロールだけが静かに起きない**
          （2026-08-16 に実測。カードは開くのに scrollIntoView が呼ばれなかった）。
       ⚠️ 0ms ではなく少し待つ。**編集モードが開いて高さが変わったあと**に測らないと
          着地位置がずれる。 */
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  /* ⚠️ 促しの行き先は 2-7 で変わった。自己紹介はヘッダーから独立セクションへ移り、
        SNS はヘッダーの中に入った（SNS カードは廃止）。 */
  useEffect(() => {
    if (!openBasicNonce) return;
    setEditingAbout(true);
    scrollAfterPaint(aboutCardRef.current);
  }, [openBasicNonce]);
  useEffect(() => {
    if (!openHeaderNonce) return;
    setEditingHeader(true);
    scrollAfterPaint(headerCardRef.current);
  }, [openHeaderNonce]);
  /* 職歴は**モーダル**なのでスクロールしない（画面中央に出る） */
  useEffect(() => {
    if (!openCareerNonce) return;
    setCareerAddNonce((n) => n + 1);
  }, [openCareerNonce]);

  const [basicSaving,       setBasicSaving]       = useState(false);
  const [basicJustSaved,    setBasicJustSaved]    = useState(false);
  const [basicToastMsg,     setBasicToastMsg]     = useState<string | null>(null);
  const [basicToastVariant, setBasicToastVariant] = useState<"default" | "error">("default");

  /* 保存が成功したときだけ表示モードへ戻す。
     ⚠️ 失敗時は戻さない（編集モードのままエラーを出す）。`basicJustSaved` は
        `handleSaveBasic` の成功パスでしか true にならない。 */
  useEffect(() => {
    if (basicJustSaved) setEditingHeader(false);
  }, [basicJustSaved]);

  const isBasicDirty =
    JSON.stringify(basicInfo) !== JSON.stringify(initialBasicInfo) ||
    birthYear  !== initialBirthYear  ||
    birthMonth !== initialBirthMonth ||
    birthDay   !== initialBirthDay;

  /* ★ヘッダーの鉛筆で編集する範囲（2026-08-16 / 2-7）。自己紹介は含めない。 */
  const isHeaderDirty = isBasicDirty || isSocialDirty;
  /* 年齢は導出値（生年月日から作る）。**保存済みの値**から作る */
  const headerAge = ageFromBirth({ year: initialBirthYear, month: initialBirthMonth, day: initialBirthDay });

  /* ★ヘッダーの保存（2026-08-16 / 2-7）。名前・肩書き・所在地・生年月日・SNS を
        **1回の PUT** で送る。自己紹介（`about_me`）は送らない。
     ⚠️ API は `"キー" in body` でしか列を触らないので、送らない列は動かない。 */
  const handleSaveHeader = useCallback(async () => {
    setBasicSaving(true);
    setSocialSaving(true);
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
          name:         basicInfo.name,
          headline:     basicInfo.headline,
          location:     basicInfo.location,
          birth_date:   birthDate,
          social_links: socialLinks,
        }),
      });
      if (!res.ok) throw new Error();
      /* ⚠️ 自己紹介は送っていないので、控えも触らない（送った列だけ進める） */
      setInitialBasicInfo((prev) => ({ ...prev, name: basicInfo.name, headline: basicInfo.headline, location: basicInfo.location }));
      setInitialBirthYear(birthYear);
      setInitialBirthMonth(birthMonth);
      setInitialBirthDay(birthDay);
      setSavedSocialLinks(socialLinks);
      setBasicToastVariant("default");
      setBasicToastMsg("プロフィールを保存しました");
      setBasicJustSaved(true);
      notifyGlobalSave("saved");
      setTimeout(() => setBasicJustSaved(false), 3000);
    } catch {
      setBasicToastVariant("error");
      setBasicToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setBasicSaving(false);
      setSocialSaving(false);
    }
  }, [basicInfo, birthYear, birthMonth, birthDay, socialLinks, notifyGlobalSave]);

  /* ★自己紹介の保存。**`about_me` 1列だけ**を送る */
  const handleSaveAbout = useCallback(async () => {
    setAboutSaving(true);
    notifyGlobalSave("saving");
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about_me: basicInfo.aboutMe }),
      });
      if (!res.ok) throw new Error();
      setInitialBasicInfo((prev) => ({ ...prev, aboutMe: basicInfo.aboutMe }));
      setBasicToastVariant("default");
      setBasicToastMsg("自己紹介を保存しました");
      setAboutJustSaved(true);
      notifyGlobalSave("saved");
      setTimeout(() => setAboutJustSaved(false), 3000);
      setEditingAbout(false);
    } catch {
      setBasicToastVariant("error");
      setBasicToastMsg("保存に失敗しました。もう一度お試しください。");
      notifyGlobalSave("error");
    } finally {
      setAboutSaving(false);
    }
  }, [basicInfo.aboutMe, notifyGlobalSave]);

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
        {/* ── ヘッダー（2026-08-16 / 2-7）──────────────────────────────────
               ★`UserProfileCard` / 「プロフィール画像・カバー」/「基本情報」の3枚を
                 1つにまとめ、**公開プロフィールと同じ `ProfileHeader`** を使う。
               ⚠️ 自己紹介はここから外し、独立セクション（`#about`）に移した。
                  `/u/[id]` がそうなっているので構造を合わせる。
               ⚠️ 現職・年齢は導出値なので鉛筆の対象外。 */}
          <div ref={headerCardRef} style={{ maxWidth: 680, scrollMarginTop: 80 }}>
            {editingHeader ? (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>プロフィール</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
                  写真・名前・肩書き・所在地・生年月日・SNS。プロフィールページの先頭に出ます。
                </div>
                <ProfilePhotoUploader
                  owUser={owUser}
                  basicInfoName={basicInfo.name}
                  settings={settings}
                  onAvatarSaved={setSavedAvatarUrl}
                  onCoverSaved={setSavedCoverPhotoUrl}
                  savedAvatarUrl={savedAvatarUrl}
                  savedCoverPhotoUrl={savedCoverPhotoUrl}
                />
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
                <SocialLinksEditor socialLinks={socialLinks} setSocialLinks={setSocialLinks} />
                {/* ⚠️ 保存は**1回の PUT**。名前・肩書き・所在地・生年月日・SNS を一緒に送る
                       （API は `"キー" in body` でしか触らないので、送らない列は動かない）。 */}
                <CardSaveFooter
                  dirty={isHeaderDirty}
                  saving={basicSaving || socialSaving}
                  justSaved={basicJustSaved}
                  error={null}
                  onSave={handleSaveHeader}
                  onCancel={() => { handleCancelBasic(); handleCancelSocial(); setEditingHeader(false); }}
                />
              </section>
            ) : (
              <ProfileHeader
                name={initialBasicInfo.name}
                headline={initialBasicInfo.headline}
                initial={initialBasicInfo.name.charAt(0) || "?"}
                avatarUrl={savedAvatarUrl}
                avatarColor={settings.avatarColor}
                coverPhotoUrl={savedCoverPhotoUrl}
                coverColor={settings.coverColor || settings.avatarColor}
                ageDisplay={headerAge !== null ? `${headerAge}歳` : null}
                location={initialBasicInfo.location}
                followCounts={followCounts ?? { followers: 0, following: 0 }}
                socialLinks={savedSocialLinks}
                currentCareer={timelineCareers.find((c) => c.is_current) ?? null}
                isCurrentCompanyKnown={!!timelineCareers.find((c) => c.is_current)?.company_id}
                /* ★促し。`UserProfileCard` にあったものをヘッダーへ移した（2-7）。
                      ⚠️ リンクにしない。同じページなので `href` では何も起きない。 */
                promos={<>
                  {/* ⚠️ 自己紹介の促しはここに置かない（2026-08-16 / 2-7 で実測）。
                         すぐ下の `#about` セクションが 0件のとき同じ入口を出しており、
                         **同じ操作の入口が40px 差で2つ縦に並ぶ**（ルール⑧）。 */}
                  {Object.values(savedSocialLinks).filter(Boolean).length === 0 && (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                      SNS リンクを追加すると企業の在籍ユーザーに見てもらえます。
                      <button type="button" onClick={() => setEditingHeader(true)} style={promoBtn}>追加する →</button>
                    </p>
                  )}
                </>}
                topRight={
                  <button
                    type="button"
                    onClick={() => setEditingHeader(true)}
                    aria-label="プロフィールを編集"
                    title="プロフィールを編集"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 8,
                      border: "1px solid var(--line)", background: "#fff",
                      color: "var(--ink-soft)", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <PencilIcon />
                    編集
                  </button>
                }
              />
            )}

            {basicToastMsg && (
              <Toast message={basicToastMsg} variant={basicToastVariant} onDone={() => setBasicToastMsg(null)} />
            )}
            {socialToastMsg && (
              <Toast message={socialToastMsg} variant={socialToastVariant} onDone={() => setSocialToastMsg(null)} />
            )}
          </div>

          {/* ── 自己紹介（#about）──────────────────────────────────────────
                 ★ヘッダーから外して独立セクションにした（2026-08-16 / 2-7）。
                 `/u/[id]` と同じ位置・同じ見た目。 */}
          <div ref={aboutCardRef} style={{ maxWidth: 680, scrollMarginTop: 80 }}>
            {editingAbout ? (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 16 }}>自己紹介</div>
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
                {/* ⚠️ 送るのは `about_me` **1列だけ**。ヘッダー側の保存とは別の呼び出しになるが、
                       API のパスも送る列も変えていない（`"about_me" in body` のときだけ触る）。 */}
                <CardSaveFooter
                  dirty={basicInfo.aboutMe !== initialBasicInfo.aboutMe}
                  saving={aboutSaving}
                  justSaved={aboutJustSaved}
                  error={null}
                  onSave={handleSaveAbout}
                  onCancel={() => { setBasicInfo((prev) => ({ ...prev, aboutMe: initialBasicInfo.aboutMe })); setEditingAbout(false); }}
                />
              </section>
            ) : (
              <ProfileAboutSection
                aboutMe={initialBasicInfo.aboutMe || null}
                viewerIsOwner
                onEdit={() => setEditingAbout(true)}
              />
            )}
          </div>

        {/* ★数値実績 / 受賞・表彰（2026-08-16 / 2-4）。
               公開プロフィールと同じ**独立した2セクション**。並び順も `/u/[id]` に合わせ、
               自己紹介（基本情報）の直後・職歴の前に置く。
            ⚠️ 職歴カードの中に入れ子で戻さないこと。紐づけはフォームのセレクトで選ぶ。 */}
          <div style={{ maxWidth: 680 }}>
            <EditableSection
              title="数値実績"
              description="定量的な成果を登録できます。売上達成率・顧客獲得数・コスト削減など。"
              isEditing={editingAch}
              onStartEdit={() => { setEditingAchId(null); setEditingAch(true); setAchAddNonce((n) => n + 1); }}
              action="add"
              actionLabel="数値実績を追加"
              chrome="none"
              editContent={
                <AchievementEditor
                  achievements={achievements}
                  setAchievements={setAchievements}
                  openAddNonce={achAddNonce}
                  openEditId={editingAchId}
                  openDeleteId={deleteAchId}
                  experienceOptions={experienceOptions}
                  onClosed={() => { setEditingAchId(null); setDeleteAchId(null); setEditingAch(false); }}
                />
              }
            >
              <ProfileAchievementsSection
                achievements={achievements}
                actions={{
                  onEditRow: (id) => { setEditingAchId(id); setEditingAch(true); },
                  onDeleteRow: (id) => { setDeleteAchId(id); setEditingAch(true); },
                  onAdd: () => { setEditingAchId(null); setEditingAch(true); setAchAddNonce((n) => n + 1); },
                }}
              />
            </EditableSection>

            <EditableSection
              title="受賞・表彰"
              description="社内表彰・業界アワードなどを登録できます。"
              isEditing={editingAwd}
              onStartEdit={() => { setEditingAwdId(null); setEditingAwd(true); setAwdAddNonce((n) => n + 1); }}
              action="add"
              actionLabel="受賞・表彰を追加"
              chrome="none"
              editContent={
                <AwardEditor
                  awards={awards}
                  setAwards={setAwards}
                  openAddNonce={awdAddNonce}
                  openEditId={editingAwdId}
                  openDeleteId={deleteAwdId}
                  experienceOptions={experienceOptions}
                  onClosed={() => { setEditingAwdId(null); setDeleteAwdId(null); setEditingAwd(false); }}
                />
              }
            >
              <ProfileAwardsSection
                awards={awards}
                actions={{
                  onEditRow: (id) => { setEditingAwdId(id); setEditingAwd(true); },
                  onDeleteRow: (id) => { setDeleteAwdId(id); setEditingAwd(true); },
                  onAdd: () => { setEditingAwdId(null); setEditingAwd(true); setAwdAddNonce((n) => n + 1); },
                }}
              />
            </EditableSection>
          </div>

        {/* 職歴・学歴タブ */}
          <div style={{ maxWidth: 680 }}>

            {/* ★枠と見出しは公開プロフィールと同じ部品（2026-08-16 / 2-6）。
                   `EditableSection` はやめた。`/u/[id]` の「職歴」「学歴」の見出しは
                   元から `page.tsx` にあり、**切り出していなかっただけ**だった。
                   ★このカードに「編集モード」は無い。編集も追加も**モーダル**なので、
                   `CareerHistoryEditor` は常に描いておく。アンマウントすると
                   `careerStints` の控えが初期値へ巻き戻る。 */}
            <ProfileTimelineSection
              id="career"
              title="職歴"
              onAdd={() => setCareerAddNonce((n) => n + 1)}
              addLabel="職歴を追加"
            >
              {careerStints.length === 0 && (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                  まだ職歴を登録していません。
                  <button
                    type="button"
                    onClick={() => setCareerAddNonce((n) => n + 1)}
                    style={{
                      background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
                      fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
                      textDecoration: "underline", textUnderlineOffset: 2,
                    }}
                  >
                    職歴を追加する
                  </button>
                </p>
              )}
              {/* ⚠️ 職歴が0件でも描く。**「将来やりたいこと」がこの中にある**ため
                     （`MergedTimeline` は future が無ければ何も描かずに null を返す）。 */}
              {(
                /* ★表示は公開プロフィールと同じ部品。行の鉛筆・ゴミ箱と
                      「この会社に役割を追加」だけ足す。
                   ⚠️ `collapseAfter` は渡さない。`/u/[id]` は4件で畳むが、
                      畳んだ先の行は**編集できなくなる**。ここは自分の入力欄なので全件出す。 */
                <MergedTimeline
                  careers={timelineCareers}
                  educations={[]}
                  /* ★「将来やりたいこと」（2026-08-16）。年表の**先頭**に出る（`buildTimeline` が
                        future を常に先頭に置く）。編集は `FutureSectionEditor` が丸ごと担うので、
                     ⚠️ `EditableSection` や `ProfileTimelineSection` で包まない（鉛筆が2つになる）。 */
                  future={buildFutureData(
                    { name: initialBasicInfo.name, avatar_color: settings.avatarColor, future_aspirations: owUser?.future_aspirations ?? null },
                    true,
                  )}
                  viewerIsOwner
                  birthDate={owUser?.birth_date}
                  careerActions={{
                    onEditRow:   (id) => setEditingCareerId(id),
                    onDeleteRow: (id) => setDeleteCareerId(id),
                    onAddRole:   (id) => setAddRoleForId(id),
                  }}
                />
              )}
              {/* ★モーダルと削除確認だけ。一覧は上の `MergedTimeline` が持つ（2-6） */}
              <CareerHistoryEditor
                openAddNonce={careerAddNonce}
                openEditId={editingCareerId}
                openDeleteId={deleteCareerId}
                openAddRoleForCareerId={addRoleForId}
                onClosed={() => { setEditingCareerId(null); setDeleteCareerId(null); setAddRoleForId(null); }}
                onStintsChange={setCareerStints}
                initialExperiences={initialExperiences}
                roles={roles}
                roleAliases={roleAliases}
                onSavedCountChange={setSavedExperienceCount}
                /* ★職歴を消しても実績は消えない（ON DELETE SET NULL）。手元の state も
                      同じように null へ落とす。やらないと再読み込みするまで消えたように見える。 */
                onExperienceDeleted={(experienceId) => {
                  setAchievements((prev) => prev.map((a) => a.experience_id === experienceId ? { ...a, experience_id: null } : a));
                  setAwards((prev) => prev.map((a) => a.experience_id === experienceId ? { ...a, experience_id: null } : a));
                }}
              />
            </ProfileTimelineSection>
            {/* ★2-5 では枠と見出しを `EditableSection` に持たせていたが、**判断が誤っていた**。
                   `/u/[id]` の「学歴」の見出しは元からあり、`page.tsx` に直接書かれていた
                   （＝切り出していなかっただけ）。2-6 で職歴とまとめて切り出して揃えた。 */}
            <ProfileTimelineSection
              id="education"
              title="学歴"
              onAdd={() => { setEditingEduId(null); setEditingEdu(true); setEduAddNonce((n) => n + 1); }}
              addLabel="学歴を追加"
            >
              {editingEdu ? (
                <EducationEditor
                  educations={educations}
                  setEducations={setEducations}
                  schools={schools}
                  hideHeading
                  openAddNonce={eduAddNonce}
                  openEditId={editingEduId}
                  openDeleteId={deleteEduId}
                  /* ★フォームを閉じたら表示へ戻す（2-2〜2-5 と同じ）。 */
                  onClosed={() => { setEditingEduId(null); setDeleteEduId(null); setEditingEdu(false); }}
                />
              ) : educations.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                  まだ学歴を登録していません。
                  <button
                    type="button"
                    onClick={() => { setEditingEduId(null); setEditingEdu(true); setEduAddNonce((n) => n + 1); }}
                    style={{
                      background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
                      fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
                      textDecoration: "underline", textUnderlineOffset: 2,
                    }}
                  >
                    学歴を追加する
                  </button>
                </p>
              ) : (
                <>
                  {/* ★表示は公開プロフィールと同じ部品。行の鉛筆・ゴミ箱だけ足す */}
                  <MergedTimeline
                    careers={[]}
                    educations={toTimelineEducationEntries(educations as RawEducation[])}
                    future={null}
                    educationActions={eduActions}
                  />
                  {/* ⚠️ `toTimelineEducationEntries` は**入学年月が無い行を落とす**（年表に置けないため）。
                         公開プロフィールでも出ていない。ここで拾わないと、
                         **本人の画面からも消えて編集も削除もできなくなる**（2026-08-16 / 2-5）。
                         実データに1件ある（他人の行）。 */}
                  {educations.filter((e) => !e.enrolled_at).map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{e.school}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3, lineHeight: 1.7 }}>
                          入学年月が未入力のため、公開プロフィールには表示されていません。
                        </div>
                      </div>
                      <RowActionButtons id={e.id} label={e.school} actions={eduActions} />
                    </div>
                  ))}
                </>
              )}
            </ProfileTimelineSection>
          </div>

        {/* メディア掲載（★実績・受賞とは別。職歴に属さないので独立カードのまま）
            ⚠️ 4-2 で「実績・受賞」カードは廃止し、数値実績と受賞歴は職歴カードへ移した。
               メディア掲載は個人としての登壇・寄稿・退職後の取材があり、
               在籍先に紐づけられないのでここに残す。 */}
          <div style={{ maxWidth: 680 }}>
            {/* ⚠️ 見出しは EditableSection が描く。子は hideHeading で止める（二重にしない） */}
            <EditableSection
              title="メディア掲載"
              description="取材・インタビュー・記事掲載・登壇などを登録できます。"
              isEditing={editingMedia}
              onStartEdit={() => { setEditingMediaId(null); setEditingMedia(true); setMediaAddNonce((n) => n + 1); }}
              action="add"
              actionLabel="メディア掲載を追加"
              /* ★表示モードは枠も見出しも公開部品が持つ（2-2 と同じ）。
                    ここで描くと枠・見出し・「追加」がすべて二重になる。 */
              chrome="none"
              editContent={
                <MediaAppearanceEditor
                  mediaAppearances={mediaAppearances}
                  setMediaAppearances={setMediaAppearances}
                  hideHeading
                  openAddNonce={mediaAddNonce}
                  openEditId={editingMediaId}
                  openDeleteId={deleteMediaId}
                  /* ★フォームを閉じたらカードごと表示モードへ戻す。
                        戻さないと「直した行が消えたように見える」（2-2 で踏んだ形）。 */
                  onClosed={() => { setEditingMediaId(null); setDeleteMediaId(null); setEditingMedia(false); }}
                />
              }
            >
              {/* ★表示は公開プロフィールと同じ部品。行の鉛筆・ゴミ箱・見出しの「追加」だけ足す */}
              <ProfileMediaSection
                mediaAppearances={mediaAppearances}
                actions={{
                  onEditRow: (id) => { setEditingMediaId(id); setEditingMedia(true); },
                  onDeleteRow: (id) => { setDeleteMediaId(id); setEditingMedia(true); },
                  onAdd: () => { setEditingMediaId(null); setEditingMedia(true); setMediaAddNonce((n) => n + 1); },
                }}
              />
            </EditableSection>
          </div>

        {/* ⚠️ 「SNS・外部リンク」カードは 2-7 で**廃止**した（2026-08-16）。
               SNS はヘッダーの中だけに出す。カードを戻すとアイコン列が2箇所になる
               （2-1 で報告した重複がこれで解消した）。編集はヘッダーの鉛筆から。 */}

        {/* 発信コンテンツ（SNS・発信タブ内） */}
          <div style={{ maxWidth: 680 }}>
            {/* ⚠️ 色付きバナーにしない（2026-08-15）。カードの desc に混ぜて1行にする。
                   1画面に色付きバナーを2つ以上出さない。 */}
            <EditableSection
              title="発信コンテンツ"
              description="note・Zenn・YouTube・Speaker Deck・GitHub など、外部で発信しているコンテンツのURLを登録できます。繋ぐと、あなたの考え方が企業に伝わり、価値観マッチが起きやすくなります。"
              isEditing={editingContent}
              /* ⚠️ 見出しの＋は「追加」。行編集が開いたままだと追加フォームが出ないので閉じる */
              onStartEdit={() => { cancelEditLink(); setEditingContent(true); }}
              action="add"
              actionLabel="発信コンテンツを追加"
              /* ★表示モードは枠も見出しも公開部品が持つ（2026-08-16）。
                    ここで描くと**枠・見出し・「追加」がすべて二重**になる（実測で確認）。 */
              chrome="none"
              editContent={<>
              {/* ★編集モードは**フォームだけ**（2026-08-16）。行の一覧は出さない。
                     一覧（と行の鉛筆・ゴミ箱）は表示モードの
                     `ProfileContentLinksSection` が持つ。ここに戻さないこと。
                  ⚠️ 行の鉛筆から来たときは、その行のフォームだけを出す。 */}
              {editingLinkId !== null && (() => {
                const link = contentLinks.find((l) => l.id === editingLinkId);
                if (!link) return null;
                return (
                  /* ★key に id を付けて、開くたびに保存済みの行から作り直す
                        （閉じるとアンマウントされるため。ルール⑦） */
                  <ContentLinkForm
                    key={link.id}
                    heading="このコンテンツを編集"
                    initial={draftFromLink(link)}
                    submitLabel="保存"
                    saving={linkSaving}
                    error={linkError}
                    onSubmit={(draft) => { void handleUpdateContentLink(link.id, draft); }}
                    onCancel={cancelEditLink}
                  />
                );
              })()}


              {/* 新規追加フォーム。
                  ⚠️ 行を編集している間は出さない（編集対象は常に1つ。入力欄が2組並ばない） */}
              {editingLinkId === null && (
                <ContentLinkForm
                  key={addFormNonce}
                  heading="新しいコンテンツを追加"
                  initial={EMPTY_LINK_DRAFT}
                  submitLabel="追加する"
                  saving={linkSaving}
                  error={linkError}
                  onSubmit={(draft) => { void handleAddContentLink(draft); }}
                />
              )}
              {/* ⚠️ 「追加する」を押した時点で保存される。完了は出口だけ（API を呼ばない）。
                     行編集の出口は行内のキャンセル／保存なので、ここは追加の話しかしない。 */}
              <CardDoneFooter
                onDone={() => { cancelEditLink(); setEditingContent(false); }}
                note="追加した時点で保存されます"
              />
              </>}
            >
              {/* ★表示は**公開プロフィールと同じ部品**（2026-08-16）。
                     行の鉛筆・ゴミ箱・見出しの「追加」だけを `actions` で足す。
                  ⚠️ 0件の空状態も部品側が持っている（`viewerIsOwner` の例外）。
                     `/mypage` 独自の1行を足すと**同じ場所への入口が2つ**になる（ルール⑧）。 */}
              <ProfileContentLinksSection
                contentLinks={contentLinks}
                viewerIsOwner
                actions={{
                  onEditRow: (id) => { startEditLink(id); setEditingContent(true); },
                  onDeleteRow: (id) => { void handleDeleteContentLink(id); },
                  onAdd: () => { cancelEditLink(); setEditingContent(true); },
                }}
              />
            </EditableSection>
          </div>
    </>
  );
}
