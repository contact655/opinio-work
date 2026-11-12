"use client";

import { useEffect, useRef, useState } from "react";
import type { PathsOption, PathsStartView } from "@/lib/paths/server";
import type { PrevSelection } from "@/lib/people/prevCareer";
import { PrevCareerFields } from "@/components/people/PrevCareerFields";

/**
 * ★/people の「すべてのフィルター」（2026-11-12 / 柴さんの指示。LinkedIn の「ユーザーフィルター」を参考にした）。
 *   右から出るパネル（767px 以下は下から出るシート）。中で選んだ条件は「結果を表示」を押したときにまとめて当てる。
 *
 * ⚠️ 条件の意味は上部のチップと同じ（同じ項目の中は OR・項目どうしは AND。URL の rel / role / age / foreign）。
 *    ここで新しい条件を作らないこと。
 * ⚠️ 人数は出さない（「結果を表示」にも付けない。2026-11-04 の決めごと）。
 * ★2026-11-12: 上部の条件のチップをなくし、条件はすべてこのパネルで選ぶ形にした（柴さんの指示）。
 *   前の経歴（prev_*。職種・業界・会社の選択）もここ（PrevCareerFields）。「リセット」は全部外す。
 */
/* ★q はキーワード（2026-11-12 に一覧の上の検索欄からここへ移した / 柴さんの指示） */
export type PeopleFilterValues = { q: string; rel: string; roles: string[]; ages: string[]; foreign: boolean; consult: boolean; prev: PrevSelection };

type Opt = { value: string; label: string };

