"use client";

import { useEffect, useRef } from "react";

/**
 * 重なったダイアログで Esc を押したとき、いちばん上の1つだけを閉じる（2026-11-27）。
 *
 * ★それまでは各ダイアログが window / document に Esc を付けていたので、上の確認ダイアログで Esc を押すと
 *   下の編集モーダルまで「閉じる」が走っていた（例: 転職か修正かを聞くダイアログで Esc → 下の職歴モーダルも閉じようとする）。
 *
 * ★開いた順に積み、Esc は capture で受けて最後に積んだものだけに渡す。受けたら伝播を止めるので、
 *   ほかの window / document の Esc の処理には届かない。
 *
 * ⚠️ `onEscape` は毎回変わってよい（ref で最新を呼ぶ）。積む順番は `active` が true になった時点で決まる。
 */

type Layer = { id: number; ref: { current: () => void } };

const layers: Layer[] = [];
let nextId = 1;
let listening = false;

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = layers[layers.length - 1];
  if (!top) return;
  e.stopPropagation();
  e.preventDefault();
  top.ref.current();
}

export function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const ref = useRef(onEscape);
  ref.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const layer: Layer = { id: nextId++, ref };
    layers.push(layer);
    if (!listening) {
      window.addEventListener("keydown", onKey, true);
      listening = true;
    }
    return () => {
      const i = layers.findIndex((l) => l.id === layer.id);
      if (i >= 0) layers.splice(i, 1);
      if (layers.length === 0 && listening) {
        window.removeEventListener("keydown", onKey, true);
        listening = false;
      }
    };
  }, [active]);
}
