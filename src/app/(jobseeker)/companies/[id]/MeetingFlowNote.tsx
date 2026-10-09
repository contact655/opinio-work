/**
 * ★「申し込みの流れ」（カジュアル面談）。2026-10-09 に page.tsx から切り出した。
 *
 * ⚠️★**右の列と本文で同じ部品を使う。複製を作らないこと**（CompanyInfoBox と同じ理由）。
 *    右の列（Sidebar）は `hidden lg:flex` で 1023px 以下では消えるので、
 *    そこだけに置くと**スマホ・タブレットからは流れが一度も見えなかった。**
 *    本文側は中ほどの面談 CTA の中に `lg:hidden` 付きで置いてある。
 * ⚠️ 出すかどうか（`accepting_casual_meetings`）は呼び出し側が決める。ここで判定しない。
 * ⚠️ 中の見た目を変えると、右の列の見た目も変わる（それが目的。両方が同じであること）。
 */
export default function MeetingFlowNote() {
  return (
    <div
      style={{
        background: "var(--bg-tint)",
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        padding: "10px 14px",
      }}
    >
      <p style={{
        margin: 0,
        fontSize: 12, fontWeight: 500,
        color: "var(--ink-soft)",
        lineHeight: 1.6,
      }}>
        💬 気軽に話すだけでOK。選考なし・完全無料。
      </p>
      <p style={{
        margin: "4px 0 0",
        fontSize: 12, fontWeight: 500,
        color: "var(--ink-mute)",
        lineHeight: 1.5,
      }}>
        フォーム1分 → 担当者から連絡 → 日程調整 → 面談（約30分）
      </p>
    </div>
  );
}
