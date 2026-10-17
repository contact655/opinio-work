import type { PositionFitItem } from "@/lib/business/candidates/positionFitModel";

/**
 * ★右欄の「〈ポジション〉に対して」（2026-10-18 / ポジションで見る・段1）。
 *   一覧の上でポジションを選んでいるときだけ出す。合っているもの（✓）と足りないもの（灰色）を全部並べる。
 *   ⚠️ 点数・％は出さない。⚠️ 色は一覧のカードと同じ（緑＝合っている／灰色＝足りない。赤くしない）
 */
export function PositionFitBox({ title, items }: { title: string; items: PositionFitItem[] }) {
  return (
    <section data-state="position-fit" style={{ marginTop: 12, padding: "12px 12px 10px", borderRadius: 10, background: "#fff", border: "1px solid var(--royal-100)" }}>
      <h3 style={{ margin: "0 0 8px 2px", fontSize: 13, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>
        「{title}」に対して
      </h3>
      {items.length === 0 ? (
        <p style={{ margin: "0 2px", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          突き合わせられる情報がありません（求人に職種・勤務地・レベルを入れると比べられます）
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((x, i) => (
            <li key={`${x.item}:${i}`} data-position-item={x.ok ? "ok" : "gap"}
              style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 8px", borderRadius: 6, fontSize: 12.5, lineHeight: 1.6,
                background: x.ok ? "#ECF6EF" : "var(--bg-tint)", color: x.ok ? "#14532D" : "var(--ink-mute)" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, fontWeight: 700 }}>{x.ok ? "✓" : "–"}</span>
              <span style={{ flexShrink: 0, fontWeight: 700, minWidth: "4.5em" }}>{x.item}</span>
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{x.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
