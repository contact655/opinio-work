/**
 * 空状態に出す「記入例」カード（ゴースト）。
 *
 * 「〜はまだ登録されていません」の代わりに、**何を書けばよいかが分かる例**を出す。
 * モック（docs/profile-edit-mock.html の `.ghost`）に合わせている。
 *
 * ⚠️ **実データと見間違えないこと。** 淡色＋破線＋「記入例」ラベルの3点を必ず保つ。
 *    片方の色だけ濃くする、ラベルを外す、といった改変をしない。
 * ⚠️ **1セクションにつき1枚まで。** 例を並べると空のときのほうが縦に長くなる。
 * ⚠️ 押せる要素を中に入れない。編集・削除があると本物と区別できなくなる。
 */
export function GhostExample({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        border: "1px dashed var(--line)",
        borderRadius: 10,
        padding: "12px 14px",
        background: "var(--bg-tint)",
        margin: "2px 0 6px",
      }}
    >
      <span style={{
        display: "inline-block", fontSize: 11, fontWeight: 600,
        color: "var(--ink-mute)", background: "var(--line-soft)",
        borderRadius: 5, padding: "1px 7px", marginBottom: 6,
      }}>
        記入例
      </span>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-mute)" }}>{line1}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", opacity: 0.75, marginTop: 2 }}>{line2}</div>
    </div>
  );
}
