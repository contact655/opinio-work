"use client";

import type React from "react";
import { MILESTONE_EVENT_MAX, MILESTONES_MAX, type MilestoneInput } from "@/lib/companies/milestones";

/**
 * ★これまでの歩みの入力欄（2026-11-27）。/biz/company と /admin/companies/[id] で同じ部品を使う。
 *   1行＝年（4桁）・月（任意）・出来事。並べ替えは保存時に年月順にする（企業ページも年月順に出す）。
 * ⚠️ 検証は保存側（lib/companies/milestones.ts の parseMilestones）。ここは入力を受けるだけ。
 */
export function MilestonesEditor({ value, onChange, idPrefix }: {
  value: MilestoneInput[];
  onChange: (next: MilestoneInput[]) => void;
  idPrefix: string;
}) {
  const set = (i: number, patch: Partial<MilestoneInput>) => onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const input: React.CSSProperties = {
    padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 16, background: "#fff", color: "var(--ink)", minWidth: 0,
  };
  return (
    <div data-state="milestones-editor">
      {value.length === 0 && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-mute)" }}>まだ登録されていません。</p>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {value.map((m, i) => (
          <div key={i} className="ms-row">
            <input id={`${idPrefix}-year-${i}`} aria-label={`${i + 1}件目の年`} inputMode="numeric" placeholder="年（例: 2017）"
              value={m.year} onChange={(e) => set(i, { year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })} style={input} />
            <select aria-label={`${i + 1}件目の月`} value={m.month} onChange={(e) => set(i, { month: e.target.value })} style={input}>
              <option value="">月</option>
              {Array.from({ length: 12 }, (_, k) => <option key={k + 1} value={String(k + 1)}>{k + 1}月</option>)}
            </select>
            <input className="ms-event" aria-label={`${i + 1}件目の出来事`} placeholder="出来事（例: 創業）" maxLength={MILESTONE_EVENT_MAX}
              value={m.event} onChange={(e) => set(i, { event: e.target.value })} style={input} />
            <button type="button" className="ms-del" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`${i + 1}件目を削除`}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, cursor: "pointer" }}>
              削除
            </button>
          </div>
        ))}
      </div>
      {value.length < MILESTONES_MAX && (
        <button type="button" onClick={() => onChange([...value, { year: "", month: "", event: "" }])}
          style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--line)", background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ＋ 出来事を追加
        </button>
      )}
      {/* ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（サーバーが実体参照に変えてハイドレーションが壊れる。2026-11-27 に踏んだ） */}
      <style>{`
        .ms-row { display: grid; grid-template-columns: 84px 76px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
        @media (max-width: 640px) {
          .ms-row { grid-template-columns: 84px 76px minmax(0, 1fr); }
          .ms-event { grid-column: 1 / -1; grid-row: 2; }
          .ms-del { grid-column: 3; grid-row: 1; justify-self: end; }
        }
      `}</style>
    </div>
  );
}
