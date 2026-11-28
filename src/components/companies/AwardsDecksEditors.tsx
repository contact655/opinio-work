"use client";

import type React from "react";
import { AWARD_TEXT_MAX, AWARDS_MAX, type AwardInput } from "@/lib/companies/awards";
import { DECK_TITLE_MAX, DECKS_MAX, type DeckInput } from "@/lib/companies/companyDecks";

/**
 * ★受賞・認定と会社紹介資料の入力欄（2026-11-28 / 柴さんの指示。/biz/company だけ）。
 * ⚠️ 検証は保存側（lib/companies/awards.ts の parseAwards / companyDecks.ts の parseDecks）。ここは入力を受けるだけ。
 * ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（ハイドレーションが壊れる）。
 */
const input: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 16, background: "#fff", color: "var(--ink)", minWidth: 0, width: "100%",
};
const delBtn: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
};
const addBtn: React.CSSProperties = {
  marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--line)", background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, cursor: "pointer",
};

export function AwardsEditor({ value, onChange, idPrefix }: { value: AwardInput[]; onChange: (next: AwardInput[]) => void; idPrefix: string }) {
  const set = (i: number, patch: Partial<AwardInput>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div data-state="awards-editor">
      {value.length === 0 && <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-mute)" }}>まだ登録されていません。</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {value.map((a, i) => (
          <div key={i} className="aw-row">
            <input id={`${idPrefix}-name-${i}`} className="aw-name" aria-label={`${i + 1}件目の正式名称`} placeholder="正式名称（例: くるみん認定）" maxLength={AWARD_TEXT_MAX}
              value={a.name} onChange={(e) => set(i, { name: e.target.value })} style={input} />
            <input className="aw-issuer" aria-label={`${i + 1}件目の主催・認定した団体`} placeholder="主催・認定した団体（例: 厚生労働省）" maxLength={AWARD_TEXT_MAX}
              value={a.issuer} onChange={(e) => set(i, { issuer: e.target.value })} style={input} />
            <input className="aw-year" aria-label={`${i + 1}件目の年`} inputMode="numeric" placeholder="年（例: 2026）"
              value={a.year} onChange={(e) => set(i, { year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })} style={input} />
            <input className="aw-url" aria-label={`${i + 1}件目の根拠のページ`} inputMode="url" placeholder="根拠のページ（任意・https://）"
              value={a.url} onChange={(e) => set(i, { url: e.target.value })} style={input} />
            <button type="button" className="aw-del" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`${i + 1}件目を削除`} style={delBtn}>削除</button>
          </div>
        ))}
      </div>
      {value.length < AWARDS_MAX && (
        <button type="button" onClick={() => onChange([...value, { name: "", issuer: "", year: "", url: "" }])} style={addBtn}>＋ 受賞・認定を追加</button>
      )}
      <style>{`
        .aw-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1.5fr) 84px auto; gap: 8px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
        .aw-url { grid-column: 1 / 4; }
        .aw-del { grid-column: 4; grid-row: 1; }
        @media (max-width: 640px) {
          .aw-row { grid-template-columns: minmax(0, 1fr) 84px; }
          .aw-name { grid-column: 1 / -1; }
          .aw-issuer { grid-column: 1; }
          .aw-year { grid-column: 2; }
          .aw-url { grid-column: 1 / -1; }
          .aw-del { grid-column: 1 / -1; grid-row: auto; justify-self: end; }
        }
      `}</style>
    </div>
  );
}

export function DecksEditor({ value, onChange, idPrefix }: { value: DeckInput[]; onChange: (next: DeckInput[]) => void; idPrefix: string }) {
  const set = (i: number, patch: Partial<DeckInput>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div data-state="decks-editor">
      {value.length === 0 && <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-mute)" }}>まだ登録されていません。</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {value.map((d, i) => (
          <div key={i} className="dk-row">
            <input id={`${idPrefix}-title-${i}`} aria-label={`${i + 1}件目のタイトル`} placeholder="タイトル（例: 会社紹介資料 2026年版）" maxLength={DECK_TITLE_MAX}
              value={d.title} onChange={(e) => set(i, { title: e.target.value })} style={input} />
            <input aria-label={`${i + 1}件目の URL`} inputMode="url" placeholder="https://"
              value={d.url} onChange={(e) => set(i, { url: e.target.value })} style={input} />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`${i + 1}件目を削除`} style={delBtn}>削除</button>
          </div>
        ))}
      </div>
      {value.length < DECKS_MAX && (
        <button type="button" onClick={() => onChange([...value, { title: "", url: "" }])} style={addBtn}>＋ 会社紹介資料を追加</button>
      )}
      <style>{`
        .dk-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 8px; align-items: center; }
        @media (max-width: 640px) { .dk-row { grid-template-columns: minmax(0, 1fr) auto; } .dk-row input:first-child { grid-column: 1 / -1; } }
      `}</style>
    </div>
  );
}
