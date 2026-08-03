import Image from "next/image";
import Link from "next/link";

/**
 * FV 直下のプロダクト画面プレビュー。
 *
 * ── なぜ置くか（2026-08-04）────────────────────────────────────────────────
 * LP には写真・図版・プロダクト画面が一切なく、テキストとカードだけだった。
 * 「実在するプロダクトである」ことの証拠が無い状態。
 * Stripe / Linear / Vercel / Wellfound はいずれも実UIをFV付近に置いている。
 *
 * ── なぜこの2枚か ──────────────────────────────────────────────────────────
 * 「検索する → こういう深さの情報にたどり着く」の流れが、
 * そのまま見出し（The full picture, before you apply）の証明になる。
 *   1枚目: 求人検索の結果。年収レンジまで出ることを示す
 *   2枚目: 企業ページの製品・導入事例。求人票に書いていない情報が載ることを示す
 *
 * ── 画像について ────────────────────────────────────────────────────────────
 * 実データのスクリーンショット（1440px幅・Retina 2x、WebP）。
 * ⚠️ 企業ページ上部の「企業について」にはサンプル写真（ストックフォトの
 *    プレースホルダー）が入るため、その範囲は意図的に外して撮っている。
 *    差し替え時も同じ理由でヒーロー直下を写さないこと。
 * 数字が古くなる可能性はあるが、正確な値は遷移先が担保する。
 */

type Shot = { src: string; w: number; h: number };
type Panel = {
  /** 広い画面用。1440px幅の画面をそのまま縮小して見せる */
  wide: Shot;
  /** 狭い画面用。全体を入れると内容が潰れるので、密度の高い一部を拡大して見せる */
  narrow: Shot;
  alt: string;
  label: string;
  caption: string;
  href: string;
};

const PANELS: Panel[] = [
  {
    wide:   { src: "/images/lp/preview-search.webp",    w: 2240, h: 1120 },
    narrow: { src: "/images/lp/preview-search-sm.webp", w: 900,  h: 376  },
    alt: "OPINIO の募集検索結果。職種・年収・勤務形態で絞り込め、各募集に年収レンジが表示されている。",
    label: "1. 探す",
    caption: "職種・年収・勤務形態で絞り込む。年収レンジまで出ます。",
    href: "/jobs",
  },
  {
    wide:   { src: "/images/lp/preview-company.webp",    w: 2240, h: 1182 },
    narrow: { src: "/images/lp/preview-company-sm.webp", w: 900,  h: 311  },
    alt: "OPINIO の企業ページ。主な製品・サービス10製品と、導入事例8社の活用内容・成果が並んでいる。",
    label: "2. 深く知る",
    caption: "製品・導入事例・組織まで。求人票に書いていないことが載っています。",
    href: "/companies",
  },
];

export function ProductPreview({ line, navy, muted, blue }: {
  line: string; navy: string; muted: string; blue: string;
}) {
  return (
    <section className="lp-section" style={{ paddingTop: 56, paddingBottom: 64 }}>
      <div className="lp-wrap">
        <div className="pp-grid">
          {PANELS.map((p) => (
            <figure key={p.wide.src} style={{ margin: 0 }}>
              <figcaption style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", color: blue }}>
                  {p.label}
                </span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: navy, marginTop: 4, lineHeight: 1.6 }}>
                  {p.caption}
                </span>
              </figcaption>

              {/* ブラウザフレーム風の枠。下端をフェードさせて「続きがある」ことを示す */}
              <Link href={p.href} className="pp-frame" style={{ borderColor: line }}>
                <span className="pp-bar" style={{ borderColor: line }} aria-hidden>
                  <i style={{ background: "#E5554E" }} />
                  <i style={{ background: "#E8B23A" }} />
                  <i style={{ background: "#4FAE5A" }} />
                </span>
                {/* 画面幅で画像そのものを差し替える。
                    1440px幅の画面を 337px に収めると 0.23倍になり内容が読めないため、
                    狭い画面では密度の高い一部を切り出した別画像を使う。
                    CSS の縮小では解決しない（元の情報量が多すぎる）ので画像を分けている。 */}
                <span className="pp-shot pp-wide">
                  <Image src={p.wide.src} alt={p.alt} width={p.wide.w} height={p.wide.h}
                    sizes="540px"
                    style={{ width: "100%", height: "auto", display: "block" }} priority />
                </span>
                <span className="pp-shot pp-narrow">
                  <Image src={p.narrow.src} alt={p.alt} width={p.narrow.w} height={p.narrow.h}
                    sizes="100vw"
                    style={{ width: "100%", height: "auto", display: "block" }} priority />
                </span>
              </Link>
            </figure>
          ))}
        </div>

        <p style={{ marginTop: 18, fontSize: 12, color: muted, textAlign: "center" }}>
          画面は実際のものです。掲載内容は変わることがあります。
        </p>
      </div>

      {/* スタイルは globals.css の「LP プロダクトプレビュー」節にある。
          Server Component の style タグに content: "" を書くと引用符が
          実体参照にエスケープされ、raw text 要素なのでブラウザが復元しない
          （CLAUDE.md「インラインstyle と CSS の優先順位」の隣に記録あり）。 */}
    </section>
  );
}
