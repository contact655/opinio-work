"use client";

import { useState } from "react";
import Link from "next/link";
import MypageLayout from "./_components/MypageLayout";
/* ★意思表示（2026-08-26 / フェーズ1）。`StanceCard` / `CareerIntentBox` /
      `TalkToMeCard` の**3枚を1枚に統合した**。3枚に戻さないこと。 */
import IntentCard from "@/components/profile/editor/IntentCard";
/* ★公開プロフィール（`/u/[id]`）と同じ部品（2026-08-25）。**似た見た目を書き足さない** */
import { ActivitySection, ProfileArticlesSection } from "@/components/profile/view/ProfileSections";
import { TalkableBadge } from "@/components/profile/view/TalkableBadge";
import { isTalkable } from "@/lib/companyMembers/talkable";
import type { CompanyMemberRow } from "@/lib/constants/companyMembers";
/* ⚠️ プロフィール編集の本体。2026-08-16 に `/profile/edit` からここへ移した。
      **中身は書き換えていない**（置き場所を変えただけ）。 */
import ProfileEditor from "@/components/profile/editor/ProfileEditor";
import type { ComponentProps } from "react";
/* ⚠️ 型だけ使う。経歴タイムラインの描画は 2026-08-16 にここから外した
      （職歴・学歴カードと重複するため）。`MergedTimeline` 本体は `/u/[id]` が使う。 */
import { type CareerEntry } from "@/components/profile/MergedTimeline";
import { PostComposer } from "@/components/profile/PostComposer";

/* ⚠️ **`ProfileEditor` の OwUser と同じ形にすること**（2026-08-16）。
      `/mypage` が編集フォームにそのまま渡すので、片方に列を足してもう片方に
      足し忘れると、その列が編集画面で空になり**保存した瞬間に消える**。
      型が別々に2つあるのは、片方をアプリ側の import で汚さないため。 */
type OwUser = ComponentProps<typeof ProfileEditor>["owUser"];

// ─── Types ────────────────────────────────────────────────────────────────────

/* ⚠️ 「申込」「ブックマーク」の SPA ビュー（`ActiveView`）は 2026-08-16 に削除した。
      右カラムの「すべて見る →」を外した時点で**到達不能**になっており、
      同じ内容は `/mypage/applications` `/mypage/bookmarks` にある（実測 200）。
      ⚠️ `MypageLayout` の `activeKey` はこれとは別物。混同しないこと。 */

