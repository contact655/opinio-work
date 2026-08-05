import Image from "next/image";

/**
 * ブラウザフレーム風の枠に実画面を入れて見せる部品。
 *
 * 2026-08-05 まで FV 直下の独立セクション（ProductPreview）だったが、
 * 下の HOW IT WORKS と同じ説明を2回していたため統合した。
 * 意匠（フレーム・下端フェード・広い/狭いの画像差し替え）はそのまま持ってきている。
 * スタイルは globals.css の .pp-* 節にある。
 *
 * ⚠️ 表示幅を 518px より小さくしないこと。
 *    画像は「表示幅 × 1.3」を上限に切り出してある（wide は 640〜660px 相当）。
 *    3列グリッドに入れると表示幅が約294pxになり、13px の文字が 6px になって読めない。
 *    HOW IT WORKS で 01/02 を2列にしているのはこのため。
 *
 * ⚠️ 画像を差し替えるときはファイル名の連番を上げること（-v2 → -v3）。
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける。
 */

export type Shot = { src: string; w: number; h: number };

export function ProductShot({
  wide, narrow, alt, href, line,
}: {
  wide: Shot;
  /** 狭い画面用。全体を入れると潰れるので、密度の高い一部を拡大した別画像 */
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
      {/* 画面幅で画像そのものを差し替える。CSS の縮小では読めるようにならない
          （元の情報量が多すぎる）ので画像を分けている */}
      <span className="pp-shot pp-wide">
        <Image src={wide.src} alt={alt} width={wide.w} height={wide.h}
          sizes="540px" style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
      <span className="pp-shot pp-narrow">
        <Image src={narrow.src} alt={alt} width={narrow.w} height={narrow.h}
          sizes="100vw" style={{ width: "100%", height: "auto", display: "block" }} />
      </span>
    </a>
  );
}
