import React from "react";
import Link from "next/link";

/*
 * 自分のミニプロフィール＋つながりの数（2026-09-18）。
 * **`/feed` の左カラムと `/people` の左サイドバーが共有する。**
 *
 * ⚠️★**データ元は `lib/people/sidebarData.ts` の1本に揃えてある。**
 *    それまでフィードは `ow_experiences.role_title`（本人の自由入力）を出し、
 *    `/people` は `ow_companies.brand_name` ＋ `ow_roles.name`（マスタ）を出していて、
 *    **同じ人が「AE」と「Salesforce／新規事業開発」に分かれて見えていた**
 *    （2026-09-18 実測。同じ行の別々の列を読んでいた）。
 *    ⚠️ `role_title` に戻さないこと。粒度が人によってばらつく（本番は null 3件 / 長文5件）。
 *
 * ⚠️★**数字は 0 でも出す。** 「フォローしてみましょう」等の誘導文に置き換えない
 *    （2026-09-18 / 柴さんの指示）。
 *    ⚠️ `lib/people/followCounts.ts` の JSDoc にある「0 のときは項目ごと出さない」は
 *       **`/u/[id]` と `/mypage` のメタ行の話**。ここは別の判断。
 *
 * ⚠️★**%（完成度）を出さないこと。** 完成度バーは 2026-08-16 に廃止、
 *    2026-09-10 に「%も『あと N 項目』も出さない」と決めてある。`nextStep` は**次の1件だけ**。
 *
 * ⚠️ 数字の行き先は**どちらのページからでも `/people` の絞り込み**に揃える。
 *    フィード側に別の一覧を作らないこと。
 */

export type ProfileCardData = {
  me: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    gradient: string;
    initial: string;
    /** 「会社 ／ 職種」。⚠️ 値が無ければ行ごと出さない */
    affiliation: string | null;
  };
  counts: { following: number; followers: number; companies: number };
  nextStep: { label: string; href: string } | null;
};

/** いま効いている関係の絞り込み。`/people` だけが渡す（フィードは常に undefined） */
export type ProfileCardProps = ProfileCardData & {
  activeRel?: string;
  /** カードの見た目。`sidebar` は角丸カード、`plain` は枠なし（フィードの左カラム用） */
  variant?: "card" | "plain";
  /**
   * ★ミニプロフィールと「次に埋める1件」だけを包む class（2026-09-18）。
   *
   * ⚠️★**数字（フォロー中／フォロワー）はここに含めない。** `/people` は狭い画面で
   *    上の2つを畳むが、**数字と「面談OKだけ見る」は畳まずに見せる**約束になっている。
   *    まとめて畳める形にすると、その約束が守れない。
   */
  topClassName?: string;
};

/** 押すと `/people` がその人たちだけに絞られる。⚠️ 既に効いていれば外す href にする */
function relHref(rel: string, active: boolean): string {
  return active ? "/people" : `/people?rel=${rel}`;
}

export function ProfileCard({ me, counts, nextStep, activeRel, variant = "card", topClassName }: ProfileCardProps) {
  const box = variant === "card"
    ? { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }
    : { padding: 0 };

  return (
    <div>
      <style>{`
        .pc-count {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 7px 8px; border-radius: 7px; text-decoration: none;
          font-size: 13px; color: var(--ink-soft);
        }
        .pc-count:hover { background: var(--bg-tint); color: var(--royal); }
        .pc-count.active { background: var(--royal-50); color: var(--royal); font-weight: 700; }
        .pc-count-n {
          flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--ink);
          font-family: var(--font-inter), var(--font-noto);
        }
        .pc-count.active .pc-count-n { color: var(--royal); }
        .pc-link { font-size: 12px; color: var(--royal); text-decoration: none; font-weight: 600; }
      `}</style>

      <div className={topClassName}>
      <div style={{ ...box, marginBottom: 10, textAlign: "center" }}>
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" width={44} height={44}
            style={{ borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto" }} />
        ) : (
          <div aria-hidden style={{
            width: 44, height: 44, borderRadius: "50%", background: me.gradient,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 700, margin: "0 auto",
          }}>{me.initial}</div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 8, overflowWrap: "anywhere" }}>
          {me.name}
        </div>
        {/* ⚠️ 値が無ければ行ごと出さない（「未登録」等で埋めない） */}
        {me.affiliation && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.6, overflowWrap: "anywhere" }}>
            {me.affiliation}
          </div>
        )}
        <Link href={`/u/${me.userId}`} className="pc-link" style={{ display: "inline-block", marginTop: 10 }}>
          プロフィールを見る
        </Link>
      </div>

      {/* ⚠️ %も件数も出さない（冒頭の注記）。埋まっていればブロックごと出ない */}
      {nextStep && (
        <div style={{ ...box, marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 8 }}>
            入力すると他のユーザーに経歴が伝わります。
          </div>
          <Link href={nextStep.href} className="pc-link">{nextStep.label}</Link>
        </div>
      )}
      </div>

      <div style={box}>
        {/* ⚠️ 0 でも「0人」と出す（冒頭の注記） */}
        <Link href={relHref("following", activeRel === "following")} scroll={false}
          className={`pc-count${activeRel === "following" ? " active" : ""}`}>
          <span>フォロー中</span><span className="pc-count-n">{counts.following}人</span>
        </Link>
        <Link href={relHref("followers", activeRel === "followers")} scroll={false}
          className={`pc-count${activeRel === "followers" ? " active" : ""}`}>
          <span>フォロワー</span><span className="pc-count-n">{counts.followers}人</span>
        </Link>
        {/* ⚠️ 企業は `/people`（人の一覧）では絞り込めない。既存の一覧ページへ送る */}
        <Link href="/mypage/follows" className="pc-count">
          <span>フォロー中の企業</span><span className="pc-count-n">{counts.companies}社</span>
        </Link>
      </div>
    </div>
  );
}

export default ProfileCard;
