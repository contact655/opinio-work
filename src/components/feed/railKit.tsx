import Link from "next/link";

/**
 * ★右の列（PC のホーム）の箱と行の形（2026-11-04 / 柴さんの指示。見た目を統一した）。
 *   箱（枠・角の丸み・余白・見出し）と、下のリンク「すべて見る →」、1行の形（左に 40px の画像／真ん中に名前と補足1行／右に操作）。
 *
 * ⚠️★右の列の箱を足すときは、ここの RailBox と RailRow を使う。箱ごとに style を書き直さないこと（見た目が割れる）
 * ⚠️ フックを使わない（サーバーの部品からもクライアントの部品からも読む）
 */

export const RAIL_THUMB = 40;

export const RAIL_BOX_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 12,
  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
  minWidth: 0,
};

export const RAIL_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-inter), var(--font-noto)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--ink-soft)",
  margin: "0 0 12px",
  paddingBottom: 8,
  borderBottom: "1px solid var(--line-soft, #f1f5f9)",
  lineHeight: 1.5,
};

export const RAIL_MORE_STYLE: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  fontSize: 12,
  color: "var(--ink-soft)",
  fontFamily: "var(--font-inter), var(--font-noto)",
  fontWeight: 600,
  textDecoration: "none",
};

/** ★箱の下のリンクの文言。すべての箱でこれ1つ */
export const RAIL_MORE_LABEL = "すべて見る →";

export const RAIL_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 600, color: "var(--ink)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.45,
};
export const RAIL_SUB_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.45,
};

/** 行どうしの間隔（すべての箱で同じ） */
export const RAIL_LIST_STYLE: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };

export function RailBox({ title, moreHref, state, children }: {
  title: React.ReactNode;
  /** 下の「すべて見る →」の行き先。無ければリンクを出さない */
  moreHref?: string | null;
  state?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={RAIL_BOX_STYLE} data-state={state} data-rail-box="">
      <h2 style={RAIL_TITLE_STYLE}>{title}</h2>
      {children}
      {moreHref && <Link href={moreHref} style={RAIL_MORE_STYLE} data-rail-more="">{RAIL_MORE_LABEL}</Link>}
    </section>
  );
}

/**
 * 1行。左に画像（40px）・真ん中に名前と補足（どちらも1行で省略）・右に操作。
 * ⚠️ href があれば画像と文字の部分がリンクになる。操作（action）はリンクの外に置く（ボタンをリンクの中に入れない）
 */
export function RailRow({ thumb, name, sub, href, action, title, state }: {
  thumb: React.ReactNode;
  name: React.ReactNode;
  sub?: React.ReactNode;
  href?: string | null;
  action?: React.ReactNode;
  /** 省略された全文（マウスを重ねたとき） */
  title?: string;
  state?: string;
}) {
  const body = (
    <>
      <span style={{ width: RAIL_THUMB, height: RAIL_THUMB, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{thumb}</span>
      <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={RAIL_NAME_STYLE}>{name}</span>
        {sub && <span style={RAIL_SUB_STYLE}>{sub}</span>}
      </span>
    </>
  );
  const bodyStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, textDecoration: "none", color: "var(--ink)", minHeight: RAIL_THUMB };
  return (
    <div data-rail-row="" data-state={state} title={title} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {href ? <Link href={href} style={bodyStyle}>{body}</Link> : <div style={bodyStyle}>{body}</div>}
      {action && <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
