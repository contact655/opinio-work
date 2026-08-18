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
import MergedTimeline, { limitCareersForDisplay } from "@/components/profile/MergedTimeline";
import { stintsToCareerEntries } from "./careerTimeline";
import { SectionShowAll, SectionAddCircle, PencilIcon } from "@/components/profile/view/RowActions";
import { ROWS_ON_PROFILE } from "@/lib/constants/profileSections";
import { ProfileEditModal } from "./ProfileEditModal";
import CareerIntentBox, { type IntentPrefs } from "./CareerIntentBox";
import { CollapsibleRow } from "./formKit";
import { calcTotalExperience, formatYmLabel } from "@/lib/profile/tenure";
import { ContentLinksEditor, type ContentLink } from "./ContentLinksEditor";
import { buildFutureData } from "@/lib/utils/timeline";
import { ProfileHeader } from "@/components/profile/view/ProfileHeader";
import {
  toTimelineEducationEntries,
  type RawEducation, type CompanyLogoInfo,
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

/* ⚠️ `ContentLink` 型・`PLATFORM_OPTIONS`・`detectPlatform` は 2026-08-17 に
      `ContentLinksEditor.tsx` へ移した（一覧ページと共有するため）。ここに戻さない。 */
type BasicInfo = {
  name: string;
  /** 肩書き1行（40字）。⚠️ 上限は DB の CHECK と API と UI の3つに置く */
  headline: string;
  location: string;
  aboutMe: string;
};

/** 肩書きの上限。⚠️ DB の CHECK（`ow_users_headline_length`）と同じ値にすること。 */
const HEADLINE_MAX = 40;

/* ⚠️ `CollapsibleRow` は 2026-08-17 に `formKit.tsx` へ移した
      （転職の希望のモーダルでも使うため）。ここに書き戻さない。 */


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
            /* ★767px 以下は縦積み（アイコン＋ラベルの行 → 全幅の入力欄）。
                  横並びのままだと入力欄が 157px しか残らず、**URL の末尾しか見えない**。
                  デスクトップの横並びは変えない（`.sns-row` / `.sns-input` の CSS で出し分け）。 */
            <div
              key={platform}
              className="sns-row"
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
                className="sns-input"
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


/* ⚠️ 入力フォーム（`LinkDraft` / `ContentLinkForm`）も 2026-08-17 に
      `ContentLinksEditor.tsx` へ移した。ここに書き戻さない。 */

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
  /* ── ★ヘッダー下の「転職の希望」ボックス（2026-08-17 / フェーズ4-2）────────── */
  initialScoutEnabled = null,
  initialIntentPrefs,
  desiredRoleOptions,
  onVisibilitySaved,
  followCounts,
  openBasicNonce = 0, openHeaderNonce = 0,
  openCareerNonce = 0,
}: {
  owUser: OwUser;
  /* ── 外からカードを開く合図。0 のときは何もしない ────────────────────
        ⚠️ 値が**変わるたび**に開く。真偽値にしないこと（2回目が効かなくなる）。 */
  /** ★職歴の表示を組み直すための企業ロゴ情報（2026-08-16 / 2-6） */
  companyLogoInfo?: ({ id: string } & CompanyLogoInfo)[];
  /** スカウトを受け取るか。`null` は未選択 */
  initialScoutEnabled?: boolean | null;
  /** 希望条件。**ボックスのモーダルが編集する** */
  initialIntentPrefs?: IntentPrefs;
  /** 希望職種の候補（IT/SaaS で絞ったもの） */
  desiredRoleOptions?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  /** 公開範囲が保存できたら親へ返す（写真カードのプレビューが見る） */
  onVisibilitySaved?: (v: "public" | "login_only" | "private") => void;
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
  // ── 発信コンテンツ（編集は `ContentLinksEditor` が持つ。2026-08-17）──────────
  const [contentLinks, setContentLinks] = useState<ContentLink[]>(initialContentLinks);
  /** 見出しの「追加」から開く合図。行の編集・削除は一覧ページの仕事 */
  const [contentAddNonce, setContentAddNonce] = useState(0);

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
  /* ⚠️ `editingCareerSection` は 2026-08-17 に削除した。
        職歴セクションは**0件でも常に描かれる**ので、「追加のために開いている状態」が要らなくなった。 */
  /* `Stint`（編集用）→ `CareerEntry`（表示用）。`/u/[id]` と同じ関数を通す。
     ⚠️ 新しく選んだ企業のロゴは `companyLogoInfo` に無い。頭文字＋既定色に落ちるだけで
        再読み込みすれば正しく出る（`CompanyLogoIcon` が logo_url null を扱える）。 */
  const timelineCareers = useMemo(
    () => stintsToCareerEntries(careerStints, companyLogoInfo, roles),
    [careerStints, companyLogoInfo, roles],
  );
  /* ★本体に出す職歴は**表示単位で4つまで**（2026-08-17 / フェーズ3）。
        同じ会社の複数の役割は1つのまとまりとして数える。
     ⚠️ 切るのは `MergedTimeline` と同じ並べ替えを通したあと。 */
  /* ★社会人経験年数。**保存済みの職歴から毎回その場で計算する**（列は読まない）。
        ⚠️ `careerStints` を見る（`initialExperiences` ではなく）。
           職歴を足したら再読み込みなしで追随する。 */
  const oldestCareerStart = useMemo(() => {
    const starts = careerStints.map((e) => e.startedAt).filter(Boolean);
    return starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  }, [careerStints]);
  const totalExperience = useMemo(
    () => calcTotalExperience(careerStints.map((e) => e.startedAt)),
    [careerStints],
  );
  const shownCareers = useMemo(
    () => limitCareersForDisplay(timelineCareers, ROWS_ON_PROFILE.experience),
    [timelineCareers],
  );
  const [eduAddNonce, setEduAddNonce] = useState(0);
  /* 学歴（2026-08-16 / 2-5）。行の鉛筆・ゴミ箱から編集フォームを開くための id */
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [deleteEduId,  setDeleteEduId]  = useState<string | null>(null);
  /* ★本体に出す行数の上限（2026-08-17 / フェーズ3）。
        ⚠️ この4つは `sort_order` で並べて取得しており、**その順がそのまま表示順**。
           だから先頭から切ってよい（職歴・学歴のように日付で並べ替え直す必要が無い）。
        ⚠️ 「すべて表示」の判定は**画面に出した数と保存されている数の差**で出す。
           4つとも全行が表示に載るので件数比較でも同じ結果になるが、
           職歴・学歴と**同じ書き方に揃える**（片方だけ違う形にしない）。 */
  const shownAchievements = achievements.slice(0, ROWS_ON_PROFILE.achievements);
  const shownAwards       = awards.slice(0, ROWS_ON_PROFILE.awards);
  const shownMedia        = mediaAppearances.slice(0, ROWS_ON_PROFILE.media);
  const shownContent      = contentLinks.slice(0, ROWS_ON_PROFILE.content);

  /* ★本体に出す学歴は**新しい順に4件まで**（2026-08-17 / フェーズ3）。
        残りと、年表に載らない行（入学年月なし）は `/mypage/details/education` が持つ。
     ⚠️ 「すべて表示」の判定は**画面に出した数と保存されている数の差**で出す。
        件数だけで比べると、年表に落ちた行があるときに「4件だから出さない」のに
        1件見えていない状態が作れる。 */
  const shownEducations = toTimelineEducationEntries(educations as RawEducation[])
    /* ⚠️ **新しい順に並べてから切る。** 元の並びは `sort_order`（古い順に入っていることが多い）で、
          そのまま切ると**いちばん新しい学歴が本体から消える**（実測で踏んだ）。
          年表は内部で新しい順に並べ替えるので、切る前の順序は年表の見た目に出てこない。 */
    .slice()
    .sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at))
    .slice(0, ROWS_ON_PROFILE.education);
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

  const [editingAchId, setEditingAchId] = useState<string | null>(null);
  const [deleteAchId, setDeleteAchId] = useState<string | null>(null);
  const [achAddNonce, setAchAddNonce] = useState(0);
  const [editingAwdId, setEditingAwdId] = useState<string | null>(null);
  const [deleteAwdId, setDeleteAwdId] = useState<string | null>(null);
  const [awdAddNonce, setAwdAddNonce] = useState(0);
  /* メディア掲載: 編集はモーダル（2026-08-17 / フェーズ2）。行の鉛筆から来たときは id を持つ */
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
  /* ⚠️ カードの ref は 2026-08-17 に外した（スクロールしなくなったため）。
        `#about` / `#career` などのアンカーは残っている（ページ内ナビが使う）。 */

  /* ⚠️ 促しの行き先は 2-7 で変わった。自己紹介はヘッダーから独立セクションへ移り、
        SNS はヘッダーの中に入った（SNS カードは廃止）。 */
  /* ⚠️ **スクロールはしない**（2026-08-17）。編集がすべてモーダルになり、
        画面中央に出るようになったため。`scrollAfterPaint` は参照0になったので消した。
        背景はモーダルが `overflow:hidden` で固定するので、動かしても見えない。 */
  useEffect(() => {
    if (!openBasicNonce) return;
    setEditingAbout(true);
  }, [openBasicNonce]);
  useEffect(() => {
    if (!openHeaderNonce) return;
    setHeaderFocusSns(false);
    setEditingHeader(true);
  }, [openHeaderNonce]);
  useEffect(() => {
    if (!openCareerNonce) return;
    setCareerAddNonce((n) => n + 1);
  }, [openCareerNonce]);

  /** ★SNS の促しから開いたか。true のときヘッダーのモーダルで SNS の行を開く */
  const [headerFocusSns, setHeaderFocusSns] = useState(false);
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

  /* ── ★空のセクションは出さない（2026-08-16）─────────────────────────────
        `/u/[id]` は0件のセクションを出さない。`/mypage` だけが7枚の空カードを積んでいて、
        **入力が1つも無い人がいちばん長いスクロール**になっていた（4.2画面）。
        「本人には出す（そこからしか追加できない）」の役目は
        一番下の「セクションを追加」が引き継ぐ。

     ⚠️ ヘッダー（写真・名前・SNS）は**対象外**。0件という概念が無く、
        プロフィールの本体そのものなので常に出す。
     ⚠️ 「目指す姿・ありたい未来」は職歴カードの中にあるので、**職歴が0件でも
        本文があればカードを出す**。無ければ一覧から選んで開く。 */
  const hasAbout = !!initialBasicInfo.aboutMe?.trim();
  /* ⚠️ `hasFutureText` は参照0になった（2026-08-17）。職歴セクションが常時出るので、
        「目指す姿があるからカードを出す」という判定が不要になった。 */

  /* ⚠️ **職歴・学歴・目指す姿は候補に入れない**（2026-08-17）。
        職歴と学歴は0件でも枠が出るようになり、目指す姿はその職歴セクションの中に
        CTA（「✦ 目指す姿を書いてみる」）が常に出る。
        候補にも出すと**同じ操作への入口が2つ**になる（ルール⑧）。 */
  type SectionKey = "about" | "achievements" | "awards" | "media" | "content";
  /** 未入力のセクションだけを並べる。★入力済みは本文に出ているので一覧に入れない（二重になる） */
  const emptySections = ([
    { key: "about",        label: "自己紹介",        open: () => setEditingAbout(true) },
    { key: "achievements", label: "数値実績",        open: () => { setEditingAchId(null); setAchAddNonce((n) => n + 1); } },
    { key: "awards",       label: "受賞・表彰",      open: () => { setEditingAwdId(null); setAwdAddNonce((n) => n + 1); } },
    { key: "media",        label: "メディア掲載",    open: () => { setEditingMediaId(null); setMediaAddNonce((n) => n + 1); } },
    { key: "content",      label: "発信コンテンツ",  open: () => setContentAddNonce((n) => n + 1) },
  ] as { key: SectionKey; label: string; open: () => void }[]).filter((sec) => {
    switch (sec.key) {
      case "about":        return !hasAbout;
      case "achievements": return achievements.length === 0;
      case "awards":       return awards.length === 0;
      case "media":        return mediaAppearances.length === 0;
      case "content":      return contentLinks.length === 0;
    }
  });
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);

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
        {/* ── ★アクション行（2026-08-17 / フェーズ4-3）──────────────────────
               タブバーを畳んだので、ページの操作はこの1行にまとめる。
            ⚠️ 「公開プロフィールを見る」は**この1つだけ**。幅で出し分けない。 */}
        <div style={{
          maxWidth: 680, display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 8, marginBottom: 12, flexWrap: "wrap",
        }}>
          {emptySections.length > 0 && (
            <button
              type="button"
              className="tap-min-h"
              onClick={() => setSectionPickerOpen((v) => !v)}
              aria-expanded={sectionPickerOpen}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 8,
                border: "1px dashed var(--line)", background: "#fff",
                fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              セクションを追加
            </button>
          )}
          {owUser?.id && (
            <a
              href={`/u/${owUser.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="公開プロフィールを見る（新しいタブで開く）"
              title="公開プロフィールを見る"
              className="tap-min-h"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 8,
                border: "1px solid var(--line)", background: "#fff",
                fontSize: 12, fontWeight: 700, color: "var(--royal)",
                textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              公開プロフィールを見る
            </a>
          )}
        </div>

        {/* 「セクションを追加」を押したときの一覧。★アクション行のすぐ下に出す */}
        {sectionPickerOpen && emptySections.length > 0 && (
          <div style={{ maxWidth: 680, marginBottom: 16 }}>
<section style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "20px 24px",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>セクションを追加</span>
                    <button
                      type="button" className="tap-target"
                      onClick={() => setSectionPickerOpen(false)}
                      aria-label="閉じる" title="閉じる"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 18, lineHeight: 1, padding: 4, fontFamily: "inherit" }}
                    >×</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {emptySections.map((sec) => (
                      <button
                        key={sec.key}
                        type="button"
                        className="tap-min-h"
                        onClick={() => { sec.open(); setSectionPickerOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "12px 14px", textAlign: "left",
                          background: "var(--bg-tint)", border: "1px solid var(--line)",
                          borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                          fontSize: 14, fontWeight: 600, color: "var(--ink)",
                        }}
                      >
                        <span style={{ fontSize: 15, lineHeight: 1, color: "var(--royal)" }}>+</span>
                        {sec.label}
                      </button>
                    ))}
                  </div>
                </section>
          </div>
        )}

        {/* ── ヘッダー（2026-08-16 / 2-7）──────────────────────────────────
               ★`UserProfileCard` / 「プロフィール画像・カバー」/「基本情報」の3枚を
                 1つにまとめ、**公開プロフィールと同じ `ProfileHeader`** を使う。
               ⚠️ 自己紹介はここから外し、独立セクション（`#about`）に移した。
                  `/u/[id]` がそうなっているので構造を合わせる。
               ⚠️ 現職・年齢は導出値なので鉛筆の対象外。 */}
          <div style={{ maxWidth: 680 }}>
            {/* ★編集はモーダル（2026-08-17 / フェーズ2の最後）。
                   ⚠️ **保存は今までと同じ1回の PUT**（名前・肩書き・所在地・生年月日・SNS）。
                      器を変えただけで、送る中身も呼び方も変えていない。 */}
            <ProfileEditModal
              open={editingHeader}
              title="プロフィール"
              dirty={isHeaderDirty}
              saving={basicSaving || socialSaving}
              justSaved={basicJustSaved}
              error={null}
              onSave={handleSaveHeader}
              onClose={() => { handleCancelBasic(); handleCancelSocial(); setEditingHeader(false); }}
            >
                {/* ★写真・カバーは既定で閉じる（2026-08-16）。375px で **380px** を占めていて、
                       名前を1文字直すだけでもここを越えないと保存ボタンに届かなかった。
                    ⚠️ 行の右に「設定済み / 未設定」を出す。閉じていても状態は分かるようにする。 */}
                <CollapsibleRow
                  first
                  label="写真・カバー"
                  /* ⚠️ 375px で2行に折り返さない長さにする（「プロフィール画像・カバー写真」＋
                        「画像なし・カバーなし」は両方とも折り返していた） */
                  state={
                    savedAvatarUrl && savedCoverPhotoUrl ? "設定済み"
                    : savedAvatarUrl ? "画像のみ"
                    : savedCoverPhotoUrl ? "カバーのみ"
                    : "未設定"
                  }
                >
                  <ProfilePhotoUploader
                    owUser={owUser}
                    basicInfoName={basicInfo.name}
                    settings={settings}
                    onAvatarSaved={setSavedAvatarUrl}
                    onCoverSaved={setSavedCoverPhotoUrl}
                    savedAvatarUrl={savedAvatarUrl}
                    savedCoverPhotoUrl={savedCoverPhotoUrl}
                  />
                </CollapsibleRow>
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
                {/* ★SNS 7欄も既定で閉じる。375px で **430px**（欄388px＋注記）を占めていた。
                    ⚠️ **入力済みの件数を行に出す。** 閉じているせいで
                       「入っていない」と誤解されないようにする。 */}
                <CollapsibleRow
                  /* ★SNS の促しから開いたときだけ開いた状態にする（2026-08-17） */
                  defaultOpen={headerFocusSns}
                  label="SNS・外部リンク"
                  state={(() => {
                    const n = Object.values(socialLinks).filter((v) => v && v.trim()).length;
                    return n > 0 ? `${n}件` : "未設定";
                  })()}
                >
                  <SocialLinksEditor socialLinks={socialLinks} setSocialLinks={setSocialLinks} />
                </CollapsibleRow>
            </ProfileEditModal>

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
                      {/* ★押した人は「SNS を足したい」ので、**SNS の行を開いた状態で**モーダルを出す
                             （2026-08-17 に実測して直した。畳んだまま開くと、
                             押したのに何も起きていないように見える）。 */}
                      <button type="button" onClick={() => { setHeaderFocusSns(true); setEditingHeader(true); }} style={promoBtn}>追加する →</button>
                    </p>
                  )}
                </>}
                topRight={
                  <button
                    type="button"
                    onClick={() => { setHeaderFocusSns(false); setEditingHeader(true); }}
                    aria-label="プロフィールを編集"
                    title="プロフィールを編集"
                    /* ⚠️ 767px 以下では高さを 44px にする（既定は 40px） */
                    className="tap-min-h"
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

            {basicToastMsg && (
              <Toast message={basicToastMsg} variant={basicToastVariant} onDone={() => setBasicToastMsg(null)} />
            )}
            {socialToastMsg && (
              <Toast message={socialToastMsg} variant={socialToastVariant} onDone={() => setSocialToastMsg(null)} />
            )}
          </div>

          {/* ── ★転職の希望（ヘッダーの直下・2026-08-17 / フェーズ4-2）──────────
                 公開範囲 / スカウト設定 / 転職検討状況 の**現在値**を要約で出し、
                 ✎ で7項目のモーダルを開く。
              ⚠️ タブ「転職の希望」「設定」はフェーズ4-3 で畳む。それまでは
                 同じ列を触る画面が2つある（意図的な過渡状態）。 */}
          {initialIntentPrefs && (
            <CareerIntentBox
              initialVisibility={settings.visibility}
              initialIsOpenToWork={settings.isOpenToWork}
              initialScoutEnabled={initialScoutEnabled}
              initialPrefs={initialIntentPrefs}
              roles={roles}
              roleAliases={roleAliases}
              desiredRoleOptions={desiredRoleOptions}
              onVisibilityChange={onVisibilitySaved}
            />
          )}

          {/* ── 自己紹介（#about）──────────────────────────────────────────
                 ★ヘッダーから外して独立セクションにした（2026-08-16 / 2-7）。
                 `/u/[id]` と同じ位置・同じ見た目。 */}
          {/* ★0件のセクションはカードごと出さない（2026-08-16）。
                 入力が1つも無い人がいちばん長いスクロールを強いられていたため
                 （空カード7枚で 4.2画面）。追加の入口は一番下の「セクションを追加」。
              ⚠️ **編集中は必ず出す。** 出さないとフォームごと消えて追加できない。 */}
          {/* ★自己紹介（2026-08-17 / モーダル化の1枚目）。
                 **本文は常に表示のまま。編集はモーダルで開く。**
                 カードがフォームに化ける形をやめたので、押した場所と入力欄がずれない。 */}
          {hasAbout && (
          <div style={{ maxWidth: 680 }}>
            <ProfileAboutSection
              aboutMe={initialBasicInfo.aboutMe || null}
              viewerIsOwner
              onEdit={() => setEditingAbout(true)}
            />
          </div>
          )}

          <ProfileEditModal
            open={editingAbout}
            title="自己紹介"
            dirty={basicInfo.aboutMe !== initialBasicInfo.aboutMe}
            saving={aboutSaving}
            justSaved={aboutJustSaved}
            error={null}
            onSave={handleSaveAbout}
            /* ⚠️ 閉じるときは入力を保存済みの値へ戻す。未保存があるときは
                  モーダル側が破棄の確認を出すので、ここは戻すだけでよい。 */
            onClose={() => { setBasicInfo((prev) => ({ ...prev, aboutMe: initialBasicInfo.aboutMe })); setEditingAbout(false); }}
          >
            {/* ★説明文はモーダルの中だけに置く（カードには出さない） */}
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
          </ProfileEditModal>

        {/* ★数値実績 / 受賞・表彰（2026-08-16 / 2-4）。
               公開プロフィールと同じ**独立した2セクション**。並び順も `/u/[id]` に合わせ、
               自己紹介（基本情報）の直後・職歴の前に置く。
            ⚠️ 職歴カードの中に入れ子で戻さないこと。紐づけはフォームのセレクトで選ぶ。 */}
          <div style={{ maxWidth: 680 }}>
            {achievements.length > 0 && (
              <ProfileAchievementsSection
                achievements={shownAchievements}
                actions={{
                  manageHref: "/mypage/details/achievements",
                  manageLabel: "数値実績を編集",
                  onAdd: () => { setEditingAchId(null); setAchAddNonce((n) => n + 1); },
                }}
                showAll={{ href: "/mypage/details/achievements", label: "数値実績", hiddenCount: achievements.length - shownAchievements.length }}
              />
            )}
            {/* ★編集フォーム・削除確認の置き場。**常にマウントしておく**（モーダルなので何も描かない）。
                   ⚠️ 閉じたら id を null に戻すこと。同じ行を続けて2回開くために要る。 */}
            <AchievementEditor
              achievements={achievements}
              setAchievements={setAchievements}
              openAddNonce={achAddNonce}
              openEditId={editingAchId}
              openDeleteId={deleteAchId}
              experienceOptions={experienceOptions}
              onClosed={() => { setEditingAchId(null); setDeleteAchId(null); }}
            />

            {awards.length > 0 && (
              <ProfileAwardsSection
                awards={shownAwards}
                actions={{
                  manageHref: "/mypage/details/awards",
                  manageLabel: "受賞・表彰を編集",
                  onAdd: () => { setEditingAwdId(null); setAwdAddNonce((n) => n + 1); },
                }}
                showAll={{ href: "/mypage/details/awards", label: "受賞・表彰", hiddenCount: awards.length - shownAwards.length }}
              />
            )}
            <AwardEditor
              awards={awards}
              setAwards={setAwards}
              openAddNonce={awdAddNonce}
              openEditId={editingAwdId}
              openDeleteId={deleteAwdId}
              experienceOptions={experienceOptions}
              onClosed={() => { setEditingAwdId(null); setDeleteAwdId(null); }}
            />
          </div>

        {/* 職歴・学歴タブ */}
          <div style={{ maxWidth: 680 }}>

            {/* ★枠と見出しは公開プロフィールと同じ部品（2026-08-16 / 2-6）。
                   `EditableSection` はやめた。`/u/[id]` の「職歴」「学歴」の見出しは
                   元から `page.tsx` にあり、**切り出していなかっただけ**だった。
                   ★このカードに「編集モード」は無い。編集も追加も**モーダル**なので、
                   `CareerHistoryEditor` は常に描いておく。アンマウントすると
                   `careerStints` の控えが初期値へ巻き戻る。 */}
            {/* ★職歴と学歴は**0件でも枠を出す**（2026-08-17）。
                   キャリアの土台なので、空でも「ここに入る」と分かる場所を残す。
                   他の5つ（自己紹介・数値実績・受賞・メディア掲載・発信コンテンツ）は
                   いまどおり「セクションを追加」に集約する。
                ⚠️ **0件のときは ✎ を出さない。** 一覧ページに送っても空の画面に着くだけ。
                   1件でも入れば ＋ と ✎ の2つに戻る。 */}
            <ProfileTimelineSection
              id="career"
              title="職歴"
              onAdd={() => setCareerAddNonce((n) => n + 1)}
              addLabel="職歴を追加"
              /* ★行ごとの操作は一覧ページへ（2026-08-17 / フェーズ3） */
              manageHref={careerStints.length > 0 ? "/mypage/details/experience" : undefined}
              manageLabel="職歴を編集"
              /* ★0件のときは鉛筆1つにする（記号を「転職の希望」ボックスと揃える） */
              emptyUsesPencil={careerStints.length === 0}
            >
              {/* ★社会人経験年数（2026-08-17 / フェーズ4-3）。
                     「転職の希望」タブにあった6枚目のカードを、職歴の見出しの下に1行で移した。
                  ⚠️ **`ow_profiles.experience_years` は読んでいない。** あの列は
                     2026-08-07 に入力欄を廃止したまま残っている死蔵の列（49件中6件に値。読み手0）。
                     ここに出すのは**職歴の最も古い開始日からその場で計算した値**。
                  ⚠️ 職歴が0件なら `calcTotalExperience` が null を返すので出さない
                     （「0年」と出さない。CLAUDE.md「データ表示の原則」）。
                  ⚠️ `/u/[id]` には出さない。**`ProfileTimelineSection` の children は
                     `/mypage` だけが渡す**ので、公開側の DOM は変わらない。 */}
              {totalExperience && (
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                  社会人経験
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "0 4px" }}>
                    {totalExperience.label}
                  </span>
                  （{formatYmLabel(oldestCareerStart)} から）
                </p>
              )}
              {/* ⚠️ 文中リンク（「職歴を追加する」）はやめた（2026-08-17）。
                     読む文と押す物が同じ行に並んで区別しにくかった。
                     **追加はカードの下の丸い ＋** に寄せる。 */}
              {careerStints.length === 0 && (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                  まだ職歴を登録していません。
                </p>
              )}
              {/* ⚠️ 職歴が0件でも描く。**「将来やりたいこと」がこの中にある**ため
                     （`MergedTimeline` は future が無ければ何も描かずに null を返す）。 */}
              {(
                /* ★表示は公開プロフィールと同じ部品。**行の操作は渡さない**（2026-08-17 / フェーズ3）。
                      1件ずつ触るのは `/mypage/details/experience` の仕事。
                   ⚠️ `collapseAfter` は渡さない。あれは「その場で開く」畳み方で、
                      ここは**一覧ページへ送る**畳み方にする。 */
                <MergedTimeline
                  careers={shownCareers.careers}
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
                />
              )}
              {careerStints.length === 0 && (
                <SectionAddCircle label="職歴を追加" onClick={() => setCareerAddNonce((n) => n + 1)} />
              )}
              {shownCareers.hiddenUnits > 0 && (
                <SectionShowAll
                  href="/mypage/details/experience"
                  label="職歴"
                  hiddenCount={shownCareers.hiddenUnits}
                />
              )}
            </ProfileTimelineSection>
            {/* ★モーダルと削除確認だけ。一覧は上の `MergedTimeline` が持つ（2-6）。
                   ⚠️ **セクションの外に出して常にマウントする**（2026-08-17）。
                      中に置くと、職歴0件のときは**この部品ごと描かれていない**ので、
                      「セクションを追加 → 職歴」で nonce を上げても受け手がいない
                      （マウントと同時に届いた nonce は初期値として飲み込まれる）。 */}
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

            {/* ★2-5 では枠と見出しを `EditableSection` に持たせていたが、**判断が誤っていた**。
                   `/u/[id]` の「学歴」の見出しは元からあり、`page.tsx` に直接書かれていた
                   （＝切り出していなかっただけ）。2-6 で職歴とまとめて切り出して揃えた。 */}
            {/* ★学歴も 0件で枠を出す（職歴と同じ理由）。✎ は1件以上のときだけ。 */}
            <ProfileTimelineSection
              id="education"
              title="学歴"
              onAdd={() => { setEditingEduId(null); setEduAddNonce((n) => n + 1); }}
              addLabel="学歴を追加"
              /* ★行ごとの鉛筆・ゴミ箱は本体から外し、一覧ページに寄せた（2026-08-17 / フェーズ3） */
              manageHref={educations.length > 0 ? "/mypage/details/education" : undefined}
              manageLabel="学歴を編集"
              emptyUsesPencil={educations.length === 0}
            >
              {educations.length === 0 ? (
                <>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                    まだ学歴を登録していません。
                  </p>
                  <SectionAddCircle label="学歴を追加" onClick={() => { setEditingEduId(null); setEduAddNonce((n) => n + 1); }} />
                </>
              ) : (
                <>
                  {/* ★表示は公開プロフィールと同じ部品。**行の操作は渡さない**（2026-08-17 / フェーズ3）。
                         1件ずつ触るのは `/mypage/details/education` の仕事。 */}
                  <MergedTimeline
                    careers={[]}
                    educations={shownEducations}
                    future={null}
                    /* ⚠️ `birthDate` を渡す。渡さないと年マーカーに年齢が出ず、
                          `/u/[id]` の学歴（「2014 19歳」）と食い違う（2026-08-16 の通しで発見） */
                    birthDate={owUser?.birth_date}
                  />
                  {/* ⚠️ 入学年月が無い行・N件を超えた行はここには出ない。
                         **拾うのは `/mypage/details/education`**（下の「すべて表示」から行ける）。
                         ここに戻すと本体が一覧ページと同じものになる。 */}
                  {educations.length > shownEducations.length && (
                    <SectionShowAll
                      href="/mypage/details/education"
                      label="学歴"
                      hiddenCount={educations.length - shownEducations.length}
                    />
                  )}
                </>
              )}
            </ProfileTimelineSection>
            {/* ★編集フォーム・削除確認の置き場。**常にマウントしておく**（モーダル）。
                   学校マスタへの追加リクエストのバナーもこの中から出る。 */}
            <EducationEditor
              educations={educations}
              setEducations={setEducations}
              schools={schools}
              openAddNonce={eduAddNonce}
              openEditId={editingEduId}
              openDeleteId={deleteEduId}
              onClosed={() => { setEditingEduId(null); setDeleteEduId(null); }}
            />
          </div>

        {/* メディア掲載（★実績・受賞とは別。職歴に属さないので独立カードのまま）
            ⚠️ 4-2 で「実績・受賞」カードは廃止し、数値実績と受賞歴は職歴カードへ移した。
               メディア掲載は個人としての登壇・寄稿・退職後の取材があり、
               在籍先に紐づけられないのでここに残す。 */}
          {mediaAppearances.length > 0 && (
          <div style={{ maxWidth: 680 }}>
            {/* ★表示は公開プロフィールと同じ部品。行の鉛筆・ゴミ箱・見出しの「追加」だけ足す。
                   編集はモーダル（2026-08-17 / フェーズ2）。 */}
            <ProfileMediaSection
              mediaAppearances={shownMedia}
              actions={{
                  manageHref: "/mypage/details/media",
                  manageLabel: "メディア掲載を編集",
                onAdd: () => { setEditingMediaId(null); setMediaAddNonce((n) => n + 1); },
              }}
              showAll={{ href: "/mypage/details/media", label: "メディア掲載", hiddenCount: mediaAppearances.length - shownMedia.length }}
            />
          </div>
          )}
          {/* ★編集フォーム・削除確認の置き場。**常にマウントしておく**。
                 モーダルなので、開いていないあいだは何も描かない。
                 ⚠️ 常設にしたぶん、`openEditId` は**値が変わったときだけ**効く。
                    閉じたら `onClosed` で id を null に戻すこと（同じ行を続けて2回開くため）。 */}
          <MediaAppearanceEditor
            mediaAppearances={mediaAppearances}
            setMediaAppearances={setMediaAppearances}
            openAddNonce={mediaAddNonce}
            openEditId={editingMediaId}
            openDeleteId={deleteMediaId}
            onClosed={() => { setEditingMediaId(null); setDeleteMediaId(null); }}
          />

        {/* ⚠️ 「SNS・外部リンク」カードは 2-7 で**廃止**した（2026-08-16）。
               SNS はヘッダーの中だけに出す。カードを戻すとアイコン列が2箇所になる
               （2-1 で報告した重複がこれで解消した）。編集はヘッダーの鉛筆から。 */}

        {/* 発信コンテンツ（SNS・発信タブ内） */}
          {contentLinks.length > 0 && (
          <div style={{ maxWidth: 680 }}>
            {/* ★表示は**公開プロフィールと同じ部品**。編集はモーダル（2026-08-17 / フェーズ2）。
                   行の鉛筆・ゴミ箱・見出しの「追加」だけを `actions` で足す。 */}
            <ProfileContentLinksSection
              contentLinks={shownContent}
              viewerIsOwner
              actions={{
                  manageHref: "/mypage/details/content",
                  manageLabel: "発信コンテンツを編集",
                onAdd: () => setContentAddNonce((n) => n + 1),
              }}
              showAll={{ href: "/mypage/details/content", label: "発信コンテンツ", hiddenCount: contentLinks.length - shownContent.length }}
            />
          </div>
          )}

          {/* ★編集フォーム・削除確認の置き場。**常にマウントしておく**（モーダル）。
                 本体からは「追加」だけ。行の編集・削除は `/mypage/details/content`。 */}
          <ContentLinksEditor
            contentLinks={contentLinks}
            setContentLinks={setContentLinks}
            openAddNonce={contentAddNonce}
          />

          {/* ⚠️ 「セクションを追加」は 2026-08-17（フェーズ4-3）に**ヘッダーの上のアクション行へ移した**。
                 下端に戻さないこと（空のセクションを出さない作りなので、
                 入力が何も無い人は下端まで進む理由が無い）。 */}

    </>
  );
}
