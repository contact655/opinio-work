"use client";

/**
 * プロフィール編集の本体（3タブ ＋ カード）。
 *
 * ⚠️ **レイアウトを持たない。** `MypageLayout` は呼び出し側が用意する。
 *    2026-08-16 に `/profile/edit` から `/mypage` へ引っ越したとき、
 *    ここが自前でレイアウトを描いていると `/mypage` の中に二重に入れ子になった。
 *
 * ⚠️ 置き場所は `src/components/profile/editor/`。
 *    **`edit` という名前にしない。** `/profile/edit` は 2026-08-16 に
 *    リダイレクトだけの薄いルートになったので、ディレクトリ名がルートと
 *    対応していると次に読む人が誤解する。
 *
 * ⚠️ 中身（タブ・カード・EditableSection・保存の呼び方）は引っ越しで
 *    **1行も変えていない**。変えたのは置き場所と、レイアウトを外したことだけ。
 */

import { useState, useCallback, useEffect } from "react";
import type { Json } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import ProfileTab, { type ProfileSavedSnapshot, type SettingsState } from "./ProfileTab";
/* ⚠️ カード・入力欄の共通部品は formKit に移した（3-B / 2026-08-15）。中身は変えていない。 */
import {
  /* ⚠️ 元から RecordEditors 側（切り出した範囲）で export されていた型。移動先から import する。 */
  type RoleItem,
} from "./RecordEditors";
/* ⚠️ 型は親と RecordEditors の両方が使う。親に置くと循環 import になる。 */
import {
  type Education,
  type School,
  type Achievement,
  type Award,
  type MediaAppearance,
  type Certification,
  type Language,
  type UserSkill,
} from "./recordTypes";
import { type Stint } from "@/components/profile/CareerHistoryEditor";
import type { CompanyLogoInfo } from "@/lib/utils/timeline";
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

/* ⚠️ タブ（`ProfileTabKey` / `LEGACY_TAB_MAP`）は 2026-08-17 に削除した。
      旧 `?tab=` の値は **`/mypage` の page.tsx が転送で受ける**。
      ここに対応表を戻さないこと（転送先が2箇所に割れる）。 */

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
  social_links: Json | null;
  headline: string | null;
  /** プロフィールURL（`/u/<username>`）。
   *  ⚠️ 型は3箇所ある（ここ / ProfileTab / mypage の select）。揃えること */
  username: string | null;
} | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR_COLOR = "linear-gradient(135deg, var(--royal), #3B5FD9)";
const DEFAULT_COVER_COLOR  = "linear-gradient(135deg, var(--royal), #3B5FD9, #818CF8)";

// ─── ProfilePhotoUploader ─────────────────────────────────────────────────────

/* ⚠️ ProfilePhotoUploader は ProfileTab へ移した（3-B）。 */

/* ⚠️ `PROFILE_TABS` と `Tabs` は 2026-08-17 に削除した（フェーズ4-3）。
      プロフィールは1枚の縦長。タブを戻さないこと。 */

// ─── Sub-components ───────────────────────────────────────────────────────────

/* ⚠️ カードの見た目はここ1箇所。`FormSection` と `Card` が同じ値を共有する。
      片方だけ変えると、同じ画面にサイズ違いのカードが並ぶ。 */
/* ⚠️ メール通知設定（NotificationSettingsSection）は SettingsTab へ移した（3-B）。 */

/* ⚠️ SocialLinksEditor も ProfileTab へ移した（3-B）。 */

