import React from "react";

/*
 * FV の図：「来た道 → いる人 → 進んだ道」。
 *
 * ⚠️ **画像ファイルにしないこと。** 色は `currentColor` と既存トークンだけで
 *    書いてあるので、配色が変わっても追従する。PNG にすると追従しない。
 *
 * ⚠️★**ラベルの文字は実在の企業名にしないこと。** 経歴の例は仕組みを説明する
 *    ための架空のもので、注記（「※ 本ページの図は仕組みのイメージです」）と
 *    対になっている。実在の社名を入れると注記が嘘になる。
 *
 * ⚠️★**広い画面と狭い画面で別の SVG を出す。片方だけ直さないこと。**
 *    SVG は viewBox ごと拡大縮小するので、横長のまま 390px に入れると
 *    **文字が 7.4px まで縮んで読めなくなる**（2026-09-17 実測）。
 *    狭い側は縦積みにして、viewBox の幅を画面幅に近づけてある（実効 13px）。
 *    ⚠️ 切り替えは CSS だけで行う（JS で幅を見て出し分けない）。
 *       サーバーとクライアントで分岐がずれないし、リサイズでも壊れない。
 *
 * ⚠️ アニメーションは**起点の線を1回描くだけ**。`prefers-reduced-motion` の
 *    ときは描画済みの状態で止める（下の @media）。
 *    ⚠️ `pathLength={1}` で正規化しているので、パスの座標を変えても
 *       dasharray を測り直さなくてよい。**素の長さで書き直さないこと。**
 *
 * ⚠️★**この style タグの中に `<` `>` `"` `'` を書かないこと。**
 *    サーバー側だけが実体参照へ変換し、style は RAWTEXT なので復号されない
 *    （ハイドレーションが落ちるか、CSS が壊れる）。
 */

const NAVY = "var(--royal)";
const SOFT = "var(--royal-100)";
const TEXT = "var(--ink-soft)";
const MUTE = "var(--ink-mute)";

/** 左（狭い画面では上）：経歴の起点。⚠️ 架空の例（冒頭の注記を読むこと） */
const ORIGINS = ["SIer 提案営業", "国内SaaS IS", "広告代理店", "事業会社 経理", "新卒"];

/** 右（狭い画面では下）：進んだ先。⚠️ 同じく架空 */
const DESTINATIONS = ["事業責任者", "起業", "外資SaaS AE"];

/** 人の輪郭。頭＋肩。⚠️ fill は呼び出し側から渡す（自社の矩形の中は白） */
function Person({ cx, cy, r, fill, opacity }: { cx: number; cy: number; r: number; fill: string; opacity?: number }) {
  return (
    <g fill={fill} opacity={opacity}>
      <circle cx={cx} cy={cy - r * 0.55} r={r * 0.42} />
      <path d={`M ${cx - r * 0.72} ${cy + r * 0.62} a ${r * 0.72} ${r * 0.66} 0 0 1 ${r * 1.44} 0 z`} />
    </g>
  );
}

const svgBox: React.CSSProperties = { width: "100%", height: "auto", display: "block" };

/* ── 広い画面：左から右へ ───────────────────────────────────────────────── */

const WIDE_ORIGIN_Y = [96, 156, 216, 276, 336];
/** 自社の矩形へ入る y。少し扇状に開いて「集まる」形にする */
const WIDE_ENTRY_Y = [186, 203, 220, 237, 254];
const WIDE_DEST_Y = [172, 220, 268];

/*
 * ⚠️★**viewBox の幅 500 を広げないこと。** SVG は viewBox ごと拡大縮小するので、
 *    広げるほど文字が小さくなる。600 のときは 2カラムの右側（900〜1100px 幅）で
 *    **実効 8.6〜10px** まで落ちていた（2026-09-17 実測）。500 なら 11〜13px。
 *    ⚠️ 隣の SeatVisual（360）と実効サイズが揃うように決めてある。**片方だけ変えない。**
 */
