"use client";

import { useRef, useState } from "react";

/**
 * ★左右の幅を変える区切り線（2026-10-13 / 柴さんの指示。Claude の画面と同じ動き）。
 *   候補者を探すの「一覧｜右欄」と、右欄の2列表示の「プロフィール｜メッセージ」の**両方がこの部品を使う**。
 *   ⚠️ 見た目・操作を片方だけ変えないこと（別々に書くと、同じ画面で線の動きが割れる）。
 *
 * - 常時 1px の線（#CBD5E1）と中央の点3つのつまみ。ホバー・ドラッグ中・フォーカスは濃紺の 2px。cursor: col-resize
 * - 線のどこを掴んでもドラッグでき、離した位置でそのまま止まる（段への吸い付きはしない）
 * - ダブルクリックで既定の比率に戻す（`onReset`）／ Tab で入り ←→ で `step` px ずつ
 * - 範囲（最小幅）は親が丸める。この部品は「左の列を何 px にしたいか」を知らせるだけ
 * ⚠️ ドラッグ中は文字の選択を止める（body の user-select）。pointer capture で線から外れても追い、外で離しても止まる
 * ⚠️ 保存は離したとき・キーを押したときだけ（`onMove(px, true)`）。動かしている間は `save = false`
 * ⚠️ 表示する／しない（display）は呼び出し側が決める（一覧｜右欄は 1280px 以上だけ）。ここでは display を書かない
 * ⚠️ style タグの中に山かっこ・引用符を書かない（ハイドレーションが壊れる。ui-debugging ⑲）
 */
export function SplitDivider({ containerRef, firstPx, totalPx, width, step = 40, onMove, onReset, ariaLabel, valueLabel, title, className, dataState, grip = "sticky" }: {
  /** 左の列の左端を測る要素（この要素の左端から、ポインタの位置までが左の列の幅） */
  containerRef: React.RefObject<HTMLElement>;
  /** いまの左の列の幅（px）。測れていなければ null */
  firstPx: number | null;
  /** 左右の列の合計（区切り線の幅を除く）。aria-valuenow の割合に使う */
  totalPx: number | null;
  /** 区切り線の掴める幅（px）。ポインタの位置から半分を引いて左の列の幅にする */
  width: number;
  step?: number;
  onMove: (px: number, save: boolean) => void;
  onReset: () => void;
  ariaLabel: string;
  /** aria-valuetext の頭（「一覧」「プロフィール」） */
  valueLabel: string;
  title: string;
  className?: string;
  dataState?: string;
  /** つまみの置き方。"sticky" … 画面の縦の中央に貼り付く（ページと一緒に伸びる線）／ "center" … 線の縦の中央（高さの決まった枠の中） */
  grip?: "sticky" | "center";
}) {
  const [dragging, setDragging] = useState(false);
  const lastPx = useRef<number | null>(null);
  const prevSelect = useRef<string>("");
  const pxAt = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return null;
    return clientX - el.getBoundingClientRect().left - width / 2;
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 既に外れている */ }
    document.body.style.userSelect = prevSelect.current;
    if (lastPx.current !== null) onMove(lastPx.current, true);
    lastPx.current = null;
  };
  const pct = totalPx && firstPx !== null ? Math.round((firstPx / totalPx) * 100) : 50;
  return (
    <div role="separator" aria-orientation="vertical" aria-label={ariaLabel}
      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${valueLabel} ${pct}%`}
      tabIndex={0} data-state={dataState}
      className={["split-divider", grip === "center" ? "is-center" : "", dragging ? "is-dragging" : "", className ?? ""].filter(Boolean).join(" ")}
      title={title}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        prevSelect.current = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const px = pxAt(e.clientX);
        if (px === null) return;
        lastPx.current = px;
        onMove(px, false);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (firstPx === null) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); onMove(firstPx - step, true); }
        else if (e.key === "ArrowRight") { e.preventDefault(); onMove(firstPx + step, true); }
      }}>
      <span className="split-divider-line" aria-hidden="true" />
      <span className="split-divider-grip" aria-hidden="true"><span /><span /><span /></span>
      <style>{SPLIT_DIVIDER_CSS}</style>
    </div>
  );
}

/* ★見た目（2026-10-13）。普段から見える線は --line より一段濃い #CBD5E1。ホバー・ドラッグ中・フォーカスは 2px の濃紺 */
const SPLIT_DIVIDER_CSS = `
.split-divider { align-self: stretch; position: relative; cursor: col-resize; touch-action: none; outline: none; user-select: none; }
.split-divider-line { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; transform: translateX(-50%); background: #CBD5E1; transition: width 0.12s, background 0.12s; }
.split-divider:hover .split-divider-line, .split-divider.is-dragging .split-divider-line, .split-divider:focus-visible .split-divider-line { width: 2px; background: var(--royal); }
.split-divider-grip { position: sticky; top: calc(50vh - 14px); z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 10px; height: 28px; margin: 0 auto; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 5px; background: #fff; pointer-events: none; transition: border-color 0.12s; }
.split-divider.is-center .split-divider-grip { position: absolute; top: 50%; left: 50%; margin: 0; transform: translate(-50%, -50%); }
.split-divider-grip span { width: 2.5px; height: 2.5px; border-radius: 50%; background: #94A3B8; transition: background 0.12s; }
.split-divider:hover .split-divider-grip, .split-divider.is-dragging .split-divider-grip, .split-divider:focus-visible .split-divider-grip { border-color: var(--royal); }
.split-divider:hover .split-divider-grip span, .split-divider.is-dragging .split-divider-grip span, .split-divider:focus-visible .split-divider-grip span { background: var(--royal); }
`;
