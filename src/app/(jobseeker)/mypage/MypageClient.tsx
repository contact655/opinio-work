"use client";

import { useState } from "react";
import Link from "next/link";
import MypageLayout from "./_components/MypageLayout";
import StanceCard from "@/components/profile/editor/StanceCard";
import TalkToMeCard, { type TalkMembership } from "@/components/profile/editor/TalkToMeCard";
/* ⚠️ プロフィール編集の本体。2026-08-16 に `/profile/edit` からここへ移した。
      **中身は書き換えていない**（置き場所を変えただけ）。 */
import ProfileEditor from "@/components/profile/editor/ProfileEditor";
import type { ProfileSavedSnapshot } from "@/components/profile/editor/ProfileTab";
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

// ─── Shared: Section block ────────────────────────────────────────────────────

function SectionBlock({
  title, titleEn, right, children,
}: {
  title: string; titleEn?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "24px 28px", marginBottom: 20,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 18, paddingBottom: 14,
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: 'var(--font-noto-serif)',
          fontSize: 17, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "baseline", gap: 10,
        }}>
          {title}
          {titleEn && (
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
            }}>
              {titleEn}
            </span>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────────

function DashboardView({
  userId, userInitial, userAvatar,
  userEducations,
  schoolPeerCounts = {},
  canPost,
  profileEditorWith,
}: {
  /** 投稿してよい人か（lib/feed/canPost）。false なら「アクティビティ」を出さない */
  canPost: boolean;
  /** プロフィール編集（3タブ＋カード群）を描く。
      引数に渡したものは**プロフィールタブの一番下**に入る（母校・アクティビティ） */
  profileEditorWith: (extra: React.ReactNode) => React.ReactNode;
  userId: string;
  userInitial: string;
  userAvatar: string;
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

      {/* ── アクティビティ投稿フォーム ──
          ⚠️ 投稿できない人にはセクションごと出さない（2026-08-05）。
             コンポーザーがセクションの中身そのものなので、コンポーザーだけ消すと
             見出しだけが残って空欄になる。 */}
      {canPost && (
      <SectionBlock title="アクティビティ" titleEn="ACTIVITY">
        <PostComposer
          avatarColor={userAvatar ?? "linear-gradient(135deg, var(--royal), #3B5FD9)"}
          initial={userInitial}
          avatarUrl={null}
        />
        <div style={{ marginTop: 8 }}>
          <Link href={`/u/${userId}`} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
          }}>
            投稿を公開プロフィールで確認する →
          </Link>
        </div>
      </SectionBlock>
      )}

        </>
      )}

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/* ⚠️ 型は TalkToMeCard 側（= memberState() が要求する形）に合わせる。
      ここで別に定義すると、列を足したときに片方だけ古くなる。 */
type AmbassadorMembership = TalkMembership;

/** `ProfileEditor` にそのまま渡すプロップ。★親で1つずつ数え直さない */
type ProfileEditorProps = Omit<ComponentProps<typeof ProfileEditor>, "owUser">;

