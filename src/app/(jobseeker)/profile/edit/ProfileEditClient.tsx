"use client";

import { useState, useCallback, useEffect } from "react";
import { PublicProfileLinkCard } from "@/components/profile/PublicProfileLinkCard";
import type { Json } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { MypageMockProvider } from "@/app/(jobseeker)/mypage/_components/MypageMockContext";
import Tabs, { type TabItem } from "./Tabs";
import WishesTab from "./_components/WishesTab";
import SettingsTab from "./_components/SettingsTab";
import ProfileTab, { type ProfileSavedSnapshot } from "./_components/ProfileTab";
/* ⚠️ カード・入力欄の共通部品は formKit に移した（3-B / 2026-08-15）。中身は変えていない。 */
import {
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
import { type Stint } from "@/components/profile/CareerHistoryEditor";
import { hasCareerPreferences } from "@/lib/profile/completion";
import { ProfileCompletionBar, type CompletionInput } from "@/components/profile/ProfileCompletionBar";
import type { SocialPlatform } from "@/components/SocialIcon";

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

/* タブは3枚（2026-08-15 に7枚から再編）。
   ⚠️ 旧7値は `LEGACY_TAB_MAP` で解決する。`?tab=` を持つメールやブックマークが
      既にあるので、旧値で来ても既定タブに落とさない。 */
/* ⚠️ 型名は `ProfileTabKey`。`ProfileTab` はタブの**コンポーネント**（3-B）。 */
type ProfileTabKey = "profile" | "wishes" | "settings";

/** 旧 `?tab=` の値 → 新タブ。**消さないこと。** */
const LEGACY_TAB_MAP: Record<string, ProfileTabKey> = {
  basic: "profile",
  career: "profile",
  certs_achievements: "profile",
  socials_content: "profile",
  preferences: "wishes",
  privacy: "settings",
  account: "settings",
};

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

/* ⚠️ ProfilePhotoUploader は ProfileTab へ移した（3-B）。 */

const PROFILE_TABS: TabItem[] = [
  { key: "profile",  label: "プロフィール" },
  { key: "wishes",   label: "転職の希望" },
  { key: "settings", label: "設定" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/* ⚠️ カードの見た目はここ1箇所。`FormSection` と `Card` が同じ値を共有する。
      片方だけ変えると、同じ画面にサイズ違いのカードが並ぶ。 */
/* ⚠️ メール通知設定（NotificationSettingsSection）は SettingsTab へ移した（3-B）。 */

/* ⚠️ SocialLinksEditor も ProfileTab へ移した（3-B）。 */

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
    desired_prefectures: string[] | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    transfer_timing: string | null;
    desired_phase: string[] | null;
    worry: string | null;
  } | null;
}) {
  const VALID_TABS: ProfileTabKey[] = ["profile", "wishes", "settings"];
  /* ⚠️ 旧値（basic / career / ...）で来ても対応表で解決する。既定に落とさない。 */
  const resolvedInitialTab: ProfileTabKey =
    VALID_TABS.includes(initialTab as ProfileTabKey) ? (initialTab as ProfileTabKey)
    : (initialTab && LEGACY_TAB_MAP[initialTab]) ? LEGACY_TAB_MAP[initialTab]
    : "profile";
  const [activeTab, setActiveTab] = useState<ProfileTabKey>(resolvedInitialTab);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  /* 希望条件は WishesTab が持つ（3-B）。親は**保存済みの結果だけ**を受け取る。
     ⚠️ ここに希望条件の state を戻さないこと。保存の単位はカードで、それはタブ側にある。 */
  const [wishesHasPrefs, setWishesHasPrefs] = useState<boolean>(
    hasCareerPreferences({
      desiredRoleCount:    initialDesiredRoleIds.length,
      desired_work_styles: initialProfilePrefs?.desired_work_styles ?? null,
      desired_prefectures: initialProfilePrefs?.desired_prefectures ?? null,
      desired_salary_min:  initialProfilePrefs?.desired_salary_min ?? null,
      desired_salary_max:  initialProfilePrefs?.desired_salary_max ?? null,
      transfer_timing:     initialProfilePrefs?.transfer_timing ?? null,
      desired_phase:       initialProfilePrefs?.desired_phase ?? null,
      worry:               initialProfilePrefs?.worry ?? null,
    })
  );
  const [wishesDirty, setWishesDirty] = useState(false);

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

  /* 設定タブの state は SettingsTab が持つ（3-B）。親は2つだけ受け取る。
     ⚠️ 既定値の組み立てはここに残す。`owUser` の列と既定色を知っているのは親なので、
        タブ側と両方に書かない。 */
  const initialSettingsForTab: SettingsState = {
    avatarColor:  owUser?.avatar_color  ?? DEFAULT_AVATAR_COLOR,
    coverColor:   owUser?.cover_color   ?? DEFAULT_COVER_COLOR,
    visibility:   (owUser?.visibility ?? "public") as SettingsState["visibility"],
    isOpenToWork: owUser?.is_open_to_work ?? false,
  };
  /* 保存済みの公開設定。右カラムの「企業からの見え方」と、写真カードのプレビューが見る */
  const [savedSettings, setSavedSettings] = useState<SettingsState>(initialSettingsForTab);
  const [settingsDirty, setSettingsDirty] = useState(false);


  // ── スキルタブの状態 ─────────────────────────────────────────────────────

  /* プロフィールタブの state は ProfileTab が持つ（3-B）。
     親が受け取るのは**保存済みのスナップショット**と「未保存があるか」だけ。
     ⚠️ ここに入力中の state を戻さないこと。完成度が保存前に動く形に逆戻りする。 */
  const [profileSaved, setProfileSaved] = useState<ProfileSavedSnapshot>({
    name:      owUser?.name     ?? "",
    headline:  owUser?.headline ?? "",
    aboutMe:   owUser?.about_me ?? "",
    location:  owUser?.location ?? "",
    hasBirthDate: !!owUser?.birth_date,
    avatarUrl: owUser?.avatar_url ?? null,
    experienceCount: initialExperiences.length,
    educationCount:  initialEducations.length,
    certOrAchievementCount: initialAchievements.length + initialAwards.length + initialMediaAppearances.length,
    socialOrContentCount:   initialContentLinks.length + Object.values(initialSocialLinks).filter(Boolean).length,
  });
  const [profileDirty, setProfileDirty] = useState(false);

  /* ── 未保存の変更 ─────────────────────────────────────────────────────────
        ⚠️ 確認を出すのは**ページ離脱のときだけ**。タブ切替では出さない
           （移動しても入力は消えない）。カードごとに扱いを変えないこと。
        ⚠️ 希望条件の内訳はタブ側が持つ。親は「未保存があるか」だけを受け取る。 */

  /* ⚠️ **タブ切替では確認を出さない**（2026-08-15）。移動しても入力は消えないので、
        確認する理由が無い。未保存であることは
        「カードのフッターの表示」と「タブ名の『未保存』印」で伝える。
        確認を出すのはページ離脱のときだけ。あちらは実際に失われる。 */
  const requestTabChange = useCallback((tab: ProfileTabKey) => {
    setActiveTab(tab);
  }, []);

  /* ⚠️ 文言はブラウザが決める（差し替えられない）。出すか出さないかだけを制御する。 */
  const hasDirty = profileDirty || wishesDirty || settingsDirty;
  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirty]);

  // ── タブ完成度（各タブにデータがあれば green dot） ─────────────────────────
  /* ⚠️ **条件をタブ側に書き足さない。** 7枚のときの判定をそのまま OR で束ねるだけにする。
        新しい基準を作ると、完成度の判定と食い違う。 */
  const tabCompletion: Record<ProfileTabKey, boolean> = {
    /* ⚠️ 完成度と同じく**保存済みの値だけ**を見る。入力中の state を混ぜると
          打ち始めた瞬間にドットが点く（保存していないのに「設定済み」に見える）。 */
    profile:
      !!(profileSaved.name.trim() || profileSaved.aboutMe.trim()) ||
      profileSaved.experienceCount > 0 || profileSaved.educationCount > 0 ||
      profileSaved.certOrAchievementCount > 0 || profileSaved.socialOrContentCount > 0,
    wishes:   wishesHasPrefs,
    /* 公開設定・アカウントは既定値で成立しているので、常に「設定済み」。 */
    settings: true,
  };


  /* タブごとの未保存。★「未設定」とは別物。判定はカードの dirty をそのまま束ねるだけ。 */
  const tabDirty: Record<ProfileTabKey, boolean> = {
    profile:  profileDirty,
    wishes:   wishesDirty,
    settings: settingsDirty,
  };

  const profileTabsWithCompletion = PROFILE_TABS.map((tab) => ({
    ...tab,
    completed: tabCompletion[tab.key as ProfileTabKey],
    dirty: tabDirty[tab.key as ProfileTabKey],
  }));

  // ── プロフィール完成度 ───────────────────────────────────────────────────
  // 本文の先頭に置いていたが、タブと入力欄がその分だけ下に押し出されて
  // スクロールしないと見えなかったため、右カラムへ移した（2026-08-07）。
  // ⚠️ 右カラムは 1100px 未満で消える（rightColumnCollapse="hide"）。
  //    その幅では本文側の `.mypage-narrow-only` の控えが出る。
  /* ⚠️ **入力中の state を1つも見ないこと。**（2026-08-15 確立）
        完成度は「保存済みの値」だけから出す。入力欄の state（basicInfo / birth* /
        socialLinks / pref*）を混ぜると、**保存していないのに % が上がる**。
        逆に、読み込み時のプロップ（owUser.avatar_url / initialExperiences /
        initialSocialLinks）を見ると**保存したのに % が動かない**（3項目が実際にそうだった）。

        ここが見てよいのは、次の「保存に成功したときだけ進むもの」に限る。
          profileSaved   … ProfileTab が保存に成功したときだけ送ってくるスナップショット
          wishesHasPrefs … WishesTab が savePrefCard の成功後に送ってくる値 */
  const completionData: CompletionInput = {
    hasName:               !!profileSaved.name && profileSaved.name.trim() !== "" && profileSaved.name !== "ユーザー",
    hasHeadline:           profileSaved.headline.trim().length > 0,
    hasAboutMe:            profileSaved.aboutMe.trim().length > 0,
    hasLocation:           profileSaved.location.trim().length > 0,
    hasBirthDate:          profileSaved.hasBirthDate,
    hasAvatar:             !!profileSaved.avatarUrl,
    experienceCount:       profileSaved.experienceCount,
    educationCount:        profileSaved.educationCount,
    hasPreferences:        wishesHasPrefs,
    certOrAchievementCount: profileSaved.certOrAchievementCount,
    socialOrContentCount:  profileSaved.socialOrContentCount,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ProfileCompletionBar
              data={completionData}
              mode="sidebar"
              onTabChange={(tab) => requestTabChange(tab as ProfileTabKey)}
            />
            {/* ⚠️ 公開範囲に関わらず常設する。文言は設定値から出す（決め打ちしない） */}
            <PublicProfileLinkCard userId={owUser?.id} visibility={savedSettings.visibility} />
          </div>
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
              {/* ⚠️ 「① 基本情報 / ② 職歴」へ飛ぶチップは外した（2026-08-15）。
                     3タブではどちらも「プロフィール」になり、押し分ける意味が無くなったため。 */}
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
            onTabChange={(tab) => requestTabChange(tab as ProfileTabKey)}
          />
          {/* ⚠️ 右カラムが消える幅では、ここが「公開プロフィールを見る」の唯一の導線になる */}
          <div style={{ marginBottom: 16 }}>
            <PublicProfileLinkCard userId={owUser?.id} visibility={savedSettings.visibility} />
          </div>
        </div>

        {/* ── タブナビゲーション ──────────────────────────────────────────────── */}
        <Tabs
          tabs={profileTabsWithCompletion}
          activeTab={activeTab}
          onTabChange={(key) => requestTabChange(key as ProfileTabKey)}
        />

        {/* ── タブコンテンツ ──────────────────────────────────────────────────── */}

        {/* プロフィールタブ（3-B で別ファイルへ切り出し。中身は移しただけ）
            ⚠️ display:none で残す。アンマウントすると未保存の入力がタブ切替で消える。 */}
        <div style={{ display: activeTab === "profile" ? "block" : "none" }}>
          <ProfileTab
            owUser={owUser}
            settings={savedSettings}
            roles={roles}
            roleAliases={roleAliases}
            initialExperiences={initialExperiences}
            initialEducations={initialEducations}
            schools={schools}
            initialAchievements={initialAchievements}
            initialAwards={initialAwards}
            initialMediaAppearances={initialMediaAppearances}
            initialSocialLinks={initialSocialLinks}
            initialContentLinks={initialContentLinks}
            onSavedChange={setProfileSaved}
            onDirtyChange={setProfileDirty}
            notifyGlobalSave={notifyGlobalSave}
          />
        </div>



        {/* 転職の希望タブ（3-B で別ファイルへ切り出し）
            ⚠️ display:none で残す。アンマウントすると未保存の入力がタブ切替で消える。 */}
        <div style={{ display: activeTab === "wishes" ? "block" : "none" }}>
          <WishesTab
            roles={roles}
            roleAliases={roleAliases}
            desiredRoleOptions={desiredRoleOptions}
            initialDesiredRoleIds={initialDesiredRoleIds}
            initialProfilePrefs={initialProfilePrefs}
            initialExperiences={initialExperiences}
            onHasPrefsChange={setWishesHasPrefs}
            onDirtyChange={setWishesDirty}
            notifyGlobalSave={notifyGlobalSave}
          />
        </div>




        {/* アカウント設定タブ（動作） */}
        {/* ══════════════════════════════════════════════════════════════════
            公開設定タブ
        ══════════════════════════════════════════════════════════════════ */}
        {/* 設定タブ（3-B で別ファイルへ切り出し。中身は移しただけ）
            ⚠️ display:none で残す。アンマウントするとメール通知設定の取得が
               タブを開くたびに走り、未保存の公開設定も消える。 */}
        <div style={{ display: activeTab === "settings" ? "block" : "none" }}>
          <SettingsTab
            owUserId={owUser?.id}
            authEmail={authEmail}
            initialSettings={initialSettingsForTab}
            initialScoutEnabled={initialScoutEnabled}
            initialExperiences={initialExperiences}
            onSettingsChange={setSavedSettings}
            onDirtyChange={setSettingsDirty}
            notifyGlobalSave={notifyGlobalSave}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            アカウントタブ
        ══════════════════════════════════════════════════════════════════ */}

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
