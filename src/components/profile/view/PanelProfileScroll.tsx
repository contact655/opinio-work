"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * ★右欄のプロフィールを1本のスクロールで出す（2026-10-12 / 柴さんの指示。候補者を探すの右欄だけ）。
 *   並び：職歴 → スキル → 自己紹介 → 学歴 → その他（語学・資格・実績・メディア・リンク・活動）→（社内メモが有効なら）メモ。
 *   上に固定の「節へのリンク」の帯。押すとその節へスクロールし、いま見えている節に下線を引く。
 *
 * ⚠️★中身（`PanelProfileView` が描いたもの）と見せてよい範囲の判定は変えていない。ここは並べて目次を付けるだけ。
 * ⚠️ 中身の無い節は出さない（帯にも出さない）。
 * ⚠️ 候補者を切り替えたら先頭から（部品は候補者ごとに作り直されるので、スクロール位置を持ち越さない）。
 *    2026-10-12 のタブ版にあった「選んだタブを維持する」は外した。
 * ⚠️ この部品はサーバー（`renderCandidateProfile`）が描いて返すので、`profileClientModules.ts` に載せてある。
 */
export type PanelSection = { key: string; label: string; body: ReactNode };

/** ★右欄の側（client）から足す節（社内メモ）。サーバーで描くプロフィールには混ぜられないので context で渡す */
const ExtraSectionsContext = createContext<PanelSection[]>([]);

export function PanelExtraSectionsProvider({ sections, children }: { sections: PanelSection[]; children: ReactNode }) {
  return <ExtraSectionsContext.Provider value={sections}>{children}</ExtraSectionsContext.Provider>;
}

/** 帯の高さ（節へ飛んだときに見出しが帯の下に隠れないよう、この分だけ手前で止める） */
const STRIP_H = 40;

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

export function PanelProfileScroll({ sections }: { sections: PanelSection[] }) {
  const extra = useContext(ExtraSectionsContext);
  const all = [...sections, ...extra];
  const rootRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | null>(all[0]?.key ?? null);
  const keys = all.map((s) => s.key).join(",");

  /* ★いま見えている節。帯のすぐ下を通る節を「いまの節」とする。最後まで下ろしたら最後の節 */
  useEffect(() => {
    const root = rootRef.current;
    const sc = scrollParent(root);
    if (!root || !sc) return;
    const onScroll = () => {
      const els = Array.from(root.querySelectorAll<HTMLElement>("[data-panel-section]"));
      if (els.length === 0) return;
      const line = sc.getBoundingClientRect().top + STRIP_H + 8;
      let cur = els[0].dataset.panelSection ?? null;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.dataset.panelSection ?? cur;
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) cur = els[els.length - 1].dataset.panelSection ?? cur;
      setCurrent(cur);
    };
    onScroll();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [keys]);

  if (all.length === 0) {
    return <p data-state="panel-profile-empty" style={{ margin: "12px 0", fontSize: 13, color: "var(--ink-mute)" }}>プロフィールはまだ書かれていません。</p>;
  }

  const jump = (key: string) => {
    const root = rootRef.current;
    const sc = scrollParent(root);
    const el = root?.querySelector<HTMLElement>(`[data-panel-section="${key}"]`);
    if (!sc || !el) return;
    /* ⚠️ smooth にしない（続けて押したときに途中で止まる。キーボードの一覧移動と同じ理由） */
    sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - STRIP_H;
    setCurrent(key);
  };

  return (
    <div ref={rootRef} data-state="panel-profile-scroll">
      {all.length > 1 && (
        <nav aria-label="プロフィールの節" className="panel-strip" data-state="panel-strip">
          {all.map((s) => (
            <button key={s.key} type="button" data-section={s.key} aria-current={s.key === current ? "true" : undefined}
              onClick={() => jump(s.key)} className="btn-fixed-size panel-strip-link">
              {s.label}
            </button>
          ))}
        </nav>
      )}
      {all.map((s, i) => (
        <section key={s.key} data-panel-section={s.key}
          style={{ padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.label}</h3>
          {s.body}
        </section>
      ))}
      <style>{`
        .panel-strip { position: sticky; top: 0; z-index: 1; display: flex; gap: 4px; height: ${STRIP_H}px; background: #fff; border-bottom: 1px solid var(--line); margin: 0 -20px; padding: 0 20px; overflow-x: auto; }
        .panel-strip-link { height: ${STRIP_H}px; padding: 0 10px; border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink-mute); cursor: pointer; white-space: nowrap; }
        .panel-strip-link[aria-current=true] { color: var(--ink); border-bottom-color: var(--royal); }
      `}</style>
    </div>
  );
}