export default function MypageClient({
  canPost,
  owUser,
  followCounts,
  educations = [],
  timelineCareers = [],
  conversationsBadge,
  applicationsBadge,
  scoutsBadge,
  isNewUser = false,
  ambassadorMemberships = [],
  currentCompanies = [],
  schoolPeerCounts = {},
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
} & ProfileEditorProps) {
  const userName = owUser?.name ?? "ユーザー";
  const userInitial = userName.charAt(0);
  const userAvatar = owUser?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";

  /* ⚠️ 現職の1行は 2-7 で `ProfileHeader` が自分で組むようになった（2026-08-16）。
        ここで作って渡すのはやめた。同じ導出を2箇所に置かない。 */

  /* ── 促しから「該当カードを編集モードで開く」ための合図 ──────────────────
        ⚠️ **`openAddNonce` と同じ形**（nonce を +1 して受け側の useEffect で開く）。
           新しい仕組みを作らない。
        ⚠️ 押しても何も起きないリンクにしないこと。移設前は `/profile/edit` へ
           飛ばしていたが、移設後は**同じページ**なので無反応になった（2026-08-16）。 */
  /* ★「あと N つ」は**保存済みスナップショット**から出す（2026-08-16）。
        SSR のプロップだけを見ていた頃は、保存しても**リロードするまで
        数字が減らなかった**（実測で確認）。
        ⚠️ 入力中の値は流れてこない（`ProfileEditor` が保存成功時にだけ進める）。
           流すと、保存していないのに N が減る。 */
  const [profileSaved, setProfileSaved] = useState<ProfileSavedSnapshot | null>(null);

  const [openBasicNonce, setOpenBasicNonce] = useState(0);
  const [openHeaderNonce, setOpenHeaderNonce] = useState(0);
  const [openCareerNonce, setOpenCareerNonce] = useState(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  // ⚠️ モックの isMentor は使わない。実データ（owUser.is_mentor）で判定する

  /* ⚠️ **`activeView` を切り替える導線が無くなった**（2026-08-16）。
        `casual` / `bookmarks` ビューへ入る唯一の入口は右カラムの
        「最近の申込」「ブックマーク」の**すべて見る →**で、そのカードごと外したため。
        同じ内容は左メニューの `/mypage/applications` `/mypage/bookmarks` にあり、
        そちらが本体。**ビューの実装は指示により残している**（消すかどうかは別途判断）。 */
  /* 公開に必要な3点のうち、まだ埋まっていないもの。
     ⚠️ バナー本文と同じ3つを見る。文言と条件がズレると、
        「あと1つ」と書いてあるのに何を入れればいいか分からない状態になる。
     ⚠️ tab はすべて /profile/edit の VALID_TABS に実在するキー。 */
  /* ⚠️ スナップショットが届く前（初回描画）は SSR のプロップで判定する。
        `ProfileEditor` はマウント直後に同じ値を流してくるので、切り替わっても
        数字は変わらない。 */
  const savedName    = profileSaved ? profileSaved.name    : (owUser?.name ?? "");
  const savedAboutMe = profileSaved ? profileSaved.aboutMe : (owUser?.about_me ?? "");
  const savedCareerCount = profileSaved ? profileSaved.experienceCount : (timelineCareers?.length ?? 0);

  const setupMissing: { label: string; key: "name" | "aboutMe" | "career" }[] = [
    { key: "name" as const,    label: "名前",     done: !!savedName && savedName !== "ユーザー" },
    { key: "aboutMe" as const, label: "自己紹介", done: savedAboutMe.trim().length > 0 },
    { key: "career" as const,  label: "職歴",     done: savedCareerCount > 0 },
  ].filter((x) => !x.done).map(({ label, key }) => ({ label, key }));

  const dashboardRightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* ★「声をかけられてもよいか」（2026-08-20 / フェーズB）。
             ⚠️ **右カラムの先頭に置く。** 767px 以下では右カラムごと `order: -1` で
                本文の上に来るので、モバイルでは最初に目に入る。
             ⚠️ `ow_profiles.scout_enabled` を**そのまま**読み書きする。主スイッチ用の列は作らない。
             ⚠️ 「転職について」は**表示だけ**。編集は本文の「転職の希望」に1つだけ置く。 */}
      <StanceCard
        initialScoutEnabled={(editorProps as { initialScoutEnabled?: boolean | null }).initialScoutEnabled ?? null}
        openToWorkLabel={owUser?.is_open_to_work ? "積極的に探している" : "情報収集として"}
      />

      {/* ★在籍している会社について話を聞かれてもよいか（2026-08-23 / フェーズ2）。
             ⚠️ 出るのは**在籍中かつ企業マスタに紐づく会社がある人だけ**。
                0件ならカードごと出ない（TalkToMeCard 側で判定）。
             ⚠️ 本文側にあった旧「面談対応者の設定」はここへ統合した。
                2箇所に置くと、状態の出し分けが片方だけ古くなる
                （旧ウィジェットは display_consent だけを見ており、
                 申請しただけの人に「公開中」と表示していた）。 */}
      <TalkToMeCard
        currentCompanies={currentCompanies}
        memberships={ambassadorMemberships}
      />

      {/* プロフィール公開促進
          ⚠️ 2026-08-10 まで `/profile/start` を指していたが、**そのページは存在せず 404** だった。
             しかも表示条件の `ow_users.profile_setup_at` は**書くコードがどこにも無く**
             （API は受け付けるが送るクライアントが無い）、26人中22人に永久に出続けていた。
          ⚠️ 表示条件は「本文で約束している3つが埋まっているか」から導く。
             書かれない列に依存すると、また消えないバナーに戻る。 */}
      {setupMissing.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #EFF3FC 0%, #E8EDFB 100%)",
          border: "1.5px solid var(--royal-100)", borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            プロフィールを公開して、企業に見つけてもらいましょう
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 10 }}>
            あと{setupMissing.length}つ、{setupMissing.map((m) => m.label).join("・")}を入力すると公開できます。
          </div>
          {/* ⚠️ **リンクにしない。** 移設後は同じページなので `href` では何も起きない。
                 足りていない項目の**先頭**に対応するカードを開く。 */}
          <button
            type="button"
            onClick={() => {
              /* ⚠️ 行き先は3つに分かれる（2026-08-16 / 2-7 でカードを作り直した）。
                    名前は**ヘッダー**、自己紹介は**独立セクション**、職歴はモーダル。 */
              if (setupMissing[0].key === "career") setOpenCareerNonce((n) => n + 1);
              else if (setupMissing[0].key === "name") setOpenHeaderNonce((n) => n + 1);
              else setOpenBasicNonce((n) => n + 1);
            }}
            style={{
            display: "inline-block", padding: "8px 16px",
            background: "var(--royal)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {setupMissing[0].label}を入力する →
          </button>
        </div>
      )}

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
          userId={owUser?.id ?? ""}
          userInitial={userInitial}
          userAvatar={userAvatar}
          userEducations={educations}
          canPost={canPost}
          schoolPeerCounts={schoolPeerCounts}
          profileEditorWith={(extra) => (
            <ProfileEditor
              {...editorProps}
              owUser={owUser}
              followCounts={followCounts}
              profileTabExtra={extra}
              openBasicNonce={openBasicNonce}
              openHeaderNonce={openHeaderNonce}
              openCareerNonce={openCareerNonce}
              onSavedSnapshotChange={setProfileSaved}
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
