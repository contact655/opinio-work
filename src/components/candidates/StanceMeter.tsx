import { CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";

/**
 * ★転職への意向のバッジ（2026-10-13 / ステップ4。柴さんの指示でモックに合わせた）。
 *   一覧のカード・右欄で**この1つだけ**を使う（それまでの「一覧の点1つ」「右欄の4段ドット」「絞り込みの3択」の3表現を1つに）。
 *   積極的に検討中（濃い）／いい話があれば聞きたい（中くらい）／情報収集として（薄い）。
 *
 * ⚠️★色だけでなく**明度**で区別できる配色（同じ青系の濃・中・淡）。赤・緑など評価に見える色は使わない
 *    （意向の強さは良し悪しではない）。文字とのコントラストはどれも 4.5 以上：
 *    #FFFFFF on #002366 = 14.7 ／ #0B2A66 on #C7D7F5 = 9.4 ／ #2C4373 on #F1F5FC = 8.9（背景の明るさ 0.02／0.67／0.91）
 * ⚠️ 回答なし・「今は考えていない」は何も出さない（その人は一覧に出ない）。
 * ⚠️ `short` は細いカード（一覧 420px 以下）用。元の表記は title に入れる。
 */
export const STANCE_BADGE: Record<string, { short: string; bg: string; fg: string; border: string }> = {
  active: { short: "積極的", bg: "#002366", fg: "#FFFFFF", border: "#002366" },
  open: { short: "話を聞く", bg: "#C7D7F5", fg: "#0B2A66", border: "#AFC4EE" },
  researching: { short: "情報収集", bg: "#F1F5FC", fg: "#2C4373", border: "#C9D5EC" },
};

export function StanceBadge({ stance, short = false }: { stance: string | null | undefined; short?: boolean }) {
  const b = stance ? STANCE_BADGE[stance] : undefined;
  const label = stance ? CAREER_STANCE_LABELS[stance] : undefined;
  if (!b || !label) return null;
  return (
    <span data-state="stance-badge" data-stance={stance} title={label}
      style={{
        display: "inline-flex", alignItems: "center", flexShrink: 0, height: 20, padding: "0 8px", borderRadius: 999,
        background: b.bg, color: b.fg, border: `1px solid ${b.border}`, fontSize: 11.5, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
      }}>
      {short ? b.short : label}
    </span>
  );
}
