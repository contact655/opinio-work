import Link from "next/link";
import { FollowCounts } from "@/components/profile/FollowCounts";
import { ProfileSocialLinks } from "./ProfileSections";
import type { CareerEntry } from "@/components/profile/MergedTimeline";
import type { FollowCounts as Counts } from "@/lib/people/followCounts";

/** 会社名から法人格プレフィックス・サフィックスを除去して短縮名を返す。
    ⚠️ `u/[id]/page.tsx` にあった同名関数をそのまま移した（呼び出し側は消してある） */
export function shortCompanyName(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim() || name;
}

/**
 * プロフィールのヘッダー（カバー＋アバター＋名前＋現職＋メタ行＋SNS）。
 *
 * ⚠️ **`u/[id]/page.tsx` に直書きされていた160行をそのまま移した**（2026-08-16 / 2-7）。
 *    `/mypage` と `/u/[id]` の**両方**がこれを使う。同じ見た目を2箇所に書かない。
 *
 * ⚠️ 右上（`topRight`）と右側の CTA 群（`actions`）だけがページごとに違う。
 *    `/u/[id]` は共有ボタンとフォロー・DM・カジュアル面談、`/mypage` は鉛筆だけ。
 *
 * ⚠️ **現職・年齢は導出値**（職歴と生年月日から作る）なので、ここには編集導線を置かない。
 */
export function ProfileHeader({
  name, headline, initial, avatarUrl, avatarColor, coverPhotoUrl, coverColor,
  ageDisplay, location, followCounts, socialLinks,
  currentCareer, isCurrentCompanyKnown,
  topRight, actions, promos,
}: {
  name: string;
  headline?: string | null;
  initial: string;
  avatarUrl?: string | null;
  avatarColor: string;
  coverPhotoUrl?: string | null;
  coverColor: string;
  /** 「32歳」。生年月日が無ければ null（**空欄も既定値も出さない**） */
  ageDisplay?: string | null;
  location?: string | null;
  followCounts: Counts;
  socialLinks: Record<string, string> | null;
  /** 現職。無ければ null */
  currentCareer?: CareerEntry | null;
  /** 現職の企業がマスタにあり、企業ページへのリンクを張ってよいか */
  isCurrentCompanyKnown?: boolean;
  /** カバー右上。`/u/[id]` は共有ボタン、`/mypage` は鉛筆 */
  topRight?: React.ReactNode;
  /** 右側の CTA 群。`/mypage` は渡さない（フォロー・DM・カジュアル面談・共有は本人には要らない） */
  actions?: React.ReactNode;
  /** SNS の下に出す促し。`/mypage` だけ */
  promos?: React.ReactNode;
}) {
  return (
    <>
  {/* ⚠️ **モバイル調整はこの部品が持つ**（2026-08-16 に `u/[id]/page.tsx` から移設）。
         ページ側に置くと、同じ部品を使うもう一方（`/mypage`）に効かない。
         実際そうなっていて、`/mypage` だけカバー200px・アバター120px・名前30px だった。
      ⚠️ 子孫セレクタの記号と引用符を使わない（hydration mismatch になる）。 */}
  <style>{`
    @media (max-width: 960px) {
      .profile-cover { height: 140px !important; }
      .profile-avatar { width: 88px !important; height: 88px !important; font-size: 32px !important; }
      .profile-avatar-wrap { margin-top: -44px !important; }
      .profile-name { font-size: 22px !important; }
      .profile-header-body { padding: 0 20px 24px !important; }
    }
  `}</style>
  {/* Cover + Avatar header — full width above grid */}
  <div style={{
    background: "#fff", border: "1px solid var(--line)",
    borderRadius: 16, overflow: "hidden", marginBottom: "var(--space-6)",
  }}>
    {/* Cover area: photo or gradient */}
    <div className="profile-cover" style={{ height: 200, position: "relative", background: coverPhotoUrl ? undefined : coverColor, overflow: "hidden" }}>
      {coverPhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPhotoUrl}
          alt=""
          loading="eager"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {/* Subtle dot pattern overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />
      {/* Bottom fade gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
        background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.25))",
      }} />
    </div>

    <div className="profile-header-body" style={{ padding: "0 32px 32px", marginTop: -60, position: "relative" }}>
      {/* Share button — absolute top-right */}
      <div style={{ position: "absolute", top: 16, right: 24, zIndex: 10 }}>
        {topRight}
      </div>
      {/* Avatar: photo or gradient letter */}
      <div className="profile-avatar profile-avatar-wrap" style={{
        width: 120, height: 120, borderRadius: "50%",
        background: avatarUrl ? undefined : avatarColor,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 42, fontWeight: 600,
        border: "5px solid #fff",
        boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
        marginBottom: "var(--space-3)", position: "relative",
        overflow: avatarUrl ? "hidden" : "visible",
      }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            loading="eager"
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : initial}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div>
          <div className="profile-name" style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: 30, fontWeight: 700, color: "var(--ink)",
            marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {name}
          </div>
          {/* 肩書き1行。⚠️ 空なら何も出さない（空欄も既定文言も出さない）。 */}
          {headline && (
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--ink-soft)",
              marginBottom: 8, lineHeight: 1.6,
            }}>
              {headline}
            </div>
          )}
          {/* Current role subtitle */}
          {currentCareer && (
            <div style={{ marginBottom: "var(--space-2)", lineHeight: 1.5 }}>
              <span className="u-role-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                {currentCareer.role_title || currentCareer.role_label}
              </span>
              {currentCareer.role_title && currentCareer.role_title !== currentCareer.role_label && (
                <span style={{ fontSize: 13, color: "var(--ink-mute)", marginLeft: 6 }}>({currentCareer.role_label})</span>
              )}
              {currentCareer.company_name && isCurrentCompanyKnown && (
                <> <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>@</span>{" "}
                <Link href={`/companies/${currentCareer.company_id!}`} style={{ fontSize: 14, color: "var(--royal)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--royal-100)" }}>{shortCompanyName(currentCareer.company_name)}</Link></>
              )}
              {currentCareer.company_name && !isCurrentCompanyKnown &&
                currentCareer.company_name !== "不明な企業" &&
                currentCareer.company_name !== "非公開企業" &&
                currentCareer.company_name !== "非公開" && (
                <span style={{ fontSize: 14, color: "var(--ink-soft)" }}> @ {shortCompanyName(currentCareer.company_name)}</span>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            {ageDisplay && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                </svg>
                {ageDisplay}
              </span>
            )}
            {location && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </span>
            )}
            {/* フォロー数。年齢・所在地と同じ控えめなメタ行に置く。
                名前・職種・所属より下であることが条件（主役は経歴なので、
                数字が価値の代理指標に見えないようにする）。0 は出ない。 */}
            <FollowCounts counts={followCounts} />
          </div>
          <ProfileSocialLinks socialLinks={socialLinks} />
          {promos}
        </div>
        {actions}
      </div>
    </div>
  </div>
    </>
  );
}
