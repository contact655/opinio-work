import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "opinio.work — キャリアに、第三者の目を。";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#fafaf7",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#2d7a4f",
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          opinio.work
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.25,
            marginBottom: 32,
            letterSpacing: "-0.02em",
          }}
        >
          キャリアに、<br />第三者の目を。
        </div>
        <div style={{ fontSize: 22, color: "#666" }}>SaaS業界の転職プラットフォーム</div>
      </div>
    ),
    { ...size }
  );
}
