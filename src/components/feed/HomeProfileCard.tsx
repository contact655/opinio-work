import Link from "next/link";
import type { ProfileCardData } from "@/components/common/ProfileCard";
import { RAIL_BOX_STYLE } from "@/components/feed/railKit";
import { talkCapacityShortLabel, type TalkCapacity } from "@/lib/constants/talk";
import { CAREER_NEXT_STEP_HREF } from "@/lib/home/homeState";

/**
 * ★ホームの左の列のカード（2026-11-04 / 柴さんの指示）。
 *   それまでの3つの箱（プロフィール／数字／マイページ・ブックマークのリンク）を1枚にまとめた。
 *   枠・角・余白は右の列の箱（railKit の RAIL_BOX_STYLE）と同じ。
 *
 * 上から: 薄い色の帯（顔写真が帯にかかる）→ 名前 → 肩書き1行（現職の「職種・会社名」。職歴0件なら「職歴を入れる」）
 *        → プロフィールを見る → 数字の行（行全体を押すとその一覧へ）→ 話を聞ける：◯◯・設定する
 *
 * ⚠️ 数字は 0 でも出す（ProfileCard と同じ判断）。行き先も ProfileCard と同じにそろえてある。片方だけ変えないこと
 * ⚠️ フォロワーの一覧（/people?rel=followers）は閲覧者自身のフォロワーしか出さない作り（/people/page.tsx が自分の id で引く）
 * ⚠️ 「マイページ」「ブックマーク」のリンクは戻さない（数字の行とヘッダーのメニューで足りる）
 * ⚠️ /people の左サイドバーは従来の ProfileCard のまま（このカードはホームと検索結果の左の列だけ）
 */

export type HomeProfileCardData = Pick<ProfileCardData, "counts"> & {
  me: ProfileCardData["me"] & { roleName: string | null; companyLabel: string | null };
  experienceCount: number;
  /** 話せる量。取得できなければ null（その行ごと出さない） */
  talkCapacity: TalkCapacity | null;
};

const BAND_HEIGHT = 56;
const AVATAR = 64;

/** 現職の「職種・会社名」。どちらか片方だけでも出す。両方無ければ null */
export function homeProfileTitle(roleName: string | null, companyLabel: string | null): string | null {
  return [roleName, companyLabel].filter(Boolean).join("・") || null;
}

export function HomeProfileCard({ me, counts, experienceCount, talkCapacity }: HomeProfileCardData) {
  const title = homeProfileTitle(me.roleName, me.companyLabel);
  const rows: { href: string; label: string; value: string; state: string }[] = [
    { href: "/people?rel=following", label: "フォロー中", value: `${counts.following}人`, state: "home-count-following" },
    { href: "/people?rel=followers", label: "フォロワー", value: `${counts.followers}人`, state: "home-count-followers" },
    { href: "/mypage/follows", label: "フォロー中の企業", value: `${counts.companies}社`, state: "home-count-companies" },
    /* ⚠️ 募集は「保存」（♡）。「フォロー中の募集」と書かない（ProfileCard と同じ） */
    { href: "/mypage/bookmarks", label: "保存した募集", value: `${counts.savedJobs}件`, state: "home-count-saved-jobs" },
  ];

  return (
    <section data-state="home-profile-card" style={{ ...RAIL_BOX_STYLE, padding: 0, overflow: "hidden", width: 320 }}>
      <style>{`
        .hpc-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 18px; text-decoration: none; font-size: 13px; color: var(--ink-soft); }
        .hpc-row:hover { background: var(--bg-tint); color: var(--royal); }
        .hpc-n { flex-shrink: 0; font-weight: 700; color: var(--ink); font-family: var(--font-inter), var(--font-noto); }
        .hpc-link { font-size: 12px; font-weight: 600; color: var(--royal); text-decoration: none; }
        .hpc-link:hover { text-decoration: underline; }
      `}</style>

      {/* 薄い色の帯。顔写真は帯の下端にかかる */}
      <div aria-hidden style={{ height: BAND_HEIGHT, background: "linear-gradient(135deg, var(--royal-50), var(--royal-100))" }} />
      <div style={{ padding: "0 18px 14px", textAlign: "center" }}>
        <div style={{ marginTop: -AVATAR / 2, display: "flex", justifyContent: "center" }}>
          {me.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl} alt="" width={AVATAR} height={AVATAR}
              style={{ width: AVATAR, height: AVATAR, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid #fff", background: "#fff" }} />
          ) : (
            <div aria-hidden style={{
              width: AVATAR, height: AVATAR, borderRadius: "50%", background: me.gradient, border: "3px solid #fff",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700,
            }}>{me.initial}</div>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 8, overflowWrap: "anywhere" }}>{me.name}</div>
        {/* 肩書き1行。⚠️ 職歴0件なら「職歴を入れる」。職歴はあるが現職が無い人は行ごと出さない（推測で埋めない） */}
        {experienceCount === 0 ? (
          <Link href={CAREER_NEXT_STEP_HREF} className="hpc-link" data-state="home-profile-add-career"
            style={{ display: "inline-block", marginTop: 4 }}>職歴を入れる</Link>
        ) : title ? (
          <div data-state="home-profile-title" title={title}
            style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
        ) : null}
        <div style={{ marginTop: 10 }}>
          <Link href={`/u/${me.userId}`} className="hpc-link">プロフィールを見る</Link>
        </div>
      </div>

      {/* 数字の行。⚠️ 0 でも出す */}
      <div style={{ borderTop: "1px solid var(--line)", padding: "6px 0" }}>
        {rows.map((r) => (
          <Link key={r.href} href={r.href} className="hpc-row" data-state={r.state}>
            <span>{r.label}</span><span className="hpc-n">{r.value}</span>
          </Link>
        ))}
      </div>

      {talkCapacity && (
        <div data-state="home-profile-talk" style={{ borderTop: "1px solid var(--line)", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", minWidth: 0 }}>
            話を聞ける：<span style={{ fontWeight: 700, color: "var(--ink)" }}>{talkCapacityShortLabel(talkCapacity)}</span>
          </span>
          <Link href="/mypage/settings#talk-settings" className="hpc-link" style={{ flexShrink: 0 }}>設定する</Link>
        </div>
      )}
    </section>
  );
}
