// 「もっと見る」系ボタンの共通コンポーネント。
// variant="expand"  → その場で展開 （∨ / 折りたたみ ∧）
// variant="navigate" → 別ページへ遷移 （→）
// 色・サイズは求人セクションの遷移ボタンを基準に統一。

import React from "react";
import Link from "next/link";

const STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "11px 28px",
  background: "var(--royal)",
  color: "#fff",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-noto-sans)",
  transition: "opacity 0.15s",
};

function ChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

type ExpandProps = {
  variant: "expand";
  label: string;
  /** true のとき ∧ を表示（折りたたみ状態） */
  expanded: boolean;
  onClick: () => void;
  /** ボタン上にグラデーションフェードを表示するか */
  fade?: boolean;
  wrapperStyle?: React.CSSProperties;
};

type NavigateProps = {
  variant: "navigate";
  label: string;
  href: string;
  wrapperStyle?: React.CSSProperties;
};

export type ShowMoreButtonProps = ExpandProps | NavigateProps;

export function ShowMoreButton(props: ShowMoreButtonProps) {
  const { label, wrapperStyle } = props;

  const icon =
    props.variant === "navigate" ? <ArrowRight /> :
    props.expanded ? <ChevronUp /> : <ChevronDown />;

  const showFade =
    props.variant === "expand" && props.fade && !props.expanded;

  return (
    <div style={{ textAlign: "center", ...wrapperStyle }}>
      {showFade && (
        <div style={{
          height: 40,
          background: "linear-gradient(to bottom, transparent, #fff)",
          pointerEvents: "none",
          marginBottom: -2,
        }} />
      )}
      {props.variant === "navigate" ? (
        <Link href={props.href} style={STYLE}>
          {label}
          {icon}
        </Link>
      ) : (
        <button type="button" onClick={props.onClick} style={STYLE}>
          {label}
          {icon}
        </button>
      )}
    </div>
  );
}
