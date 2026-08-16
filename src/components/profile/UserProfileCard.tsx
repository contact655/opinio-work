// UserProfileCard — /mypage の先頭に置く「自分の見え方」カード（表示のみ）
//
// ⚠️ 編集は**すぐ下のカード**が担う（2026-08-16 に /profile/edit から /mypage へ移設）。
//    ここに編集導線を戻さないこと。同じページの中で入口が二重になる。

import { FollowCounts } from "@/components/profile/FollowCounts";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";
import { getUserAge } from "@/lib/age";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfileCardProps = {
  /* ⚠️ `userId` は 2026-08-16 に不要になった（右上の「公開」ボタンを外したため）。
     プロップは残す。呼び出し側は1箇所だけだが、公開ページへの導線を戻すときに要る。 */
  userId?: string;
  userName: string;
  userInitial: string;
  userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null;
  userAboutMe?: string | null;
  /** 生年月日（DATE 文字列 "YYYY-MM-DD"）。サーバ側で年齢計算に使用。NULL = 非公開 */
  userBirthDate?: string | null;
  /** social_links JSONB — SocialPlatform キー（"twitter" は E で "x" に移行済み）*/
  userSocialLinks?: Record<string, string> | null;
  /** フォロワー数 / フォロー中の数。0 の項目は出ない（FollowCounts 側で落とす） */
  followCounts?: { followers: number; following: number };
  isMentor: boolean;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MentorBadge() {
  return (
    <div
      style={{
        width: 20, height: 20,
        background: "linear-gradient(135deg, var(--royal), var(--accent))",
        borderRadius: "50%", border: "2px solid #fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
      </svg>
    </div>
  );
}

function MetaItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--ink-soft)" }}>
      {icon}
      {text}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfileCard({
  userName,
  userInitial,
  userAvatar,
  currentRole,
  userLocation,
  userAboutMe,
  userBirthDate,
  userSocialLinks,
  followCounts,
  isMentor,
}: UserProfileCardProps) {

  const initial = userInitial || userName?.charAt(0) || "?";

  // 年齢表示: birth_date をサーバ側で計算（NULL = 非公開）
  const age = getUserAge(userBirthDate);
  const ageDisplay = age !== null ? `${age}歳` : null;

  // アクティブな SNS のみ（SNS_PLATFORMS の順序を維持）
  const activeSocials = SNS_PLATFORMS.filter(
    (k) => userSocialLinks?.[k] && userSocialLinks[k]!.trim() !== ""
  );

  return (
    <div
      style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        position: "relative",
      }}
    >
      {/* ⚠️ **右上のボタン2つ（編集 / 公開）は 2026-08-16 に外した。**
             ・「編集」… このカードのすぐ下がインライン編集の本体になったので、
                        押しても同じページに留まるだけのボタンになっていた
             ・「公開」… タブ行の右端に「公開プロフィールを見る」がある。
                        同じ場所への入口を2つ並べない（`.claude/rules/ui-debugging.md` ⑧）
             ⚠️ 下の自己紹介・SNS の「追加する →」は残す。**別の場所（該当カード）へ
                案内するもの**で、上の2つとは役割が違う。 */}

      {/* ── アバター + 基本情報 ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
        {/* アバター */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: userAvatar,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 24, fontWeight: 700,
              border: "3px solid var(--line)",
            }}
          >
            {initial}
          </div>
          {isMentor && (
            <div style={{ position: "absolute", bottom: 0, right: 0 }}>
              <MentorBadge />
            </div>
          )}
        </div>

        {/* 名前・役職・メタ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 18, fontWeight: 700, color: "var(--ink)",
              fontFamily: "var(--font-noto-serif)",
            }}>
              {userName}
            </span>
            {isMentor && (
              <span style={{
                fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                color: "var(--royal)", background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                padding: "2px 8px", borderRadius: 100,
              }}>
                MENTOR
              </span>
            )}
          </div>
          {currentRole && (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
              {currentRole}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {ageDisplay && (
              <MetaItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                }
                text={ageDisplay}
              />
            )}
            {userLocation && (
              <MetaItem
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
                text={userLocation}
              />
            )}
            {/* フォロー数。年齢・所在地と同じメタ行に控えめに置く。
                名前・職種より下であることが条件（主役は経歴なので、
                数字が価値の代理指標に見えないようにする）。0 は出ない。 */}
            {followCounts && <FollowCounts counts={followCounts} />}
          </div>
        </div>
      </div>

      {/* ── About Me ─────────────────────────────────────────────────────── */}
      {userAboutMe ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            About Me
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
            {userAboutMe}
          </p>
        </div>
      ) : (
        <div style={{
          marginBottom: 16, padding: "12px 16px", borderRadius: 8,
          background: "var(--bg-tint)", border: "1px dashed var(--line)",
          fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", textAlign: "center",
        }}>
          {/* ⚠️ 「追加する →」のリンクを外した（2026-08-16）。移設後は**同じページ**を
                 指すだけの無反応なリンクになっていた。入力欄はすぐ下の
                 「基本情報」カードにある。 */}
          自己紹介はまだ登録されていません。下の「基本情報」から入力できます。
        </div>
      )}

      {/* ── SNS リンク（7種、アイコン横並び） ───────────────────────────── */}
      {activeSocials.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            リンク
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeSocials.map((platform) => {
              const url = userSocialLinks![platform]!;
              const label = SOCIAL_META[platform as SocialPlatform]?.label ?? platform;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="sns-icon-link"
                >
                  <SocialIcon platform={platform as SocialPlatform} variant="display" />
                </a>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
          {/* ⚠️ 同上。入力欄は下の「SNS・外部リンク」カードにある */}
          SNS リンクを追加すると企業の在籍ユーザーに見てもらえます。下の「SNS・外部リンク」から登録できます。
        </div>
      )}
    </div>
  );
}
