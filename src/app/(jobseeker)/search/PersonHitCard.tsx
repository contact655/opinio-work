import Link from "next/link";
import Image from "next/image";
import type { PersonHit } from "@/lib/search/runSearch";
import { chipStyle } from "@/lib/utils/chipVariant";
import { FollowUserButton } from "../u/[id]/FollowUserButton";

/**
 * `/search` の人の行（2026-10-21 に1人1行へ作り直した / 柴さんの指示。LinkedIn の検索結果と同じ形）。
 *   [顔] 名前 / いまの所属 / 「現在: 会社 - 職種」or「以前: 会社 - 職種」   [フォロー]
 *
 * ⚠️ **`/people` のカードを流用していない。** `/search` は**全職歴**を対象にするので、
 *    なぜこの人が出たか（当たった職歴）を1行で必ず出す。**この行を消さないこと。**
 *    職歴の条件が無い（スキルなどで引いた）ときは、従来の理由（matchReason）を出す。
 * ⚠️ 年齢は出さない（`PersonHit` の型にも入れていない）。
 * ⚠️ フォローボタンは自分の行には出さない（`me` が null のときも出さない＝未ログイン）。
 *    ボタンを押してもカード全体のリンクが動かないよう、行はリンクとボタンを並べる形にしてある（入れ子にしない）。
 */
export function PersonHitCard({
  person, me, followed = false, followsMe = false,
}: {
  person: PersonHit;
  /** 見ている人の ow_users.id。未ログインは null */
  me?: string | null;
  followed?: boolean;
  followsMe?: boolean;
}) {
  const reasonLine = person.matched && (person.matched.company || person.matched.role)
    ? `${person.tenure === "former" ? "以前" : "現在"}: ${[person.matched.company, person.matched.role].filter(Boolean).join(" - ")}`
    : null;
  return (
    <div data-state="person-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
      <Link href={`/u/${person.userId}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        {person.avatarUrl ? (
          <Image src={person.avatarUrl} alt="" width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: person.gradient, color: "#fff", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 18 }}>
            {person.initial}
          </span>
        )}
        <span style={{ minWidth: 0, display: "block", flex: 1 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {person.name}
          </span>
          {/* 現在の所属。visibility_company が hidden なら null が来るので行ごと出さない */}
          {person.currentLabel && (
            <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {person.currentLabel}
            </span>
          )}
          {/* ★なぜ出たか。当たった職歴を「現在／以前」で1行に。無ければ従来の理由 */}
          {reasonLine ? (
            <span title={reasonLine} style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {reasonLine}
            </span>
          ) : person.matchReason && (
            /* ⚠️ 色は neutral 固定（chipVariant.ts） */
            <span title={person.matchReason} style={{
              display: "inline-block", marginTop: 6, padding: "3px 9px", borderRadius: 100,
              background: chipStyle("neutral").bg, color: chipStyle("neutral").color, border: `1px solid ${chipStyle("neutral").border}`,
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}>
              {person.matchReason}
            </span>
          )}
        </span>
      </Link>
      {me && me !== person.userId && (
        <div style={{ flexShrink: 0, paddingTop: 6 }}>
          <FollowUserButton targetUserId={person.userId} initialFollowed={followed} followsMe={followsMe} isAuthenticated compact />
        </div>
      )}
    </div>
  );
}
