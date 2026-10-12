"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * ★「すべてのフィルター」の右ドロワー（2026-10-13 / 候補者を探す ステップ5）。
 *
 * ⚠️★**汎用の部品。** 軸（何で絞るか・件数の数え方）は持たない。呼び出し側が `children` に
 *    `FilterDrawerSection` / `FilterOption` を並べる。/companies でも使う予定。
 * ⚠️★**下書きは呼び出し側が持つ。** ここは「閉じた（＝捨てる）」「すべてクリア」「結果を表示（＝反映）」を
 *    知らせるだけ。✕・Esc・外側クリックはすべて `onClose`（下書きを捨てる）。
 *
 * 作法（柴さんの指示）:
 * - role="dialog"・aria-modal・aria-labelledby。開いたら最初の要素（✕）にフォーカス、Tab はドロワー内で循環、
 *   閉じたら `returnFocusRef`（「すべてのフィルター」ボタン）にフォーカスを戻す
 * - 幅 400px、640px 以下は全幅。開いている間は背景のスクロールを止める
 * - ⚠️ body に portal で出す（一覧の幅・右欄の sticky に影響させないため）
 */
export function FilterDrawer({
  open, onClose, title, children, onClearAll, onApply, applyLabel, applyDisabled = false, returnFocusRef,
}: {
  open: boolean;
  /** ✕・Esc・外側クリック。⚠️ 呼び出し側は下書きを捨てること */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 下書きを空にする（反映はしない） */
  onClearAll: () => void;
  /** 下書きを反映して閉じる */
  onApply: () => void;
  /** 「結果を表示（12名）」 */
  applyLabel: string;
  applyDisabled?: boolean;
  /** 閉じたときにフォーカスを戻す先 */
  returnFocusRef?: RefObject<HTMLElement>;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* 背景のスクロールを止める。⚠️ 閉じたら元の値に戻す（他の箇所が設定していた値を消さない） */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* 開いたら最初の要素にフォーカス。閉じたら呼び出し元のボタンに戻す */
  useEffect(() => {
    if (!open) return;
    const ret = returnFocusRef?.current ?? null;
    /* ⚠️ rAF ではなく setTimeout（描画されていないタブでは rAF が発火しない。ui-debugging ⑪） */
    const t = setTimeout(() => { firstFocusable(panelRef.current)?.focus(); }, 0);
    return () => { clearTimeout(t); ret?.focus(); };
  }, [open, returnFocusRef]);

  if (!open || !mounted) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const items = focusables(panelRef.current);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return createPortal(
    <div className="fdr-root" data-state="filter-drawer" onKeyDown={onKeyDown}>
      {/* 外側（押すと閉じる＝下書きを捨てる）。⚠️ フォーカスは受けない */}
      <div className="fdr-overlay" aria-hidden="true" onClick={onClose} data-state="filter-drawer-overlay" />
      <div ref={panelRef} className="fdr-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="fdr-head">
          <h2 id={titleId} className="fdr-title">{title}</h2>
          <button type="button" className="fdr-close btn-fixed-size" aria-label="閉じる（変更を反映しない）" onClick={onClose} data-state="filter-drawer-close">✕</button>
        </div>
        <div className="fdr-body">{children}</div>
        <div className="fdr-foot">
          <button type="button" className="fdr-clear" onClick={onClearAll} data-state="filter-drawer-clear">すべてクリア</button>
          <button type="button" className="fdr-apply btn-fixed-size" onClick={onApply} disabled={applyDisabled} data-state="filter-drawer-apply">{applyLabel}</button>
        </div>
      </div>
      {/* ⚠️ style タグの中に山かっこ・引用符を書かない（ハイドレーションが壊れる） */}
      <style>{`
        .fdr-root { position: fixed; inset: 0; z-index: 90; }
        .fdr-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.32); }
        .fdr-panel { position: absolute; top: 0; right: 0; bottom: 0; width: 400px; max-width: 100%; background: #fff; display: flex; flex-direction: column; box-shadow: -8px 0 28px rgba(15,23,42,0.16); }
        .fdr-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px 12px 20px; border-bottom: 1px solid var(--line); }
        .fdr-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
        .fdr-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: none; color: var(--ink-soft); font-size: 15px; cursor: pointer; font-family: inherit; }
        .fdr-close:hover { background: var(--bg-tint); }
        .fdr-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 20px 16px; }
        .fdr-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--line); background: #fff; }
        .fdr-clear { border: none; background: none; padding: 8px 4px; font-size: 13px; font-weight: 600; color: var(--ink-soft); text-decoration: underline; cursor: pointer; font-family: inherit; }
        .fdr-apply { height: 40px; padding: 0 20px; border-radius: 8px; border: none; background: var(--royal); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .fdr-apply:disabled { opacity: 0.6; cursor: default; }
        .fdr-section { padding: 14px 0; border-bottom: 1px solid var(--line-soft); }
        .fdr-section:last-child { border-bottom: none; }
        .fdr-section-title { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--ink); }
        .fdr-note { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--ink-mute); }
        .fdr-opt { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; color: var(--ink); cursor: pointer; min-width: 0; }
        .fdr-opt.is-disabled { color: var(--ink-mute); cursor: default; }
        .fdr-opt input { margin: 0; accent-color: var(--royal); flex-shrink: 0; }
        .fdr-opt-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .fdr-opt-count { flex-shrink: 0; font-size: 12px; color: var(--ink-mute); font-family: var(--font-inter), var(--font-noto); }
        .fdr-opt.is-child { padding-left: 22px; }
        .fdr-more { border: none; background: none; padding: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--royal); cursor: pointer; font-family: inherit; }
        @media (max-width: 640px) {
          .fdr-panel { width: 100%; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/** ドロワーの中の1区画（見出し＋選択肢） */
export function FilterDrawerSection({ title, children, state }: { title: string; children: ReactNode; state?: string }) {
  return (
    <section className="fdr-section" data-state={state}>
      <h3 className="fdr-section-title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * 選択肢の1行（チェックボックスかラジオ＋件数）。
 * ⚠️★件数 0 は灰色・選べない。**ただし選択中なら外せる**（0件のまま外せないと、条件が抜けられなくなる）。
 * ⚠️ 件数を出さない選択肢は `count` を渡さない（undefined は件数なし・選べる）。
 * ⚠️ 行の中（label の中）にボタンを入れないこと。押すとチェックも切り替わる。開閉ボタンは行の外に置く
 */
export function FilterOption({ type = "checkbox", label, count, checked, onChange, child = false, name, state }: {
  type?: "checkbox" | "radio";
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  /** 親の下にぶら下がる選択肢（字下げする） */
  child?: boolean;
  /** ラジオの name */
  name?: string;
  state?: string;
}) {
  const disabled = count === 0 && !checked;
  return (
    <label className={["fdr-opt", child ? "is-child" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
      data-state={state} data-zero={count === 0 ? "1" : "0"} data-checked={checked ? "1" : "0"}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="fdr-opt-label">{label}</span>
      {count !== undefined && <span className="fdr-opt-count">{count}</span>}
    </label>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}
function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  return focusables(root)[0] ?? null;
}
