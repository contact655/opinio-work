import Image from "next/image";

/**
 * ブラウザフレーム風の枠に実画面を入れて見せる部品。
 *
 * 独立セクション（ProductPreview）→ HOW IT WORKS の2列グリッド → FV の検索窓直下、
 * と置き場所が2度変わっている（2026-08-05 に HOW IT WORKS ごと削除）。
 * 意匠（フレーム・下端フェード・画面幅での画像差し替え）は最初から変えていない。
 * スタイルは globals.css の .pp-* 節にある。
 *
 * ── 画面幅で画像そのものを差し替える理由 ──────────────────────────────────
 * CSS の縮小では読めるようにならない。元の情報量が多すぎるため、
 * 幅ごとに「何を写すか」から変えた別の切り出しを用意している。
 *
 * ⚠️ 切り出し幅（c）と表示幅（d）は必ずセットで考えること。目安は
 *      0.77 ≦ d / c ≦ 1.3
 *    上限を超える（切り出しが表示より大きすぎる）と本文が原寸の0.77を下回って読めない。
 *    下限を割る（切り出しが小さすぎる）と引き伸ばしになり、文字は大きいが甘くなる。
 *
 * ── 3段の内訳（2026-08-05 時点。FV での表示幅は最大1000px）────────────────
 *   narrow  c=450   viewport ≦620      d=339〜584   比 1.33〜0.77
 *   mid     c=776   viewport 621〜1019 d=585〜963   比 1.33〜0.81
 *   wide    c=1250  viewport ≧1020     d=964〜1000  比 1.30〜1.25
 *
 *   ⚠️ 2段（narrow/wide、境目900px）だったときは、768px で 450px の切り出しを
 *      732px に引き伸ばしていた（1.62倍）。mid はその穴を埋めるために足した。
 *   ⚠️ viewport 901px で表示幅が一度縮む（864→845）。.lp-wrap の padding が
 *      18px→28px に変わるため。境目を 900 ではなく 1020 に置いているのはこの段差の後、
 *      表示幅が 964px まで戻ってから wide に渡すため。
 *
 * ⚠️ 画像を差し替えるときはファイル名の連番を上げること（-v3 → -v4）。
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける
 *    （dev では .next/cache/images を消せば済むが、本番では効かない）。
 */

export type Shot = { src: string; w: number; h: number };

export function ProductShot({
  wide, mid, narrow, alt, href, line,
}: {
  /** 広い画面用。viewport ≧1020px */
  wide: Shot;
  /** 中間。viewport 621〜1019px */
  mid: Shot;
  /** 狭い画面用。viewport ≦620px。全体を入れると潰れるので密度の高い一部を切り出す */
  narrow: Shot;
  alt: string;
  href: string;
  line: string;
}) {
  return (
    <a href={href} className="pp-frame" style={{ borderColor: line }}>
      <span className="pp-bar" style={{ borderColor: line }} aria-hidden>
        <i style={{ background: "#E5554E" }} />
        <i style={{ background: "#E8B23A" }} />
        <i style={{ background: "#4FAE5A" }} />
      </span>
      {/*
        ⚠️ sizes はそれぞれの段が実際に出る幅に合わせること。
           next/image はこれを見て srcset の候補を選ぶので、実際より小さい値だと
           小さい候補が配信されてぼやける（FV 移設時に 540px 固定のまま出して起きた）。
           .lp-wrap の padding は ≦900px で18px、それより広いと28px。
      */}
      <span className="pp-shot pp-wide">
        <Image src={wide.src} alt={alt} width={wide.w} height={wide.h}
          sizes="1000px" style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
      <span className="pp-shot pp-mid">
        <Image src={mid.src} alt={alt} width={mid.w} height={mid.h}
          sizes="(max-width: 900px) calc(100vw - 36px), calc(100vw - 56px)"
          style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
      <span className="pp-shot pp-narrow">
        <Image src={narrow.src} alt={alt} width={narrow.w} height={narrow.h}
          sizes="calc(100vw - 36px)" style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
    </a>
  );
}
