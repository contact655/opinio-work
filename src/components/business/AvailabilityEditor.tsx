"use client";

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
const TIMES = ["朝（9〜12時）", "昼（12〜15時）", "夕方（15〜18時）", "夜（18〜21時）"];

type Props = {
  days: string[];
  times: string[];
  notes: string;
  onChange: (
    field: "availability_days" | "availability_times" | "availability_notes",
    value: string[] | string
  ) => void;
};

export function AvailabilityEditor({ days, times, notes, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
          受付曜日
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAYS.map((d) => {
            const sel = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  onChange(
                    "availability_days",
                    sel ? days.filter((x) => x !== d) : [...days, d]
                  )
                }
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: sel ? 700 : 400,
                  border: `1.5px solid ${sel ? "var(--royal)" : "var(--line)"}`,
                  background: sel ? "var(--royal)" : "#fff",
                  color: sel ? "#fff" : "var(--ink-soft)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
          受付時間帯
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TIMES.map((t) => {
            const sel = times.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  onChange(
                    "availability_times",
                    sel ? times.filter((x) => x !== t) : [...times, t]
                  )
                }
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: sel ? 700 : 400,
                  border: `1.5px solid ${sel ? "var(--royal)" : "var(--line)"}`,
                  background: sel ? "var(--royal)" : "#fff",
                  color: sel ? "#fff" : "var(--ink-soft)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
          補足コメント（任意）
        </div>
        <textarea
          value={notes}
          onChange={(e) => onChange("availability_notes", e.target.value)}
          placeholder="例：週2〜3回程度、30分カジュアルに話せます"
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 13,
            border: "1.5px solid var(--line)",
            borderRadius: 8,
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            color: "var(--ink)",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
