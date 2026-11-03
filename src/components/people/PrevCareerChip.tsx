"use client";

import type { PathsOption, PathsStartView } from "@/lib/paths/server";
import { prevCareerText, prevSelectionOf, type PrevSelection } from "@/lib/people/prevCareer";

/**
 * ★/people の「前の経歴」チップ（2026-11-03。旧 /paths の起点の選択欄）。職種・業界・会社。
 * ⚠️ 会社を選んだら業界は外す（会社が業界を決める）。業界の欄は会社を選んでいる間は使えない。
 * ⚠️ 値は URL だけが持つ（onChange で親が prev_* を書き換える）。画面の state に持たない。
 * ⚠️ メニューの位置は CSS（.fc-menu）。スマホでは下から出るシートになる。位置をインラインに書かないこと。
 */
export function PrevCareerChip({
  options, selected, activeLabel, selfStart, isOpen, onToggle, onChange,
}: {
  options: { roles: PathsOption[]; industries: PathsOption[]; companies: PathsOption[] };
  selected: PrevSelection;
  /** 選択中の表示（「営業 × IT・インターネット」）。未選択なら null */
  activeLabel: string | null;
  /** 本人の直近の職歴から作った起点（作れなければ null） */
  selfStart: PathsStartView | null;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: PrevSelection) => void;
}) {
  const active = !!activeLabel;
  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 14, color: "var(--ink)", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={onToggle} data-state={active ? "prev-career-chip-active" : "prev-career-chip"}
        className={`ppl-chip${active ? " active" : ""}`} aria-expanded={isOpen}
        style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }} title={activeLabel ?? undefined}>
        {active ? `前の経歴: ${activeLabel}` : "前の経歴"}
        {active ? (
          <span role="button" aria-label="前の経歴を外す" style={{ fontSize: 12, opacity: 0.85, marginLeft: 4 }}
            onClick={(e) => { e.stopPropagation(); onChange({ role: null, industry: null, company: null }); }}>✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: 5 }} aria-hidden>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fc-menu" data-state="prev-career-menu" style={{
          ["--fc-min-w" as string]: "300px",
          ["--fc-pad" as string]: "14px 16px",
          ["--fc-max-h" as string]: "520px",
          background: "#fff",
          overflowY: "auto",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
            選んだ経歴から次に進んだ人と、その行き先（5人以上の動きだけ）が出ます。
          </p>
          {selfStart && (
            <button type="button" data-action="prev-career-self" onClick={() => onChange(prevSelectionOf(selfStart))}
              style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--royal-100)", background: "var(--royal-50)", color: "var(--royal)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              自分の直近の経歴を入れる（{prevCareerText(selfStart)}）
            </button>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <span style={labelStyle}>職種</span>
              <select aria-label="前の経歴の職種" value={selected.role ?? ""} style={selectStyle}
                onChange={(e) => onChange({ ...selected, role: e.target.value || null })}>
                <option value="">指定しない</option>
                {options.roles.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
              </select>
            </label>
            <label>
              <span style={labelStyle}>業界</span>
              <select aria-label="前の経歴の業界" value={selected.industry ?? ""} disabled={!!selected.company}
                style={{ ...selectStyle, opacity: selected.company ? 0.5 : 1 }}
                onChange={(e) => onChange({ ...selected, industry: e.target.value || null })}>
                <option value="">指定しない</option>
                {options.industries.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
              </select>
            </label>
            <label>
              <span style={labelStyle}>会社</span>
              <select aria-label="前の経歴の会社" value={selected.company ?? ""} style={selectStyle}
                onChange={(e) => onChange({ ...selected, company: e.target.value || null, industry: e.target.value ? null : selected.industry })}>
                <option value="">指定しない</option>
                {options.companies.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
              </select>
            </label>
          </div>
          {selected.company && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>会社を選んでいるあいだは、業界はその会社の業界になります。</p>
          )}
        </div>
      )}
    </div>
  );
}
