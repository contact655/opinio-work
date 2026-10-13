import { CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";

/**
 * ★転職への意向のバッジ（2026-10-13 / ステップ4。柴さんの指示でモックに合わせた）。
 *   一覧のカード・右欄で**この1つだけ**を使う（それまでの「一覧の点1つ」「右欄の4段ドット」「絞り込みの3択」の3表現を1つに）。
 *
 * ★色（2026-10-13 に変えた / 柴さんの指示）: 情報収集として＝灰 ／ いい話があれば聞きたい＝青 ／ 積極的に検討中＝濃い墨（塗り・白文字）。
 *   それまでは3つとも青の濃淡で、合う理由の行（royal-100）・選択中のカード（royal-50）と見分けにくかった。
 * ⚠️★積極的に検討中を橙にしない。ui-conventions で**橙はカジュアル面談の CTA だけ**の色（黄は注意・待ち、緑は金銭、紫は使わない）。
 *    目立たせ方は「いちばん暗い塗り」にした（色の意味を増やさない）。
 * ⚠️ 色だけでなく**明度**で区別できる（背景の明るさ 0.91 ／ 0.53 ／ 0.02）。文字のコントラストはどれも 4.5 以上:
 *    #475569 on #F1F5F9 = 6.92 ／ #172554 on #93C5FD = 8.15 ／ #FFFFFF on #1F2937 = 14.68
 * ⚠️ 回答なし・「今は考えていない」は何も出さない（その人は一覧に出ない）。
 * ⚠️ `short` は細いカード（一覧 420px 以下）用。元の表記は title に入れる。
 */
export const STANCE_BADGE: Record<string, { short: string; bg: string; fg: string; border: string }> = {
  active: { short: "積極的", bg: "#1F2937", fg: "#FFFFFF", border: "#1F2937" },
  open: { short: "話を聞く", bg: "#93C5FD", fg: "#172554", border: "#60A5FA" },
  researching: { short: "情報収集", bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1" },
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
