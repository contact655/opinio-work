/**
 * ★転職への意向の目印（2026-10-12 / 柴さんの指示。候補者を探すの一覧と右欄）。
 *   ●●●● 積極的に検討中（濃い青）／●●●○ いい話があれば聞きたい（青）／●●○○ 情報収集として（薄い青）。
 *   回答なし・「今は考えていない」は何も出さない（その人は一覧に出ない）。
 *
 * ⚠️★赤・緑など評価に見える色を使わない（意向の強さは良し悪しではない）。同じ青系の濃淡だけ。
 * ⚠️ 色は白背景で 3:1 以上（図形の基準）。#002366 14.7 ／ #3B6FD8 4.7 ／ #5B84D6 3.7（選択中のカードの背景 #EFF3FC でも 3.3）。
 *    薄くする場合は数え直すこと。空の点（#CBD5E1）は飾りで、意味は塗った数と横の文字が持つ。
 * ⚠️ 文字はグレーのまま（色で状態を強く見せない。バッジにしない）。
 */
export const STANCE_LEVELS: Record<string, { filled: number; color: string }> = {
  active: { filled: 4, color: "#002366" },
  open: { filled: 3, color: "#3B6FD8" },
  researching: { filled: 2, color: "#5B84D6" },
};
const EMPTY = "#CBD5E1";

/** 4つの点（右欄）。意向が無い・知らない値なら何も出さない */
export function StanceMeter({ stance, size = 7 }: { stance: string | null | undefined; size?: number }) {
  const lv = stance ? STANCE_LEVELS[stance] : undefined;
  if (!lv) return null;
  return (
    <span aria-hidden="true" data-state="stance-meter" data-stance={stance} style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: "50%", background: i < lv.filled ? lv.color : EMPTY, display: "inline-block" }} />
      ))}
    </span>
  );
}

/** 小さな点1つ（一覧のカード。意向の文字の前） */
export function StanceDot({ stance, size = 7 }: { stance: string | null | undefined; size?: number }) {
  const lv = stance ? STANCE_LEVELS[stance] : undefined;
  if (!lv) return null;
  return <span aria-hidden="true" data-state="stance-dot" data-stance={stance} style={{ width: size, height: size, borderRadius: "50%", background: lv.color, display: "inline-block", flexShrink: 0 }} />;
}
