import { ImageResponse } from "next/og";
import { OPINIO_LOGO_DARK, OPINIO_LOGO_RATIO } from "@/lib/brand/ogLogo";

export const runtime = "edge";
export const alt = "OPINIO — Truth to Careers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
  サイト既定の OG 画像（`/` と、自前の OG を持たないページが継承する）。

  ⚠️ **`new ImageResponse(...)` をそのまま return しないこと。**
     Next 14 の ImageResponse はコンストラクタでヘッダ（200 / image/png）を確定し、
     描画は ReadableStream の中で後から走るので、**描画が落ちても 5xx にならず
     「200 かつ空ボディ」になる。** 実際に api/og が1年3か月これで壊れていた
     （CLAUDE.md「5xx が原理的に出ない箇所」）。
     → `await .arrayBuffer()` で描き切ってから Response を作る。

  ⚠️ **ここが 404 だった期間がある**（2026-09-06 に解消）。
     layout.tsx の `openGraph.images` が実在しない `/og-image.png` を指しており、
     ファイル規約のこの画像は**上書きされて一度も使われていなかった。**
     layout.tsx 側で `images` を書かないこと。書くとまたこれが死ぬ。
*/
export default async function Image() {
  const png = await new ImageResponse(
    (
      <div
        style={{
          background: "#fff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OPINIO_LOGO_DARK}
          alt="OPINIO"
          width={Math.round(44 * OPINIO_LOGO_RATIO)}
          height={44}
          style={{ marginBottom: 44 }}
        />
        {/* ★★2026-09-20 に文言を**タイトルと同じ**にした（柴さんの判断）。
               それまで**「キャリアに、第三者の目を。」**で、**サイトのどこにも無い文言**だった
               （実測: `src` 全体で `opengraph-image.tsx` の2行だけ）。
               シェアされたとき、**画像と見出しが別のことを言っている**状態だった。
            ⚠️★**4箇所と完全一致させること。片方だけ変えない:**
                 `page.tsx` の `title` と `openGraph.title` ／
                 `layout.tsx` の `openGraph.title` と `twitter.title` ／ ここ。
            ⚠️★**LP の h1（「求人票の向こうにいる現役社員」）とは別。連動させない。**
               h1 は言い換える前提のコピーで、こちらはサービスの説明。
               一度 h1 に揃えたが、同日に「タイトルで統一する」判断に変わった。

            ⚠️ satori は「子が2つ以上ある div」に `display: flex` を要求する。
               `<br />` を挟むとテキスト+br+テキストで子が3つになり、
               **`Expected <div> to have explicit "display: flex"` で落ちる。**
               ⚠️ これは 2026-09-06 まで実際に落ちていた（`/og-image.png` に
                  上書きされていたので誰も踏まなかっただけ）。**行ごとに div を分ける。** */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 700,
            color: "#141414",
            lineHeight: 1.25,
            marginBottom: 32,
            letterSpacing: "-0.02em",
          }}
        >
          <div>IT業界特化の</div>
          <div>キャリアプラットフォーム</div>
        </div>
        {/* ⚠️★小さい行「IT業界のキャリアプラットフォーム」は **2026-09-20 に削除した。**
               本文がそれ自体になったので、**同じことを2回言う**形だった。
            ⚠️ 「IT業界」は本文に入っているので、対象範囲はシェア面から消えていない
               （LP の FV からは今日サブコピーと placeholder ごと消えている）。 */}
      </div>
    ),
    { ...size }
  ).arrayBuffer();

  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "cache-control":
        process.env.NODE_ENV === "development"
          ? "no-cache, no-store"
          : "public, immutable, no-transform, max-age=31536000",
    },
  });
}
