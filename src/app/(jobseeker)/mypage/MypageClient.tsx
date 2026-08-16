"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MypageLayout from "./_components/MypageLayout";
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

function AmbassadorWidget({ memberships }: { memberships: AmbassadorMembership[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (memberships.length === 0) return null;

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch("/api/mypage/ambassador-self-remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: id }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 8, letterSpacing: "0.05em" }}>
        面談対応者の設定
      </div>
      {memberships.map((m) => (
        <div key={m.id} style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: m.display_consent ? "var(--success-soft)" : "var(--warm-soft)",
          border: `1px solid ${m.display_consent ? "#6ee7b7" : "#fcd34d"}`,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 18 }}>{m.display_consent ? "✅" : "⏳"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
              {m.company_name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
              {m.role_title ?? "役職未設定"} ·{" "}
              {m.display_consent ? "話せる人として公開中" : "承認待ち（未公開）"}
            </div>
          </div>
          <button
            onClick={() => handleRemove(m.id)}
            disabled={removingId === m.id}
            style={{
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12, fontWeight: 500,
              color: "var(--ink-mute)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {removingId === m.id ? "..." : "解除"}
          </button>
        </div>
      ))}
    </div>
  );
}

function DashboardView({
  userId, userInitial, userAvatar,
  userEducations,
  ambassadorMemberships = [],
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
  ambassadorMemberships?: AmbassadorMembership[];
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

      {/* 面談対応者の設定（登録がある場合のみ表示） */}
      <AmbassadorWidget memberships={ambassadorMemberships} />
        </>
      )}

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AmbassadorMembership = { id: string; company_id: string; company_name: string; role_title: string | null; display_consent: boolean };

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
  showScoutBanner = false,
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
  showScoutBanner?: boolean;
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
  const [scoutBannerVisible, setScoutBannerVisible] = useState(showScoutBanner);
  const [scoutBannerSaving, setScoutBannerSaving] = useState(false);
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

      {/* スカウト設定未完了 */}
      {scoutBannerVisible && (
        <div style={{
          background: "linear-gradient(135deg, #FEF9C3 0%, #FEF3C7 100%)",
          border: "1.5px solid #FCD34D", borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            📬 スカウト設定が未完了です
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#78350F", lineHeight: 1.6, marginBottom: 10 }}>
            企業からのスカウトを受け取るか設定してください。
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={scoutBannerSaving}
              onClick={async () => {
                setScoutBannerSaving(true);
                try {
                  await fetch("/api/jobseeker/scout-settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scout_enabled: true }),
                  });
                  setScoutBannerVisible(false);
                } finally { setScoutBannerSaving(false); }
              }}
              style={{
                padding: "7px 14px", background: "#D97706", color: "#fff",
                border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: scoutBannerSaving ? "wait" : "pointer", fontFamily: "inherit",
              }}
            >受け取る</button>
            <button
              type="button"
              disabled={scoutBannerSaving}
              onClick={async () => {
                setScoutBannerSaving(true);
                try {
                  await fetch("/api/jobseeker/scout-settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scout_enabled: false }),
                  });
                  setScoutBannerVisible(false);
                } finally { setScoutBannerSaving(false); }
              }}
              style={{
                padding: "7px 14px", background: "none", color: "#92400E",
                border: "1.5px solid #FCD34D", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: scoutBannerSaving ? "wait" : "pointer", fontFamily: "inherit",
              }}
            >受け取らない</button>
          </div>
        </div>
      )}

      {/* ⚠️ 「プロフィール完成度」「最近の申込」「ブックマーク」を外した（2026-08-16）。
             ・完成度 … プロフィール本体が同じページに出るようになり、
                        タブの「未設定」バッジが同じ役割を果たす
             ・最近の申込 / ブックマーク … 左メニューの「応募管理」「ブックマーク」と
                        同じ場所へ行くだけだった（`.claude/rules/ui-debugging.md` ⑧）
             ⚠️ **`ow_bookmarks` / `ow_casual_meetings` の取得は消していない。**
                本文の「申込」「ブックマーク」ビュー（activeView）が使う。 */}
      {/* 採用担当者・企業の方向け導線 */}
      <a
        href="/biz/auth"
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
              { step: 3, label: "話せる人を探してみる", href: "/people", cta: "話せる人を見る →" },
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
          ambassadorMemberships={ambassadorMemberships}
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
