import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "OPINIO";
  const sub = searchParams.get("sub") ?? "IT/SaaS業界のキャリアインフラ";
  const badge = searchParams.get("badge") ?? "";
  const type = searchParams.get("type") ?? "default";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background accent top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,35,102,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Background accent bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(59,95,217,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top: OPINIO wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 28,
              color: "#002366",
              letterSpacing: "-0.02em",
            }}
          >
            OPINIO
          </span>
          {type === "company" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                padding: "3px 9px",
                background: "#002366",
                color: "#fff",
                borderRadius: 4,
              }}
            >
              BUSINESS
            </span>
          )}
        </div>

        {/* Badge pill */}
        {badge ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: 100,
              background: "#EFF3FC",
              color: "#002366",
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 20,
              width: "fit-content",
            }}
          >
            {badge}
          </div>
        ) : null}

        {/* Name */}
        <div
          style={{
            fontSize: name.length > 20 ? 48 : 60,
            fontWeight: 800,
            color: "#0F172A",
            lineHeight: 1.2,
            marginBottom: 20,
            maxWidth: 900,
          }}
        >
          {name}
        </div>

        {/* Sub */}
        {sub ? (
          <div
            style={{
              fontSize: 24,
              color: "#475569",
              lineHeight: 1.6,
              maxWidth: 800,
            }}
          >
            {sub}
          </div>
        ) : null}

        {/* Bottom: URL */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 80,
            right: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 18, color: "#94A3B8", fontWeight: 500 }}>
            opinio.jp
          </span>
          <span style={{ fontSize: 18, color: "#94A3B8" }}>
            IT/SaaS業界のキャリアインフラ
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
