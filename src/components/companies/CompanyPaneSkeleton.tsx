import React from "react";

/*
 * 右ペインの読み込み中（2026-09-18）。
 *
 * ⚠️★**これが無いと、企業を切り替えたときに前の企業の内容が出たまま残る。**
 *    ペインはサーバーで描くので、新しい RSC が届くまで古い内容が置き換わらない
 *    （実測: クリック→ペイン描画 約400ms）。`Suspense` の `key` を `?selected=` に
 *    して、企業が変わるたびにこのフォールバックへ戻す。
 * ⚠️ `key` を外さないこと。外すと Suspense の境界が再生成されず、
 *    **2社目以降はスケルトンが出ない**（1社目だけ出て直ったように見える）。
 */
function Block({ h }: { h: number }) {
  return <div style={{ height: h, borderRadius: 16, background: "var(--line-soft)" }} />;
}

export function CompanyPaneSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}
      aria-busy="true" aria-live="polite">
      {/* ⚠️ 文字を出さない。「読み込み中…」は、速いときに一瞬だけ出て逆に目立つ */}
      <span className="sr-only">企業の概要を読み込んでいます</span>
      <Block h={190} />
      <Block h={150} />
      <Block h={110} />
    </div>
  );
}

export default CompanyPaneSkeleton;
