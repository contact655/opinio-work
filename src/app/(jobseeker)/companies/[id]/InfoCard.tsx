// 福利厚生・ツールセクション共通カードコンポーネント
// Server / Client どちらからも利用可能（hooks なし）

import React from "react";

type InfoCardProps = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  border: string;
};

export function InfoCard({ icon, label, sublabel, color, bg, border }: InfoCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: "14px 14px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "#fff",
          border: `1px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color, fontWeight: 700, lineHeight: 1.4 }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 400, marginTop: 2 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
