"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * ★右欄のプロフィールをタブで切り替える（2026-10-12 / 柴さんの指示。候補者を探すの右欄だけ）。
 *   タブ：職歴／学歴／スキル／自己紹介（＋ 社内メモが有効なら「メモ」）。中身の無いタブは出さない。
 *
 * ⚠️★中身（`PanelProfileView` が描いたもの）と見せてよい範囲の判定は変えていない。ここは並べ替えて切り替えるだけ。
 * ⚠️★選んだタブは、別の候補者に切り替えても維持する（比べやすくするため）。部品は候補者ごとに作り直されるので、
 *    モジュールの変数に持つ（ページを読み直せば職歴に戻る）。その人にそのタブが無ければ先頭を出し、好みは変えない。
 * ⚠️ この部品はサーバー（`renderCandidateProfile`）が描いて返すので、`profileClientModules.ts` に載せてある。
 */
export type PanelTab = { key: string; label: string; body: ReactNode };

/** ★右欄の側（client）から足すタブ（社内メモ）。サーバーで描くプロフィールには混ぜられないので context で渡す */
const ExtraTabsContext = createContext<PanelTab[]>([]);

export function PanelExtraTabsProvider({ tabs, children }: { tabs: PanelTab[]; children: ReactNode }) {
  return <ExtraTabsContext.Provider value={tabs}>{children}</ExtraTabsContext.Provider>;
}

let preferredTab = "career";

export function PanelProfileTabs({ tabs }: { tabs: PanelTab[] }) {
  const extra = useContext(ExtraTabsContext);
  const all = [...tabs, ...extra];
  const [selected, setSelected] = useState<string>(preferredTab);
  if (all.length === 0) {
    return <p data-state="panel-profile-empty" style={{ margin: "12px 0", fontSize: 13, color: "var(--ink-mute)" }}>プロフィールはまだ書かれていません。</p>;
  }
  const current = all.find((t) => t.key === selected) ?? all[0];
  return (
    <div data-state="panel-profile-tabs">
      <div role="tablist" aria-label="プロフィール" className="panel-tabs">
        {all.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === current.key} data-tab={t.key}
            onClick={() => { preferredTab = t.key; setSelected(t.key); }}
            className="btn-fixed-size panel-tab">
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" data-state="panel-tab-body" data-tab={current.key} style={{ paddingTop: 12 }}>{current.body}</div>
      <style>{`
        .panel-tabs { position: sticky; top: 0; z-index: 1; display: flex; gap: 4px; background: #fff; border-bottom: 1px solid var(--line); margin: 0 -20px; padding: 0 20px; overflow-x: auto; }
        .panel-tab { height: 40px; padding: 0 10px; border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink-mute); cursor: pointer; white-space: nowrap; }
        .panel-tab[aria-selected=true] { color: var(--ink); border-bottom-color: var(--royal); }
      `}</style>
    </div>
  );
}
