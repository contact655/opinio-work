import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "エージェントポータル | OPINIO",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
        background: "#F8FAFC",
        minHeight: "100vh",
        WebkitFontSmoothing: "antialiased",
      } as React.CSSProperties}
    >
      {/* Simple header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #E2E8F0",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            color: "var(--royal)",
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          OPINIO
        </span>
        <span
          style={{
            marginLeft: 2,
            fontSize: 11,
            color: "#94A3B8",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            padding: "2px 8px",
            borderRadius: 4,
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          エージェントポータル
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
