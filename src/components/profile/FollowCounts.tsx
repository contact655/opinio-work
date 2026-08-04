import type { FollowCounts as Counts } from "@/lib/people/followCounts";

/**
 * フォロワー数 / フォロー中の数の表示。
 *
 * ⚠️ 0 の項目は出さない。両方 0 なら行ごと消える。
 *    実ユーザーが5名しかいない現状ではしばらく全員 0 で、
 *    「フォロワー 0」が並ぶのを避けるため（値が無いものを出さない原則）。
 *
 * ⚠️ 数字を強調しない。周りのメタ情報（年齢・所在地）と同じ大きさ・同じ色に揃え、
 *    数だけ少し太くする程度に留める。プロフィールの主役は経歴であって数字ではない。
 *    ここにリンクや「増やしましょう」の類の導線を足さないこと。
 */
export function FollowCounts({ counts }: { counts: Counts }) {
  const items = [
    { key: "followers", label: "フォロワー", value: counts.followers },
    { key: "following", label: "フォロー中", value: counts.following },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <>
      {items.map((i) => (
        <span
          key={i.key}
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--ink-soft)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{ fontWeight: 700, fontFamily: "var(--font-inter), sans-serif" }}>{i.value}</span>
          {i.label}
        </span>
      ))}
    </>
  );
}
