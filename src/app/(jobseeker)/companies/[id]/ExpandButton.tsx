// 「その場で展開」専用ボタン
// 薄い水色背景・濃紺テキスト・幅いっぱい・シェブロン（∨）
// 遷移ボタン（濃紺塗り・→）とは別物。混在させないこと。

import React from "react";

type ExpandButtonProps = {
  onClick: () => void;
  label: string;
  /** ボタン上にグラデーションフェードを表示するか（リスト末尾フェードアウト演出用） */
  fade?: boolean;
  /** padding wrapper の style 上書き */
  wrapperStyle?: React.CSSProperties;
};

export function ExpandButton({ onClick, label, fade = false, wrapperStyle }: ExpandButtonProps) {
  return (
    <div style={wrapperStyle}>
      {fade && (
        <div
          style={{
            height: 40,
            background: "linear-gradient(to bottom, transparent, #fff)",
            pointerEvents: "none",
            marginBottom: -2,
          }}
        />
      )}
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "13px 0",
          background: "var(--royal-50)",
          border: "1.5px solid var(--royal-100)",
          borderRadius: 12,
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--royal)",
          cursor: "pointer",
          fontFamily: "var(--font-noto-sans)",
          transition: "background 0.15s",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
      </button>
    </div>
  );
}

/** 折りたたむボタン（展開後の戻りアクション） */
export function CollapseButton({ onClick, wrapperStyle }: { onClick: () => void; wrapperStyle?: React.CSSProperties }) {
  return (
    <div style={wrapperStyle}>
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "11px 0",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--ink-soft)",
          cursor: "pointer",
          fontFamily: "var(--font-noto-sans)",
          transition: "background 0.15s",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
        折りたたむ
      </button>
    </div>
  );
}
