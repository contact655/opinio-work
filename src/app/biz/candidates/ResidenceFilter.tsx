"use client";

import { useEffect, useRef, useState } from "react";
import { OVERSEAS, PREFECTURE_REGIONS } from "@/lib/utils/location";

/**
 * ★候補者を探すの「居住地」の絞り込み（2026-10-12 / 柴さんの指示）。
 *   47都道府県を地方ごとに**常に全部**出す（データの有無に関わらない）＋「海外」。複数選択。
 *   地方ごとの「すべて」でまとめて選択・解除。各選択肢の横に該当人数。
 *   ★人数は「居住地以外の条件をすべて掛けたあとの人数」（2026-10-13。ドロワーと同じ `countAxisValues`）。
 *   ★0人は灰色で選べない。**ただし選択中のものは0人でも外せる**（2026-10-13 / 柴さんの判断。ドロワーと同じ）。
 *   地方の「すべて」も0人の県は足さない（選べないものを選ばせない）。
 *   「クリア」「適用」。押すまで一覧は変わらない（開いている間は下書き）。
 *
 * ⚠️ 判定（候補者の居住地 → 都道府県・海外）は `lib/utils/location.ts` の `residenceKey` の1か所。
 * ⚠️ 選択の保存先は今までどおり `prefectures`（URL・保存した条件）。値は都道府県の正式名と「海外」。
 * ⚠️ チップの見た目は `FilterChip` に合わせてある（同じ行に並ぶため）。
 */
export function ResidenceFilter({ selected, counts, onApply, isOpen, onToggle }: {
  selected: string[];
  /** 都道府県・海外 → 人数（居住地以外の条件をすべて掛けたあとの人数。CandidatesClient が countAxisValues で数える） */
  counts: Record<string, number>;
  onApply: (next: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const ref = useRef<HTMLDivElement | null>(null);
  /* 開くたびに、いまの選択から始める */
  useEffect(() => { if (isOpen) setDraft(selected); }, [isOpen, selected]);
  /* 外を押したら閉じる（下書きは捨てる） */
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, onToggle]);

  const has = (v: string) => draft.includes(v);
  const toggle = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  /* ⚠️ 0人で選んでいない県は「すべて」でも足さない（選べないものを選ばせない）。外すときは地方の選択中をすべて外す */
  const selectable = (p: string) => (counts[p] ?? 0) > 0 || draft.includes(p);
  const toggleRegion = (prefs: readonly string[]) => setDraft((d) => {
    const pickable = prefs.filter((p) => (counts[p] ?? 0) > 0 || d.includes(p));
    const all = pickable.length > 0 && pickable.every((p) => d.includes(p));
    return all ? d.filter((x) => !prefs.includes(x)) : Array.from(new Set([...d, ...pickable]));
  });

  const active = selected.length > 0;
  /* ★選択中は「居住地: 東京都 +1」（2026-10-13。ほかのチップの labelPrefix と同じ形） */
  const chipLabel = !active ? "居住地" : `居住地: ${selected[0]}${selected.length > 1 ? ` +${selected.length - 1}` : ""}`;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} data-state="residence-chip"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999,
          border: `1.5px solid ${active ? "var(--royal)" : "#e2e8f0"}`, background: active ? "var(--royal)" : "#fff",
          color: active ? "#fff" : "var(--ink)", fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
        }}>
        {chipLabel}
        {active ? (
          <span role="button" aria-label="居住地の絞り込みを外す" onClick={(e) => { e.stopPropagation(); onApply([]); }} style={{ fontSize: 12, marginLeft: 1, opacity: 0.75, lineHeight: 1 }}>✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        )}
      </button>

      {isOpen && (
        <div role="dialog" aria-label="居住地で絞り込む" data-state="residence-panel"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, width: 600, maxWidth: "calc(100vw - 32px)",
            background: "#fff", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 28px rgba(15,23,42,0.14)" }}>
          <div style={{ maxHeight: 440, overflowY: "auto", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px 14px" }}>
            {PREFECTURE_REGIONS.map((r) => {
              const pickable = r.prefectures.filter(selectable);
              const all = pickable.length > 0 && pickable.every((p) => has(p));
              return (
                <section key={r.region} data-region={r.region} style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{r.region}</span>
                    <button type="button" onClick={() => toggleRegion(r.prefectures)} data-state="region-all" disabled={pickable.length === 0}
                      style={{ border: "none", background: "none", padding: 0, fontSize: 11.5, fontWeight: 600, color: pickable.length === 0 ? "var(--ink-mute)" : "var(--royal)", cursor: pickable.length === 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                      {all ? "すべて外す" : "すべて"}
                    </button>
                  </div>
                  {r.prefectures.map((p) => <Opt key={p} label={p} n={counts[p] ?? 0} checked={has(p)} onChange={() => toggle(p)} />)}
                </section>
              );
            })}
            <section data-region={OVERSEAS} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>海外</div>
              <Opt label={OVERSEAS} n={counts[OVERSEAS] ?? 0} checked={has(OVERSEAS)} onChange={() => toggle(OVERSEAS)} />
            </section>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
            <button type="button" onClick={() => setDraft([])} data-state="residence-clear"
              style={{ border: "none", background: "none", padding: "6px 4px", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}>
              クリア
            </button>
            <button type="button" onClick={() => { onApply(draft); onToggle(); }} data-state="residence-apply" className="btn-fixed-size"
              style={{ height: 34, padding: "0 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              適用{draft.length > 0 ? `（${draft.length}）` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Opt({ label, n, checked, onChange }: { label: string; n: number; checked: boolean; onChange: () => void }) {
  /* ⚠️ 0人は選べない。ただし選択中なら外せる（ドロワーの FilterOption と同じ規則） */
  const disabled = n === 0 && !checked;
  return (
    <label data-zero={n === 0 ? "1" : "0"} data-disabled={disabled ? "1" : "0"} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 13, cursor: disabled ? "default" : "pointer", color: n === 0 ? "var(--ink-mute)" : "var(--ink)" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ accentColor: "var(--royal)", margin: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{n}</span>
    </label>
  );
}