export default function ProfileEditor({
  owUser,
  initialEducations,
  initialSocialLinks,
  initialAchievements,
  initialAwards,
  initialCertifications,
  initialLanguages,
  initialSkills,
  initialMediaAppearances,
  initialExperiences,
  initialContentLinks,
  roles,
  roleAliases = {},
  isWelcome = false,
  /* ⚠️ `initialScoutEnabled` は受け取るが ProfileTab へは渡さない（2026-08-20）。
        右カラムの IntentCard が持つ。プロップ自体は `/profile/edit` の呼び出し元が
        まだ渡してくるので、型としては残す。 */
  initialScoutEnabled: _initialScoutEnabled = null,
  /* ⚠️ 「転職の希望」は 2026-08-25 に右カラム（`MypageClient`）へ移した。
        この3つは**受け取るだけで使わない**。`/profile/edit` の呼び出し元が
        まだ渡してくるので型としては残す（`initialScoutEnabled` と同じ扱い）。 */
  initialDesiredRoleIds: _initialDesiredRoleIds = [],
  desiredRoleOptions: _desiredRoleOptions,
  initialProfilePrefs: _initialProfilePrefs = null,
  profileTabExtra,
  activitySlot,
  articlesSlot,
  talkableBadge,
  companyLogoInfo = [],
  followCounts,
  openBasicNonce = 0, openHeaderNonce = 0,
  openCareerNonce = 0,
  onSavedSnapshotChange,
}: {
  owUser: OwUser;
  /* ⚠️ `authEmail` は 2026-08-17 に外した（ログイン情報は `/mypage/settings` へ移動）。 */
  initialEducations: Education[];
  initialSocialLinks: SocialLinks;
  initialAchievements: Achievement[];
  initialAwards: Award[];
  /** 資格（2026-08-24）。⚠️ `ProfileTab` へそのまま渡す */
  initialCertifications: Certification[];
  /** 言語（2026-08-24）。⚠️ `ProfileTab` へそのまま渡す */
  initialLanguages: Language[];
  /** ★スキル（2026-08-27）。⚠️ 資格・言語と同じ流し方 */
  initialSkills: UserSkill[];
  initialMediaAppearances: MediaAppearance[];
  initialExperiences: Stint[];
  initialContentLinks: ContentLink[];
  roles: RoleItem[];
  /** role_id → 別名[]。職種の検索セレクトでヒットさせる（ow_role_aliases） */
  roleAliases?: Record<string, string[]>;
  isWelcome?: boolean;
  initialScoutEnabled?: boolean | null;
  /** 希望職種（ow_profile_desired_roles）。本人が選んだ role_id（展開前） */
  initialDesiredRoleIds?: string[];
  /** 希望職種ピッカーの候補。**職歴の roles とは母集団が違う**（is_it_saas で絞る） */
  desiredRoleOptions?: RoleItem[];
  /** プロフィールタブの一番下に足すもの（`/mypage` が母校を渡す） */
  profileTabExtra?: React.ReactNode;
  /* ⚠️ ★下の2つは**素通しするだけ**（2026-08-25）。`ProfileTab` の中の
        決まった位置に入る。ここで中身を組み立てないこと。 */
  /** 「面談可」バッジ（氏名の右）。`/mypage` が渡す */
  talkableBadge?: React.ReactNode;
  /** アクティビティ（自己紹介の直後）。`/mypage` が渡す */
  activitySlot?: React.ReactNode;
  /** OPINIO 掲載記事（メディア掲載の直後）。`/mypage` が渡す */
  articlesSlot?: React.ReactNode;
  /* ── 外から特定のカードを開く合図。値が変わるたびに開く ──────────────
        ⚠️ **プロフィールタブへの切り替えもここでやる。** 別のタブを開いたまま
           押されると、カードは開くのに画面には出ない。 */
  /** ★職歴カードの表示を組み直すための企業ロゴ情報（2026-08-16 / 2-6）。`page.tsx` が配列で渡す */
  companyLogoInfo?: ({ id: string } & CompanyLogoInfo)[];
  /** ★ヘッダーに出すフォロー数（2026-08-16 / 2-7） */
  followCounts?: { followers: number; following: number };
  openBasicNonce?: number;
  openHeaderNonce?: number;
  openCareerNonce?: number;
  /**
   * **保存に成功したときだけ進む**スナップショットを親へ渡す。
   *
   * ⚠️ `/mypage` の右カラム「あと N つ」がこれを見る。
   *    ★**入力中の state を親へ流さないこと。** 流すと、保存していないのに
   *    「あと1つ」に減る（2026-08-15 に完成度バーで決めた「保存済みの値だけから
   *    算出する」と同じ話）。
   */
  onSavedSnapshotChange?: (snapshot: ProfileSavedSnapshot) => void;
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
  } | null;
}) {
  /* ⚠️ タブの state（`activeTab` / `mountedTabs` / `VALID_TABS`）は
        2026-08-17 に削除した。`?tab=` は `/mypage` 側で転送する。 */

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  /* ⚠️ 「外から開かれたらプロフィールタブへ切り替える」は不要になった（タブが無い）。 */

  /* 希望条件は WishesTab が持つ（3-B）。親は**保存済みの結果だけ**を受け取る。
     ⚠️ ここに希望条件の state を戻さないこと。保存の単位はカードで、それはタブ側にある。 */
  /* ⚠️ 希望条件の「設定済み」判定（`wishesHasPrefs`）は 2026-08-17 に削除した。
        タブ名の印の代わりに**ボックスの要約が現在値を出す**。
        `hasCareerPreferences` は `/mypage` の別の場所で現役なので残っている。 */

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
    /* ⚠️★フォールバックは **DB の既定と同じ `login_only`**（2026-08-28 に "public" から変更）。
          `ow_users.visibility` は **NOT NULL / DEFAULT 'login_only'** なので、
          ここが発火するのは `owUser` ごと null のときだけ ── つまり**稀**だが、
          そのとき「公開」と表示して保存させるのは**向きが逆**。
       ⚠️ 迷ったら狭いほうに倒す。公開範囲の既定を広いほうにしない。 */
    visibility:   (owUser?.visibility ?? "login_only") as SettingsState["visibility"],
  };
  /* 保存済みの公開設定。写真カードのプレビューが見る。
     ⚠️ 右カラムの「企業からの見え方」は 2026-08-16 に外した（本体は設定タブにある）。 */
  const [savedSettings, setSavedSettings] = useState<SettingsState>(initialSettingsForTab);
  /* ⚠️ `settingsDirty` は削除（設定タブが無い）。公開範囲はボックスのモーダルで保存する。 */


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
    /* ⚠️ 資格も数える（2026-08-24）。`certs` の項目名どおり。
          2026-08-04 に資格を廃止したときに外れていたぶんを戻した。
          既存の重み（3点）は変えていないので、誰の点数も下がらない。 */
    certOrAchievementCount: initialAchievements.length + initialAwards.length + initialMediaAppearances.length + initialCertifications.length,
    socialOrContentCount:   initialContentLinks.length + Object.values(initialSocialLinks).filter(Boolean).length,
  });
  const [profileDirty, setProfileDirty] = useState(false);

  /* 保存済みスナップショットを親（`/mypage` の右カラム）へ渡す。
     ⚠️ マウント時にも1度流れる。初期値は SSR のプロップから作った同じ値なので、
        親が持っている値と食い違わない。 */
  useEffect(() => {
    onSavedSnapshotChange?.(profileSaved);
  }, [profileSaved, onSavedSnapshotChange]);

  /* ── 未保存の変更 ─────────────────────────────────────────────────────────
        ⚠️ 確認を出すのは**ページ離脱のときだけ**。タブ切替では出さない
           （移動しても入力は消えない）。カードごとに扱いを変えないこと。
        ⚠️ 希望条件の内訳はタブ側が持つ。親は「未保存があるか」だけを受け取る。 */

  /* ページを離れるときだけ確認を出す。**モーダルの中身は閉じると失われる**ため。
     ⚠️ 文言はブラウザが決める（差し替えられない）。出すか出さないかだけを制御する。 */
  const hasDirty = profileDirty;
  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirty]);

  /* ⚠️ タブの完成度（`tabCompletion`）・未保存（`tabDirty`）・
        `profileTabsWithCompletion` は 2026-08-17 に削除した（タブが無い）。
        **「未設定」の印はヘッダー下のボックスの要約が代わりを務める**（値そのものを出す）。

     ⚠️ **完成度バーもこのページには無い**（2026-08-16 に外した）。
        戻すときは「保存済みの値」だけから作ること。入力中の state を混ぜると
        保存していないのに % が上がる（2026-08-15 に3項目が実際にそうだった）。
        `src/lib/profile/completion.ts` は `/mypage` の別の場所で現役。 */

  return (
    <>

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

        {/* ⚠️ アクション行（「セクションを追加」「公開プロフィールを見る」）は
               `ProfileTab` の先頭に移した（2026-08-17 / フェーズ4-3）。
               **ここに戻すと同じ導線が2つになる**（ルール⑧）。 */}

        {/* ── タブコンテンツ ──────────────────────────────────────────────────── */}

        {/* プロフィールタブ（3-B で別ファイルへ切り出し。中身は移しただけ）
            ⚠️ display:none で残す。アンマウントすると未保存の入力がタブ切替で消える。 */}
        <div>
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
            initialCertifications={initialCertifications}
            initialLanguages={initialLanguages}
            initialSkills={initialSkills}
            initialMediaAppearances={initialMediaAppearances}
            initialSocialLinks={initialSocialLinks}
            initialContentLinks={initialContentLinks}
            onSavedChange={setProfileSaved}
            onDirtyChange={setProfileDirty}
            notifyGlobalSave={notifyGlobalSave}
            companyLogoInfo={companyLogoInfo}
            followCounts={followCounts}
            activitySlot={activitySlot}
            articlesSlot={articlesSlot}
            talkableBadge={talkableBadge}
            openBasicNonce={openBasicNonce}
            openHeaderNonce={openHeaderNonce}
            openCareerNonce={openCareerNonce}
            /* ⚠️ 「転職の希望」は 2026-08-25 に右カラム（`MypageClient`）へ移した。
                  `desiredRoleOptions` / `initialProfilePrefs` / `initialDesiredRoleIds` は
                  受け取るだけで `ProfileTab` へは渡さない。**ここに戻さないこと。** */
            onVisibilitySaved={(v) => setSavedSettings((prev) => ({ ...prev, visibility: v }))}
          />
          {/* 母校・アクティビティ（プロフィールの下端） */}
          {profileTabExtra}
        </div>

        {/* ⚠️ 「転職の希望」タブ（`WishesTab`）と「設定」タブ（`SettingsTab`）は
               2026-08-17 に削除した。行き先は
               **希望条件・公開範囲・スカウト・転職検討状況 → ヘッダー下のボックス**、
               **ログイン情報・メール通知・アカウント削除 → `/mypage/settings`**。
               ここに戻すと、同じ列を触る画面が2つに戻る。 */}

        {/* ══════════════════════════════════════════════════════════════════
            アカウントタブ
        ══════════════════════════════════════════════════════════════════ */}

        <style>{`
          input:focus, textarea:focus, select:focus {
            border-color: var(--royal) !important;
            box-shadow: 0 0 0 3px var(--royal-50) !important;
          }
        `}</style>

    </>
  );
}
