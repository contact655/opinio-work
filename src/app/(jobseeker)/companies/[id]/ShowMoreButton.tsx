// 「もっと見る」系ボタンの共通コンポーネント。
// variant="expand"  → その場で展開（ゴースト・∨ / 折りたたみ ∧）
// variant="navigate" → 別ページへ遷移（濃紺の塗り・→）
//
// ⚠️ **見た目で「その場で開く」と「別ページへ行く」を区別する（2026-08-23）。**
//    以前は両方とも濃紺の塗りで、企業詳細1枚に濃紺のボタンが6個以上並び、
//    その大半が「開くだけ」だった。塗りは主要な遷移のために取っておく。
//    → これは 2026-08-12 の「展開ボタンは濃紺塗りに統一」を**意図的に上書きしている**。

import React from "react";
import Link from "next/link";

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "11px 28px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: "var(--font-noto-sans)",
  transition: "background 0.15s, border-color 0.15s",
};

/** 別ページへ遷移する。ページ内で数を絞って使う */
const NAVIGATE_STYLE: React.CSSProperties = {
  ...BASE,
  background: "var(--royal)",
  color: "#fff",
  border: "1px solid var(--royal)",
  boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
};

/** その場で開くだけ。面を持たせない */
const EXPAND_STYLE: React.CSSProperties = {
  ...BASE,
  background: "transparent",
  color: "var(--ink-soft)",
  border: "1px solid var(--line)",
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
        <Link href={props.href} style={NAVIGATE_STYLE}>
          {label}
          {icon}
        </Link>
      ) : (
        <button type="button" onClick={props.onClick} style={EXPAND_STYLE}>
          {label}
          {icon}
        </button>
      )}
    </div>
  );
}
