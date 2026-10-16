/**
 * ★「あなたに合う会社」の上段（提案）と下段（すべての会社）で**同じ見た目にする部品**（2026-10-15）。
 * ⚠️ 色や枠をどちらかのカードに直書きしないこと。片方だけ変わると、上下で違うものに見える。
 * ⚠️ クライアント部品からも読むので、サーバー専用のものを import しない。
 */

/** 理由（合っている点）の枠。緑は「プラスの一致」（ui-conventions の色の役割） */
export function ReasonBox({ items, state = "fit-reasons" }: { items: string[]; state?: string }) {
  if (items.length === 0) return null;
  return (
    <ul data-state={state} style={{
      listStyle: "none", margin: "10px 0 0", padding: "8px 12px", display: "grid", gap: 2,
      background: "#ECF6EF", border: "1px solid #D3E8DA", borderRadius: 8,
    }}>
      {items.map((r, i) => (
        <li key={`${i}-${r}`} style={{ fontSize: 13, lineHeight: 1.6, color: "#14532D" }}>✓ {r}</li>
      ))}
    </ul>
  );
}

/**
 * 「気をつけて見てほしいこと」。★中身が空なら枠ごと出さない（柴さんの指示）。
 * ⚠️ 「確かめられなかったこと」（提案の kind:'unknown'）はここに渡さない。注意点ではない
 */
export function CautionBox({ items, state = "fit-cautions" }: { items: string[]; state?: string }) {
  if (items.length === 0) return null;
  return (
    <div data-state={state} style={{ margin: "8px 0 0", padding: "8px 12px", background: "#FBF8F2", border: "1px solid #EADFC8", borderRadius: 8 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#8A6D3B" }}>気をつけて見てほしいこと</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((t, i) => <li key={`${i}-${t}`} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-soft)" }}>・{t}</li>)}
      </ul>
    </div>
  );
}

/** タグ（募集あり・フェーズ）の行。どれも無ければ出さない。⚠️「話を聞ける人」は 2026-10-16 に撤去した */
export function TagRow({ openJobs, phase }: { openJobs: boolean; phase: string | null }) {
  if (!openJobs && !phase) return null;
  return (
    <p style={{ margin: "8px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
      {openJobs && <Tag state="jobs">募集あり</Tag>}
      {phase && <Tag state="phase">{phase}</Tag>}
    </p>
  );
}

function Tag({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <span data-state={`fit-tag-${state}`} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--ink-soft)", background: "#fff" }}>
      {children}
    </span>
  );
}

/** 社名の横の小さなラベル（「担当者あり」「担当者未登録」「OPINIO からの提案」） */
export function NameLabel({ children, state, strong = false }: { children: React.ReactNode; state: string; strong?: boolean }) {
  return (
    <span data-state={state} style={{
      fontSize: 11, borderRadius: 999, padding: "0 8px", whiteSpace: "nowrap",
      border: strong ? "1px solid var(--royal)" : "1px solid var(--line)",
      color: strong ? "var(--royal)" : "var(--ink-soft)", fontWeight: strong ? 600 : 400,
    }}>
      {children}
    </span>
  );
}

/** カードの外枠 */
export const CARD_STYLE = { border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "#fff" } as const;

/** ボタン */
export const BTN = { fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", minHeight: 36 } as const;