/* ⚠️ `SectionBlock`（見出し＋罫線の枠）は 2026-08-25 に削除した。唯一の利用者だった
      「アクティビティ」を本文の中へ移し、そちらは `/u/[id]` と同じ部品を使うため。
   ⚠️ 似た枠が要るときは書き足さず、`components/profile/view/ProfileSections.tsx`
      の部品を使うこと（公開プロフィールと片方だけ直る状態を作らない）。 */

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function DashboardView({
  userEducations,
  schoolPeerCounts = {},
  profileEditorWith,
}: {
  /* ⚠️ `userId` / `userInitial` / `userAvatar` / `canPost` は 2026-08-25 に外した。
        アクティビティを本文の中（`activitySlot`）へ移し、投稿フォームは
        `MypageClient` が組むようになったため、この階層では使わない。 */
  /** プロフィール編集（3タブ＋カード群）を描く。
      引数に渡したものは**プロフィールタブの一番下**に入る（母校） */
  profileEditorWith: (extra: React.ReactNode) => React.ReactNode;
  userEducations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
  schoolPeerCounts?: Record<string, number>;
}) {
  /* ⚠️ **経歴タイムライン（MergedTimeline）はここから外した**（2026-08-16）。
        職歴カード・学歴カードが同じ内容を出しており、そちらは編集もできる上位互換。
        同じものを2箇所に出さない（`.claude/rules/ui-debugging.md` ⑧と同じ話）。
        ⚠️ `MergedTimeline` 自体は消していない。`/u/[id]`（公開プロフィール）が使う。 */

  return (
    <div>
      {/* ⚠️ `UserProfileCard`（名前・アバター・現職・SNS の「自分の見え方」カード）は
             2-7 で**廃止**した（2026-08-16）。同じものを公開プロフィールと同じ
             `ProfileHeader` で出すようになり、プロフィールタブの先頭にある。
             ここに戻すと名前もアバターも SNS も2箇所になる（ルール⑧）。 */}

      {/* ★プロフィール編集（3タブ＋7枚のカード）。
             母校とアクティビティは**プロフィールタブの中**に入れる。
             タブの外に出すと「転職の希望」「設定」でも出てしまう。 */}
      {profileEditorWith(
        <>
      {/* ── あなたの母校 ── */}
      {(() => {
        const schoolEdus = (userEducations ?? []).filter(
          (e) => e.school_id && e.school_master
        );
        if (schoolEdus.length === 0) return null;
        const univ = schoolEdus.filter((e) => e.degree !== "高校卒");
        const hs = schoolEdus.filter((e) => e.degree === "高校卒");
        return (
          <section style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "24px 28px", marginBottom: 20,
          }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)",
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                  あなたの母校
                </span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
                  ALUMNI
                </span>
              </div>
              <Link href="/people" style={{ fontSize: 12, color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
                すべて見る →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {univ.map((e) => {
                const sm = e.school_master!;
                const peerCount = schoolPeerCounts[e.school_id!] ?? 0;
                const sub = [e.faculty, e.degree, e.graduated_at ? `${e.graduated_at.slice(0, 4)}年卒` : null].filter(Boolean).join(" · ");
                return (
                  <Link key={e.id} href={`/schools/${e.school_id}`} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px",
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    borderRadius: 12, textDecoration: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }} className="request-item-row">
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: sm.logo_gradient ?? "linear-gradient(135deg, #7C3AED, #a855f7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                        {sm.logo_letter ?? sm.name.charAt(0)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: sub ? 2 : 0 }}>
                        {sm.name}
                      </div>
                      {sub && (
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: peerCount > 0 ? 3 : 0 }}>
                          {sub}
                        </div>
                      )}
                      {peerCount > 0 && (
                        <div style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>
                          自分以外の同窓 {peerCount}名
                        </div>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </Link>
                );
              })}
              {hs.map((e) => {
                const sm = e.school_master!;
                const peerCount = schoolPeerCounts[e.school_id!] ?? 0;
                return (
                  <Link key={e.id} href={`/schools/${e.school_id}`} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    borderRadius: 10, textDecoration: "none",
                    transition: "border-color 0.15s",
                  }} className="request-item-row">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: sm.logo_gradient ?? "linear-gradient(135deg, #7C3AED, #a855f7)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                        {sm.logo_letter ?? sm.name.charAt(0)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
                        {sm.name}
                      </span>
                      {peerCount > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                          同窓 {peerCount}名
                        </span>
                      )}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ⚠️★「アクティビティ」は 2026-08-25 に**プロフィール本文の中へ移した**
             （柴さんの指示：公開プロフィールと同じ構成にする）。置き場所は
             `ProfileTab` の `activitySlot`＝**自己紹介の直後**で、`/u/[id]` と同じ。
          ⚠️ ここに戻さないこと。戻すと投稿フォームが1ページに2つ出る（ルール⑧）。
          ⚠️ 「投稿を公開プロフィールで確認する →」も外した。投稿一覧が
             **その場に出る**ようになったので、確認しに行く先が要らない。 */}

        </>
      )}

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/* ⚠️ 型は `memberState()` が要求する形をそのまま使う。
      ここで別に定義すると、列を足したときに片方だけ古くなる。 */
type AmbassadorMembership = CompanyMemberRow;

/** `ProfileEditor` にそのまま渡すプロップ。★親で1つずつ数え直さない */
type ProfileEditorProps = Omit<ComponentProps<typeof ProfileEditor>, "owUser">;

export default function MypageClient({
  canPost,
  owUser,
  followCounts,
  educations = [],
  conversationsBadge,
  applicationsBadge,
  scoutsBadge,
  isNewUser = false,
  ambassadorMemberships = [],
  currentCompanies = [],
  schoolPeerCounts = {},
  recentPosts = [],
  likedPostIds = [],
  featuredArticles = [],
  ...editorProps
}: {
  /** 投稿してよい人か（lib/feed/canPost）。false なら「アクティビティ」を出さない */
  canPost: boolean;
  owUser: OwUser;
  /** フォロワー数 / フォロー中の数。0 の項目は出ない */
  followCounts?: { followers: number; following: number };
  educations?: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[];
  /* ⚠️ 2026-08-25 に**このコンポーネントでは使わなくなった**（促しカードの判定に使っていた）。
        プロップは受け取るが本文では触らない。呼び出し側（page.tsx）はそのまま渡している。 */
  timelineCareers?: CareerEntry[];
  /* ⚠️ `companyBookmarks` / `jobBookmarks` / `casualMeetings` は 2026-08-16 に外した。
        SPA ビューごと消えたため。**取得も `page.tsx` から消してある。**
        一覧は `/mypage/bookmarks` `/mypage/applications` が自分で引く。 */
  conversationsBadge?: number;
  applicationsBadge?: number;
  scoutsBadge?: number;
  isNewUser?: boolean;
  ambassadorMemberships?: AmbassadorMembership[];
  currentCompanies?: { id: string; name: string }[];
  schoolPeerCounts?: Record<string, number>;
  /* ── ★公開プロフィールと同じ構成にするための3つ（2026-08-25 / 柴さんの指示）──
        ⚠️ 取得は `page.tsx` が持つ。ここは**受け取って渡すだけ**。 */
  /** 自分の投稿（最大6件）。`/u/[id]` と同じ取り方 */
  recentPosts?: {
    id: string; content: string; image_url: string | null; created_at: string;
    likes: { count: number }[];
  }[];
  /** 自分がいいねしている投稿ID。⚠️ 配列のまま扱う（`Set` にしない） */
  likedPostIds?: string[];
  /** OPINIO 掲載記事 */
  featuredArticles?: {
    id: string; slug: string; title: string; subtitle: string | null;
    type: string; eyecatch_gradient: string | null; read_min: number | null;
    published_at: string | null;
  }[];
} & ProfileEditorProps) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";

  /* ⚠️ 現職の1行は 2-7 で `ProfileHeader` が自分で組むようになった（2026-08-16）。
        ここで作って渡すのはやめた。同じ導出を2箇所に置かない。 */

  /* ⚠️ 「あと N つ」の保存済みスナップショット（`profileSaved`）も 2026-08-25 に落とした。
        促しカードを外して**読む人がいなくなった**ため。
        ⚠️ `ProfileEditor` 側の `onSavedSnapshotChange` は**省略可能なプロップ**として残る。
           保存の成否を親へ返す仕組みなので、次に「保存できたか」を親で使うときに要る。 */
  /* ⚠️ 「公開まであと N つ」カードを外した（2026-08-25）ので、
        `openBasicNonce` / `openHeaderNonce` / `openCareerNonce` を**立てる人がいなくなった**。
        state ごと削除して、`ProfileEditor` へも渡していない。
        ⚠️ 受け側（ProfileEditor / ProfileTab）の**省略可能なプロップは残してある**。
           外から編集モーダルを開く仕組み自体は生きており、次に使う人のためのもの。
           使わないと決めるなら3ファイルまとめて落とすこと（いまは中途半端に残さない判断）。 */
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  // ⚠️ モックの isMentor は使わない。実データ（owUser.is_mentor）で判定する

  /* ⚠️ **`activeView` を切り替える導線が無くなった**（2026-08-16）。
        `casual` / `bookmarks` ビューへ入る唯一の入口は右カラムの
        「最近の申込」「ブックマーク」の**すべて見る →**で、そのカードごと外したため。
        同じ内容は左メニューの `/mypage/applications` `/mypage/bookmarks` にあり、
        そちらが本体。**ビューの実装は指示により残している**（消すかどうかは別途判断）。 */
  /* ⚠️ `editorProps` は `ProfileEditor` の props をそのまま束ねたもので、
        ここで使う分だけ型を付け直す（`initialScoutEnabled` と同じやり方）。
        **`as` を各所に散らさず、1箇所でまとめる。** */
  const intentProps = editorProps as Partial<ComponentProps<typeof IntentCard>> & {
    initialDesiredRoleIds?: string[];
    initialProfilePrefs?: {
      desired_prefectures: string[] | null; desired_work_styles: string[] | null;
      transfer_timing: string | null; desired_salary_min: number | null;
      desired_salary_max: number | null; desired_phase: string[] | null;
      career_stance: string | null; stance_updated_at: string | null;
    } | null;
  };

  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* ★「意思表示」（2026-08-26 / フェーズ1・柴さんの指示）。**1枚だけ。**
             ⚠️ 統合前は3枚（声をかけられてもよいか / 転職について / 話を聞かれてもよいか）で、
                1つのスイッチに5段の文字が乗っていた。**3枚に戻さないこと。**
             ⚠️ **右カラムの先頭に置く。** 767px 以下では右カラムごと `order: -1` で
                本文の上に来るので、モバイルでは最初に目に入る。
             ⚠️ 値は `editorProps` から読む。`ProfileEditor` → `ProfileTab` の
                受け渡しは外したので、**本文に戻すならここから外すこと。**
             ⚠️ 「現職の話を聞かれる」の行は**在籍中かつ企業マスタに紐づく会社がある人だけ**に出る
                （0件なら行ごと出ない。判定は `IntentCard` 側）。 */}
      <IntentCard
        stanceUpdatedAt={intentProps.initialProfilePrefs?.stance_updated_at ?? null}
        initialPrefs={{
          /* ⚠️ `?? ""` や `?? 既定値` に倒さない。**null は「まだ答えていない」** */
          career_stance:       intentProps.initialProfilePrefs?.career_stance ?? null,
          desired_role_ids:    intentProps.initialDesiredRoleIds ?? [],
          desired_prefectures: intentProps.initialProfilePrefs?.desired_prefectures ?? null,
          desired_work_styles: intentProps.initialProfilePrefs?.desired_work_styles ?? null,
          transfer_timing:     intentProps.initialProfilePrefs?.transfer_timing ?? null,
          desired_salary_min:  intentProps.initialProfilePrefs?.desired_salary_min ?? null,
          desired_salary_max:  intentProps.initialProfilePrefs?.desired_salary_max ?? null,
          desired_phase:       intentProps.initialProfilePrefs?.desired_phase ?? null,
        }}
        roles={intentProps.roles ?? []}
        roleAliases={intentProps.roleAliases ?? {}}
        desiredRoleOptions={intentProps.desiredRoleOptions}
        currentCompanies={currentCompanies}
        memberships={ambassadorMemberships}
      />

      {/* ⚠️★「公開まであと N つ」カードは 2026-08-25 に**撤去した**（柴さんの指示）。
             本文側が同じことを言っており、**同じ操作への入口が2つ**になっていた（ルール⑧）。
             ・自己紹介 … 本文の空カードが「自己紹介を書いて、あなたのことを伝えましょう」
             ・職歴 / 名前 … 本文の職歴カードとヘッダーの ✎
             ⚠️ 2026-08-24 に**全セクションを常時表示**にしたことで重複が生まれた。
                空カードを隠す形に戻すなら、この促しも一緒に戻すこと。
          ⚠️ 「スカウト設定が未完了です」バナーも 2026-08-17 に同じ理由で外している
             （ヘッダー下の「転職の希望」が現在値を出しているため）。 */}

      {/* ⚠️ 「スカウト設定が未完了です」バナーは 2026-08-17（フェーズ5）に外した。
             ヘッダー下の「転職の希望」ボックスが**現在値（「未選択」）を出し、
             ✎ から直せる**ようになり、**同じ設定への入口が2つ**になっていた（ルール⑧）。
          ⚠️ 促し自体を消したわけではない。ボックスの要約が
             「スカウト｜未選択」と灰色で出るので、未設定であることは読める。
          ⚠️ `showScoutBanner` プロップと `/mypage` 側の判定も外した。 */}

      {/* ⚠️ 「プロフィール完成度」「最近の申込」「ブックマーク」を外した（2026-08-16）。
             ・完成度 … プロフィール本体が同じページに出るようになり、
                        タブの「未設定」バッジが同じ役割を果たす
             ・最近の申込 / ブックマーク … 左メニューの「応募管理」「ブックマーク」と
                        同じ場所へ行くだけだった（`.claude/rules/ui-debugging.md` ⑧）
             ⚠️ **`ow_bookmarks` / `ow_casual_meetings` の取得は消していない。**
                本文の「申込」「ブックマーク」ビュー（activeView）が使う。 */}
      {/* 採用担当者・企業の方向け導線
          ⚠️ **モバイルでは出さない**（求職者のモバイル画面には要らない）。
             ★ここで消す。本文側に「モバイル用の控え」を作らない。 */}
      <a
        href="/biz/auth"
        className="mypage-hide-mobile"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          background: "var(--royal-50)",
          border: "1px solid var(--royal-100)",
          borderRadius: 10, textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>採用担当者・企業の方はこちら</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
  );

  return (
    <MypageLayout
      activeKey="dashboard"
      conversationsBadge={conversationsBadge}
      applicationsBadge={applicationsBadge}
      scoutsBadge={scoutsBadge}
      rightColumn={dashboardRightColumn}
    >
      {/* ウェルカムバナー（新規登録直後） */}
      {isNewUser && !welcomeDismissed && (
        <div style={{
          background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
          border: "1.5px solid #6EE7B7",
          borderRadius: 14,
          padding: "18px 20px",
          marginBottom: 20,
        }}>
          {/* ヘッダー行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#065F46" }}>
                OPINIOへようこそ！登録が完了しました。
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#047857", marginTop: 2 }}>
                まずは以下の3ステップをやってみましょう
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="閉じる"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#6EE7B7", fontSize: 20, lineHeight: 1,
                padding: "4px 6px", borderRadius: 6, flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* 3ステップ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { step: 1, label: "企業を1社お気に入りに追加する", href: "/companies", cta: "企業一覧を見る →" },
              { step: 2, label: "求人を1件確認する", href: "/jobs", cta: "求人を見る →" },
              { step: 3, label: "話を聞ける人を探してみる", href: "/people", cta: "登録ユーザーを見る →" },
            ].map(({ step, label, href, cta }) => (
              <div key={step} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(255,255,255,0.65)", borderRadius: 10,
                padding: "10px 14px",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "var(--success)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800,
                }}>
                  {step}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#065F46" }}>
                  {label}
                </span>
                <Link href={href} style={{
                  fontSize: 12, fontWeight: 700, color: "#047857",
                  background: "#D1FAE5", padding: "4px 10px",
                  borderRadius: 100, textDecoration: "none", flexShrink: 0,
                  border: "1px solid #A7F3D0",
                }}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}



      {(
        <DashboardView
          userEducations={educations}
          schoolPeerCounts={schoolPeerCounts}
          profileEditorWith={(extra) => (
            <ProfileEditor
              {...editorProps}
              owUser={owUser}
              followCounts={followCounts}
              profileTabExtra={extra}
              /* ★公開プロフィールと同じ位置に同じ部品を出す（2026-08-25）。
                    ⚠️ place だけを `ProfileTab` が決め、中身はここで組む。
                    ⚠️ `/u/[id]` と**同じ部品**を使うこと。似た見た目を書き足さない。 */
              activitySlot={
                <ActivitySection
                  posts={recentPosts}
                  likedPostIds={likedPostIds}
                  viewerIsOwner
                  displayName={userName}
                  /* ⚠️ 投稿できない人にはフォームを渡さない。
                        セクション自体は出す——0件でも「まだ投稿していません」と
                        書くのが `/u/[id]` の作り（消すと置き場所が無いのか
                        投稿が無いのかを読み手が区別できない）。 */
                  composer={canPost ? (
                    <PostComposer
                      avatarColor={userAvatar}
                      initial={userInitial}
                      avatarUrl={owUser?.avatar_url ?? null}
                    />
                  ) : undefined}
                />
              }
              articlesSlot={<ProfileArticlesSection featuredArticles={featuredArticles} />}
              /* ★「面談可」（2026-08-25 / 柴さんの指示）。
                    ⚠️ 判定は `/u[id]` `/people` と**同じ関数**（`isTalkable`）を通す。
                       ここで `display_consent` だけを見る等、別の条件を書かないこと。
                    ⚠️ 在籍中であることも要る。退職して `is_current` を false にすると
                       自動で降りる（`talkable.ts` の②）。 */
              talkableBadge={isTalkable(
                ambassadorMemberships.filter((m) => m.display_consent && m.is_public).map((m) => m.company_id),
                currentCompanies.map((c) => c.id),
              ) ? <TalkableBadge /> : null}
            />
          )}
        />
      )}

      <style>{`
        .request-item-row:hover { border-color: var(--royal-100) !important; background: #fff !important; }
        .stat-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 14px rgba(15,23,42,0.06) !important; transform: translateY(-1px); }
        .bookmark-card-hover:hover { border-color: var(--royal-100) !important; box-shadow: 0 4px 12px rgba(15,23,42,0.05) !important; }
      `}</style>
    </MypageLayout>
  );
}
