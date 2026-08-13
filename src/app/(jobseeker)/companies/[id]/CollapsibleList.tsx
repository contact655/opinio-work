"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { ShowMoreButton } from "./ShowMoreButton";

/**
 * 初期表示の件数だけを絞る共通ラッパー（2026-08-13）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * 取材の進んだ1社（Salesforce）だけが全セクションをフル展開しており、
 * **ページの長さの差がそのまま「情報量の差」に見えていた。**
 * 内容は1件も減らさず、初期表示の高さだけを揃える。
 *
 * ── 使い方 ──────────────────────────────────────────────────────────────────
 * **カードはサーバー側で全件レンダリングし、ここには出来上がった要素を渡す。**
 * 表示件数の判断だけをクライアントに持たせるので、
 * `parseProductName` や `productStyle` のような描画ヘルパーを
 * クライアント側へ持ち出さずに済む（page.tsx はサーバーコンポーネントのまま）。
 *
 * ⚠️ `label` は**文字列で渡す**。関数を渡すとサーバー→クライアントの
 *    境界を越えられない（Functions cannot be passed directly to Client Components）。
 *    残り件数の単位はセクションごとに違う（件 / カテゴリ / グループ）ので、
 *    文言そのものを呼び出し側で組み立てる。
 *
 * ⚠️ `limit` は**items の添字**。「求人3件」のように見出しノードが
 *    間に挟まる場合は、呼び出し側が「3件目の求人までを含む添字」を計算して渡す。
 */
export function CollapsibleList({
  items,
  limit,
  labelCollapsed,
  containerClassName,
  containerStyle,
  buttonWrapperStyle,
  fade = false,
}: {
  /** サーバー側でレンダリング済みの要素。**全件渡すこと**（畳むだけで捨てない） */
  items: ReactNode[];
  /** 初期表示する items の件数 */
  limit: number;
  /** 折りたたみ時のボタン文言。残り件数まで含めて呼び出し側が組み立てる */
  labelCollapsed: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  buttonWrapperStyle?: CSSProperties;
  /** ボタンの上にグラデーションを敷いて「まだ続く」ことを示す */
  fade?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const overflowing = items.length > limit;
  const shown = open || !overflowing ? items : items.slice(0, limit);

  return (
    <>
      <div className={containerClassName} style={containerStyle}>
        {shown}
      </div>
      {overflowing && (
        <ShowMoreButton
          variant="expand"
          label={open ? "折りたたむ" : labelCollapsed}
          expanded={open}
          onClick={() => setOpen((v) => !v)}
          fade={fade}
          wrapperStyle={buttonWrapperStyle}
        />
      )}
    </>
  );
}
