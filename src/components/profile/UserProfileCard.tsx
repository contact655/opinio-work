// UserProfileCard — /mypage ダッシュボード表示専用カード
// ν-8 段階6-1 コミット D: 編集ロジック全削除、SNS 7種化、スキルタグ追加、編集導線追加
// 編集は /profile/edit を正とし、このコンポーネントは表示のみ担当する。

import Link from "next/link";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";
import { getUserAge } from "@/lib/age";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfileCardProps = {
  userId: string;
  userName: string;
  userInitial: string;
  userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null;
  userAboutMe?: string | null;
  /** 生年月日（DATE 文字列 "YYYY-MM-DD"）。サーバ側で年齢計算に使用 */
  userBirthDate?: string | null;
  /** age_range（B-3 で削除予定。birth_date がある場合は使用しない） */
  userAgeRange?: string | null;
  userFutureAspirations?: string | null;
  /** social_links JSONB — SocialPlatform キー（"twitter" は E で "x" に移行済み）*/
  userSocialLinks?: Record<string, string> | null;
  /** ow_user_skill_tags — sort_order 昇順 */
  userSkillTags?: { id: string; label: string; sort_order: number }[];
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
  userAgeRange,
  userFutureAspirations,
  userSocialLinks,
  userSkillTags = [],
  isMentor,
}: UserProfileCardProps) {

  const initial = userInitial || userName?.charAt(0) || "?";

  // 年齢表示: birth_date 優先（サーバ側計算）、フォールバックは age_range（B-3 で削除予定）
  const age = getUserAge(userBirthDate);
  const ageDisplay = age !== null
    ? `${age}歳`
    : userAgeRange && userAgeRange !== "非公開"
      ? userAgeRange
      : null;

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
      {/* ── 編集導線（右上） ─────────────────────────────────────────────── */}
      <Link
        href="/profile/edit"
        style={{
          position: "absolute", top: 20, right: 20,
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, fontWeight: 600, color: "var(--royal)",
          textDecoration: "none", opacity: 0.85,
          padding: "5px 10px", borderRadius: 8,
          border: "1px solid var(--royal-100)",
          background: "var(--royal-50)",
          transition: "opacity 0.15s",
        }}
        aria-label="プロフィールを編集"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        プロフィールを編集
      </Link>

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
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
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
          </div>
        </div>
      </div>

      {/* ── About Me ─────────────────────────────────────────────────────── */}
      {userAboutMe ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
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
          fontSize: 12, color: "var(--ink-mute)", textAlign: "center",
        }}>
          自己紹介が未設定です。
          <Link href="/profile/edit" style={{ color: "var(--royal)", marginLeft: 6, fontWeight: 600 }}>
            追加する →
          </Link>
        </div>
      )}

      {/* ── 将来の展望 ───────────────────────────────────────────────────── */}
      {userFutureAspirations && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            将来の展望
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
            {userFutureAspirations}
          </p>
        </div>
      )}

      {/* ── スキルタグ ───────────────────────────────────────────────────── */}
      {userSkillTags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            スキル
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {userSkillTags.map((tag) => (
              <span
                key={tag.id}
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "4px 10px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  fontSize: 12, color: "var(--royal)", fontWeight: 500,
                }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── SNS リンク（7種、アイコン横並び） ───────────────────────────── */}
      {activeSocials.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
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
        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
          SNS リンクを追加すると企業やメンターに見てもらえます。{" "}
          <Link href="/profile/edit?tab=socials" style={{ color: "var(--royal)", fontWeight: 600 }}>
            追加する →
          </Link>
        </div>
      )}
    </div>
  );
}