export function PeopleFilterDrawer({
  open, onClose, values, relOptions, roleOptions, ageOptions, onApply, onReset, showConsult = false, prevCareer = null,
}: {
  /** ★前の経歴の選択肢（読めなかったときは null。欄ごと出さない） */
  prevCareer?: { options: { roles: PathsOption[]; industries: PathsOption[]; companies: PathsOption[] }; selfStart: PathsStartView | null } | null;
  /** ★相談可能なユーザーの欄を出すか（2026-11-12。一覧を読めなかったときは出さない） */
  showConsult?: boolean;
  open: boolean;
  onClose: () => void;
  values: PeopleFilterValues;
  /** つながり。ログインしていない・自分の行が無いときは空（項目ごと出さない） */
  relOptions: Opt[];
  roleOptions: Opt[];
  ageOptions: Opt[];
  onApply: (next: PeopleFilterValues) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<PeopleFilterValues>(values);
  const panelRef = useRef<HTMLDivElement>(null);
  /* 開くたびに、いま効いている条件から始める */
  useEffect(() => { if (open) setDraft(values); }, [open, values]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="pfd-root" data-state="people-filter-drawer">
      <style>{`
        .pfd-root { position: fixed; inset: 0; z-index: 1200; }
        .pfd-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,0.35); border: none; padding: 0; cursor: pointer; }
        .pfd-panel {
          position: absolute; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100%;
          background: #fff; display: flex; flex-direction: column; outline: none;
          box-shadow: -8px 0 24px rgba(15,23,42,0.12); font-family: var(--font-inter), var(--font-noto);
        }
        .pfd-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--line); }
        .pfd-title { margin: 0; font-size: 17px; font-weight: 800; color: var(--ink); }
        .pfd-x { width: 44px; height: 44px; border: none; background: none; font-size: 20px; color: var(--ink-soft); cursor: pointer; border-radius: 8px; }
        .pfd-body { flex: 1; overflow-y: auto; padding: 4px 20px 16px; }
        .pfd-sec { padding: 16px 0; border-bottom: 1px solid var(--line); }
        .pfd-sec:last-child { border-bottom: none; }
        .pfd-sec-title { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--ink); }
        .pfd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
        .pfd-opt { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink); cursor: pointer; min-width: 0; }
        .pfd-opt input { width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--royal); margin: 0; }
        .pfd-opt span { min-width: 0; overflow-wrap: anywhere; }
        .pfd-keyword { width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; font-family: inherit; }
        .pfd-note { margin: 0; font-size: 12.5px; color: var(--ink-mute); line-height: 1.7; }
        .pfd-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--line); }
        .pfd-btn { min-height: 44px; padding: 0 20px; border-radius: 999px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .pfd-reset { border: 1.5px solid var(--line); background: #fff; color: var(--ink); }
        .pfd-apply { border: none; background: var(--royal); color: #fff; }
        @media (max-width: 767px) {
          .pfd-panel { top: auto; left: 0; width: auto; max-height: 85vh; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 24px rgba(15,23,42,0.12); }
          .pfd-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <button type="button" className="pfd-backdrop" aria-label="閉じる" onClick={onClose} />
      <div ref={panelRef} className="pfd-panel" role="dialog" aria-modal="true" aria-labelledby="pfd-title" tabIndex={-1}>
        <div className="pfd-head">
          <h2 id="pfd-title" className="pfd-title">ユーザーフィルター</h2>
          <button type="button" className="pfd-x" aria-label="閉じる" onClick={onClose}>✕</button>
        </div>
        <div className="pfd-body">
          <section className="pfd-sec" data-state="pfd-q">
            <h3 className="pfd-sec-title">キーワード</h3>
            <input type="search" className="pfd-keyword" value={draft.q} placeholder="名前・会社名・職種" aria-label="キーワード" enterKeyHint="search"
              onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, q: v })); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); onApply({ ...draft, q: draft.q.trim() }); onClose(); } }} />
          </section>
          {relOptions.length > 0 && (
            <section className="pfd-sec" data-state="pfd-rel">
              <h3 className="pfd-sec-title">あなたのつながり</h3>
              <div className="pfd-grid">
                {relOptions.map((o) => (
                  <label key={o.value} className="pfd-opt">
                    {/* ⚠️ つながりは1つだけ選べる（URL の rel は1つ）。もう一度押すと外れる */}
                    <input type="checkbox" checked={draft.rel === o.value}
                      onChange={() => setDraft((d) => ({ ...d, rel: d.rel === o.value ? "" : o.value }))} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
          <section className="pfd-sec" data-state="pfd-role">
            <h3 className="pfd-sec-title">職種</h3>
            <div className="pfd-grid">
              {roleOptions.map((o) => (
                <label key={o.value} className="pfd-opt">
                  <input type="checkbox" checked={draft.roles.includes(o.value)} onChange={() => setDraft((d) => ({ ...d, roles: toggle(d.roles, o.value) }))} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="pfd-sec" data-state="pfd-age">
            <h3 className="pfd-sec-title">年代</h3>
            <div className="pfd-grid">
              {ageOptions.map((o) => (
                <label key={o.value} className="pfd-opt">
                  <input type="checkbox" checked={draft.ages.includes(o.value)} onChange={() => setDraft((d) => ({ ...d, ages: toggle(d.ages, o.value) }))} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="pfd-sec" data-state="pfd-foreign">
            <h3 className="pfd-sec-title">会社</h3>
            <label className="pfd-opt">
              <input type="checkbox" checked={draft.foreign} onChange={() => setDraft((d) => ({ ...d, foreign: !d.foreign }))} />
              <span>外資</span>
            </label>
          </section>
          {showConsult && (
            <section className="pfd-sec" data-state="pfd-consult">
              <h3 className="pfd-sec-title">相談</h3>
              <label className="pfd-opt">
                <input type="checkbox" checked={draft.consult} onChange={() => setDraft((d) => ({ ...d, consult: !d.consult }))} />
                <span>相談可能なユーザー</span>
              </label>
            </section>
          )}
          {prevCareer && (
            <section className="pfd-sec" data-state="pfd-prev">
              <h3 className="pfd-sec-title">前の経歴</h3>
              <PrevCareerFields options={prevCareer.options} selfStart={prevCareer.selfStart} selected={draft.prev}
                onChange={(next) => setDraft((d) => ({ ...d, prev: next }))} />
            </section>
          )}
        </div>
        <div className="pfd-foot">
          <button type="button" className="pfd-btn pfd-reset" data-action="pfd-reset" onClick={() => { onReset(); onClose(); }}>リセット</button>
          <button type="button" className="pfd-btn pfd-apply" data-action="pfd-apply" onClick={() => { onApply({ ...draft, q: draft.q.trim() }); onClose(); }}>結果を表示</button>
        </div>
      </div>
    </div>
  );
}
