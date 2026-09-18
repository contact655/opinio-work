/**
 * 根拠と反証の表示。**②と⑨で同じ部品を使う。**
 *
 * ⚠️★**反証を省略しないこと。** `counter` は必ず1件以上ある（DB の CHECK
 *    `counter_min_1` と `buildCounterEvidence` の両方が保証している）。
 *    `kind: "unknown"` は「確かめていない」で、**根拠が無いことの言い換えではない。**
 *
 * ⚠️★**スコア・%・星を出さない**（Hisato 思想⑦）。出すのは件数と文だけ。
 */

export type EvidenceView = { kind: string; n: number; k?: number; label: string };
export type CounterView = { kind: string; label: string };

/** ★1枚に出す根拠の上限。増やすと「根拠が多いほど良い」に見えてしまう */
export const MAX_EVIDENCE_SHOWN = 3;

export default function EvidenceList({
  evidence,
  counter,
}: {
  evidence: EvidenceView[];
  counter: CounterView[];
}) {
  const shown = evidence.slice(0, MAX_EVIDENCE_SHOWN);
  const rest = evidence.length - shown.length;

  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {shown.map((e, i) => (
          <li
            key={`${e.kind}-${i}`}
            style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 14, lineHeight: 1.7 }}
          >
            <span aria-hidden style={{ color: "var(--royal)", flexShrink: 0, marginTop: 1 }}>◆</span>
            <span>{e.label}</span>
          </li>
        ))}
      </ul>
      {/* ⚠️ 隠した件数は出す。黙って切らない */}
      {rest > 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 12px" }}>
          ほかに根拠が {rest} 件あります
        </p>
      )}

      {/* ── 反証。★必ず出す ───────────────────────────────────────────── */}
      <div
        style={{
          background: "#FBF8F2", border: "1px solid #EADFC8", borderRadius: 8,
          padding: "10px 12px", fontSize: 13, lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12, color: "#8A6D3B" }}>
          気をつけて見てほしいこと
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {counter.map((c, i) => (
            <li key={`${c.kind}-${i}`} style={{ padding: "2px 0" }}>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
