import React from "react";

/*
 * 「提案のしくみ」の図：営業チームの3席と、空いている1席。
 *
 * ⚠️ 左上から伸びる破線は、隣の職歴年表から空席へ向かう線。
 *    **2カラムが縦に積まれる幅でも意味が通るように**、線の起点は
 *    図の中（左上）に閉じてある。年表の DOM と結んでいるわけではない。
 *
 * ⚠️★**viewBox を横に広げないこと。** SVG は viewBox ごと拡大縮小するので、
 *    幅を広げるほど 390px での文字が小さくなる。360 は「390px の画面で
 *    ほぼ等倍（実効 11px 以上）」になるように決めた値（2026-09-17 実測）。
 *
 * ⚠️★**「提案します」と断定する文言をこの図に入れないこと。**
 *    企業へ候補者を提案する処理は 2026-09-17 時点で未実装
 *    （`ow_transitions` の参照0件・`/biz/candidates` は現職しか持たない）。
 *    本文側も「提案していきます」で揃えてある。
 */

const NAVY = "var(--royal)";
const SOFT = "var(--royal-100)";
const LINE = "var(--line)";
const TEXT = "var(--ink-soft)";
const MUTE = "var(--ink-mute)";

/** 席の x。中央は (180+300)/2 ＝ 240 で「営業チーム」の縦線と揃える */
const SEATS = [180, 220, 260];
const EMPTY_X = 300;
const TEAM_CX = 240;

function Person({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g fill={NAVY}>
      <circle cx={cx} cy={cy - r * 0.55} r={r * 0.42} />
      <path d={`M ${cx - r * 0.72} ${cy + r * 0.62} a ${r * 0.72} ${r * 0.66} 0 0 1 ${r * 1.44} 0 z`} />
    </g>
  );
}

export function SeatVisual() {
  return (
    <svg
      viewBox="0 0 360 186"
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="経歴の近い人を、営業チームの空いた席に提案する図"
    >
      {/* ── チームの見出しとツリー線 ── */}
      <text x={TEAM_CX} y={32} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>営業チーム</text>
      <line x1={TEAM_CX} y1={40} x2={TEAM_CX} y2={56} stroke={LINE} strokeWidth={1.5} />
      <line x1={SEATS[0]} y1={56} x2={EMPTY_X} y2={56} stroke={LINE} strokeWidth={1.5} />
      {[...SEATS, EMPTY_X].map((x) => (
        <line key={x} x1={x} y1={56} x2={x} y2={76} stroke={LINE} strokeWidth={1.5} />
      ))}

      {/* ── いる3人 ── */}
      {SEATS.map((x) => <Person key={x} cx={x} cy={100} r={16} />)}

      {/* ── 空いている1席。⚠️ 破線の丸＋＋。塗りつぶさない ── */}
      <circle cx={EMPTY_X} cy={96} r={16} fill="none" stroke={NAVY} strokeWidth={1.5} strokeDasharray="4 4" />
      <line x1={EMPTY_X - 6} y1={96} x2={EMPTY_X + 6} y2={96} stroke={NAVY} strokeWidth={1.75} strokeLinecap="round" />
      <line x1={EMPTY_X} y1={90} x2={EMPTY_X} y2={102} stroke={NAVY} strokeWidth={1.75} strokeLinecap="round" />

      {/* ── 経歴 → 空席 ── */}
      <path d="M 18 40 C 120 40, 135 96, 275 96" fill="none"
        stroke={NAVY} strokeWidth={1.75} strokeDasharray="4 4" strokeLinecap="round" />
      <polygon points="282,96 271,90.5 271,101.5" fill={NAVY} />

      {/* ピル。⚠️ 下地を白で抜いて破線と重ならないようにする */}
      <rect x={74} y={57} width={88} height={22} rx={11} fill="#fff" stroke={SOFT} strokeWidth={1} />
      <text x={118} y={72} textAnchor="middle" fontSize={12} fontWeight={700} fill={NAVY}>経歴が近い人</text>

      <text x={180} y={166} textAnchor="middle" fontSize={11.5} fill={MUTE}>いま活躍している3人と、空いている1席</text>
    </svg>
  );
}

export default SeatVisual;
