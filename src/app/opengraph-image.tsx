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
        {/* ⚠️ satori は「子が2つ以上ある div」に `display: flex` を要求する。
               `キャリアに、<br />第三者の目を。` はテキスト+br+テキストで3つになり、
               **`Expected <div> to have explicit "display: flex"` で落ちる。**
               ⚠️ これは 2026-09-06 まで実際に落ちていた（`/og-image.png` に
                  上書きされていたので誰も踏まなかっただけ）。行ごとに div を分ける。 */}
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
          <div>キャリアに、</div>
          <div>第三者の目を。</div>
        </div>
        <div style={{ fontSize: 22, color: "#475569" }}>IT/SaaS業界のキャリアプラットフォーム</div>
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
