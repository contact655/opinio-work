import Image from "next/image";

/**
 * ブラウザフレーム風の枠に実画面を入れて見せる部品。
 *
 * 独立セクション（ProductPreview）→ HOW IT WORKS の2列グリッド → FV の検索窓直下、
 * と置き場所が2度変わっている（2026-08-05 に HOW IT WORKS ごと削除）。
 * 意匠（フレーム・下端フェード・広い/狭いの画像差し替え）は最初から変えていない。
 * スタイルは globals.css の .pp-* 節にある。
 *
 * ⚠️ 表示幅と wide の切り出し幅は必ずセットで考えること。
 *    切り出し幅は「表示幅 × 1.3」までにする。これを超えると本文が原寸の0.77を下回って読めない。
 *    小さすぎるのも駄目で、切り出しより大きく表示すると引き伸ばしになる
 *    （FV 移設時に v2 の 640px 切り出しを 1000px で出そうとして作り直した）。
 *    ⚠️ 表示幅を変えたら sizes も一緒に変えること。next/image はここを見て
 *       srcset の候補を選ぶので、小さいままだと最適化画像がぼやける。
 *
 * ⚠️ 画像を差し替えるときはファイル名の連番を上げること（-v2 → -v3）。
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける。
 */

export type Shot = { src: string; w: number; h: number };

export function ProductShot({
  wide, narrow, alt, href, line, sizes = "1000px",
}: {
  wide: Shot;
  /** 狭い画面用。全体を入れると潰れるので、密度の高い一部を拡大した別画像 */
  narrow: Shot;
  alt: string;
  href: string;
  line: string;
  /**
   * 広い画面での表示幅。next/image が srcset のどの候補を配信するかを決める。
   * ⚠️ 実際の表示幅より小さい値を渡すと、小さい候補が選ばれてぼやける。
   *    2026-08-05 まで 540px 固定だったが、FV（1000px）に移したので既定を上げた。
   */
  sizes?: string;
}) {
  return (
    <a href={href} className="pp-frame" style={{ borderColor: line }}>
      <span className="pp-bar" style={{ borderColor: line }} aria-hidden>
        <i style={{ background: "#E5554E" }} />
        <i style={{ background: "#E8B23A" }} />
        <i style={{ background: "#4FAE5A" }} />
      </span>
      {/* 画面幅で画像そのものを差し替える。CSS の縮小では読めるようにならない
          （元の情報量が多すぎる）ので画像を分けている */}
      <span className="pp-shot pp-wide">
        <Image src={wide.src} alt={alt} width={wide.w} height={wide.h}
          sizes={sizes} style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
      <span className="pp-shot pp-narrow">
        <Image src={narrow.src} alt={alt} width={narrow.w} height={narrow.h}
          sizes="100vw" style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
    </a>
  );
}
