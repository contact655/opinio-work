"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * ★右欄のプロフィールを1本のスクロールで出す（2026-10-12 / 柴さんの指示。候補者を探すの右欄だけ）。
 *   並び：職歴 → スキル → 自己紹介 → 学歴 → その他（語学・資格・実績・メディア・リンク・活動）→（社内メモが有効なら）メモ。
 *   それぞれ日本語の小見出し＋区切り線で縦に並べる。
 *
 * ⚠️★上に固定の「節へのリンクの帯」（職歴｜スキル…）は 2026-10-12 に外した（柴さんの指示）。タブに見えて紛らわしいため。戻さないこと。
 * ⚠️ 中身（`PanelProfileView` が描いたもの）と見せてよい範囲の判定は変えていない。ここは並べるだけ。
 * ⚠️ 中身の無い節は出さない。候補者を切り替えたら先頭から（部品は候補者ごとに作り直される）。
 * ⚠️ この部品はサーバー（`renderCandidateProfile`）が描いて返すので、`profileClientModules.ts` に載せてある。
 */
export type PanelSection = { key: string; label: string; body: ReactNode };

/** ★右欄の側（client）から足す節（社内メモ）。サーバーで描くプロフィールには混ぜられないので context で渡す */
const ExtraSectionsContext = createContext<PanelSection[]>([]);

export function PanelExtraSectionsProvider({ sections, children }: { sections: PanelSection[]; children: ReactNode }) {
  return <ExtraSectionsContext.Provider value={sections}>{children}</ExtraSectionsContext.Provider>;
}

export function PanelProfileScroll({ sections }: { sections: PanelSection[] }) {
  const extra = useContext(ExtraSectionsContext);
  const all = [...sections, ...extra];
  if (all.length === 0) {
    return <p data-state="panel-profile-empty" style={{ margin: "12px 0", fontSize: 13, color: "var(--ink-mute)" }}>プロフィールはまだ書かれていません。</p>;
  }
  return (
    <div data-state="panel-profile-scroll">
      {all.map((s, i) => (
        <section key={s.key} data-panel-section={s.key}
          style={{ padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.label}</h3>
          {s.body}
        </section>
      ))}
    </div>
  );
}
