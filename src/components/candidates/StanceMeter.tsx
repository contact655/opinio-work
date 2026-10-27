import { CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";

/**
 * ★転職への意向のバッジ（2026-10-13 / ステップ4。柴さんの指示でモックに合わせた）。
 *   一覧のカード・右欄で**この1つだけ**を使う（それまでの「一覧の点1つ」「右欄の4段ドット」「絞り込みの3択」の3表現を1つに）。
 *
 * ★色（2026-10-13 に変えた / 柴さんの指示）: 情報収集として＝灰 ／ いい話があれば聞きたい＝青 ／ 積極的に検討中＝濃い墨（塗り・白文字）。
 *   それまでは3つとも青の濃淡で、合う理由の行（royal-100）・選択中のカード（royal-50）と見分けにくかった。
 * ⚠️★積極的に検討中を橙にしない。ui-conventions で**橙はカジュアル面談の CTA だけ**の色（黄は注意・待ち、緑はプラスの一致、紫は使わない）。
 *    目立たせ方は「いちばん暗い塗り」にした（色の意味を増やさない）。
 * ⚠️ 色だけでなく**明度**で区別できる（背景の明るさ 0.91 ／ 0.53 ／ 0.02）。文字のコントラストはどれも 4.5 以上:
 *    #475569 on #F1F5F9 = 6.92 ／ #172554 on #93C5FD = 8.15 ／ #FFFFFF on #1F2937 = 14.68
 * ⚠️ 回答なし・「今は考えていない」は何も出さない（その人は一覧に出ない）。
 * ⚠️ `short` は 2026-10-28 から使っていない（短い表記をやめ、3つの言葉そのものを出す）。呼び出し側に残っていても無視する。
 */
/* ★短い表記に「転職：」を付けた（2026-10-18 / 柴さんの指摘）。「話を聞く」だけだと、何についての札か
      （転職への意向なのか、面談を受けるのか）が分からなかった。⚠️ 撤去した「面談OK（話を聞ける人）」と紛らわしいので
      「話を聞く」に戻さないこと */
/* ★2026-10-28: 短い表記も3つの言葉そのものにした（柴さんの指示。カード・詳細・絞り込み・設定画面で同じ言葉）。
      言葉は CAREER_STANCE_LABELS の1か所。ここに書き写さない（short は色だけを持つ） */
export const STANCE_BADGE: Record<string, { bg: string; fg: string; border: string }> = {
  active: { bg: "#1F2937", fg: "#FFFFFF", border: "#1F2937" },
  open: { bg: "#93C5FD", fg: "#172554", border: "#60A5FA" },
  researching: { bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1" },
};

/**
 * @param short 【2026-10-28 から無視】以前の短い表記（転職：積極的 など）。いまはカードも右欄も同じ言葉
 * @param plain 枠線なしの塗りの札（2026-10-13 / 改修モックに合わせた）。★一覧のカードと右欄の名前の行の両方で使う
 *   （2026-10-13 柴さん判断で変更：右欄も枠線なしに揃えた。理由: 同じものが2つの見た目にならないように）。枠線ありは今は使っていない
 */
export function StanceBadge({ stance, plain = false }: { stance: string | null | undefined; short?: boolean; plain?: boolean }) {
  const b = stance ? STANCE_BADGE[stance] : undefined;
  const label = stance ? CAREER_STANCE_LABELS[stance] : undefined;
  if (!b || !label) return null;
  return (
    <span data-state="stance-badge" data-stance={stance} title={label}
      style={{
        display: "inline-flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap", fontWeight: 700, lineHeight: 1,
        background: b.bg, color: b.fg,
        ...(plain
          ? { height: 18, padding: "0 7px", borderRadius: 4, border: "none", fontSize: 11 }
          : { height: 20, padding: "0 8px", borderRadius: 999, border: `1px solid ${b.border}`, fontSize: 11.5 }),
      }}>
      {label}
    </span>
  );
}