function PathsVisualWide() {
  return (
    <svg viewBox="0 0 500 372" style={svgBox} role="img"
      aria-label="さまざまな経歴の人が一つの会社に集まり、そこからまた次へ進んでいく図">

      <text x={72} y={24} textAnchor="middle" fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">来た道</text>
      <text x={256} y={24} textAnchor="middle" fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">いる人</text>
      <text x={423} y={24} textAnchor="middle" fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">進んだ道</text>
      <line x1={20} y1={38} x2={480} y2={38} stroke="var(--line)" strokeWidth={1} />

      {ORIGINS.map((label, i) => (
        <g key={label}>
          <text x={112} y={WIDE_ORIGIN_Y[i] + 4} textAnchor="end" fontSize={13} fill={TEXT}>{label}</text>
          <circle cx={126} cy={WIDE_ORIGIN_Y[i]} r={4.5} fill={NAVY} />
          <path
            className="pv-draw"
            style={{ animationDelay: `${0.12 * i}s` }}
            pathLength={1}
            d={`M 126 ${WIDE_ORIGIN_Y[i]} C 158 ${WIDE_ORIGIN_Y[i]}, 158 ${WIDE_ENTRY_Y[i]}, 186 ${WIDE_ENTRY_Y[i]}`}
            fill="none" stroke={NAVY} strokeWidth={1.75} strokeLinecap="round"
          />
        </g>
      ))}

      <rect x={186} y={132} width={140} height={176} rx={6} fill={NAVY} />
      <text x={256} y={168} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">自社</text>
      {[209, 240, 271, 302].map((cx, i) => (
        <Person key={cx} cx={cx} cy={224} r={14} fill="#fff" opacity={i === 3 ? 0.45 : 1} />
      ))}
      <text x={256} y={284} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.78)">社員とOB・OGを置く</text>

      {/* ⚠️ 破線・淡い色（まだ確定していない道なので実線にしない） */}
      {DESTINATIONS.map((label, i) => (
        <g key={label}>
          <path d={`M 326 220 C 352 220, 352 ${WIDE_DEST_Y[i]}, 368 ${WIDE_DEST_Y[i]}`}
            fill="none" stroke={SOFT} strokeWidth={1.75} strokeDasharray="4 4" strokeLinecap="round" />
          <circle cx={368} cy={WIDE_DEST_Y[i]} r={3.5} fill={SOFT} />
          <text x={382} y={WIDE_DEST_Y[i] + 4} fontSize={13} fill={MUTE}>{label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── 狭い画面：上から下へ ───────────────────────────────────────────────
   ⚠️ viewBox の幅を 340 にしてある（390px の画面でほぼ等倍）。
      広い側の 600 のまま縦積みにしても、文字は小さいままになる。 */

const NARROW_ORIGIN_Y = [50, 79, 108, 137, 166];
const NARROW_DEST_Y = [424, 460, 496];

function PathsVisualNarrow() {
  return (
    <svg viewBox="0 0 340 516" style={svgBox} role="img"
      aria-label="さまざまな経歴の人が一つの会社に集まり、そこからまた次へ進んでいく図">

      <text x={20} y={16} fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">来た道</text>
      {ORIGINS.map((label, i) => (
        <g key={label}>
          <text x={198} y={NARROW_ORIGIN_Y[i] + 4} textAnchor="end" fontSize={13} fill={TEXT}>{label}</text>
          <circle cx={212} cy={NARROW_ORIGIN_Y[i]} r={4.5} fill={NAVY} />
          <path
            className="pv-draw"
            style={{ animationDelay: `${0.12 * i}s` }}
            pathLength={1}
            d={`M 212 ${NARROW_ORIGIN_Y[i]} C 256 ${NARROW_ORIGIN_Y[i]}, 200 214, 172 214`}
            fill="none" stroke={NAVY} strokeWidth={1.75} strokeLinecap="round"
          />
        </g>
      ))}

      <text x={20} y={206} fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">いる人</text>
      <rect x={62} y={216} width={216} height={142} rx={6} fill={NAVY} />
      <text x={170} y={248} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">自社</text>
      {[108, 149, 190, 231].map((cx, i) => (
        <Person key={cx} cx={cx} cy={300} r={16} fill="#fff" opacity={i === 3 ? 0.45 : 1} />
      ))}
      <text x={170} y={340} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.78)">社員とOB・OGを置く</text>

      <text x={20} y={392} fontSize={12} fontWeight={700} fill={MUTE} letterSpacing="0.06em">進んだ道</text>
      {DESTINATIONS.map((label, i) => {
        const y = NARROW_DEST_Y[i];
        return (
          <g key={label}>
            <path d={`M 170 358 C 170 ${358 + (y - 358) * 0.45}, 126 ${358 + (y - 358) * 0.6}, 126 ${y}`}
              fill="none" stroke={SOFT} strokeWidth={1.75} strokeDasharray="4 4" strokeLinecap="round" />
            <circle cx={126} cy={y} r={3.5} fill={SOFT} />
            <text x={140} y={y + 4} fontSize={13} fill={MUTE}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PathsVisual() {
  return (
    <div>
      <style>{`
        .pv-narrow { display: none; }
        @media (max-width: 559px) {
          .pv-wide { display: none; }
          .pv-narrow { display: block; }
        }
        .pv-draw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: pv-dash 0.9s ease-out forwards;
        }
        @keyframes pv-dash { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .pv-draw { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="pv-wide"><PathsVisualWide /></div>
      <div className="pv-narrow"><PathsVisualNarrow /></div>
    </div>
  );
}

export default PathsVisual;
