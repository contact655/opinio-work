import React from "react";

/**
 * プレビューの1バリエーション枠（2026-08-30）。
 *
 * ⚠️★**固定幅で並べない。** 縦に積んで**本文幅いっぱい**に描く。
 *    固定幅の箱に入れると **CSS のメディアクエリが発火しない**
 *    （メディアクエリはビューポート幅を見る。コンテナ幅ではない）。
 *    ブラウザを 375 / 768 / 1300 にリサイズすれば**全バリエーションが同時に**追従する。
 *    → `.claude/rules/ui-debugging.md`「幅や座標を測るときは innerWidth を必ず一緒に出す」
 *
 * ⚠️ `note` には「何を見るか」を書く。件数だけ並べても、
 *    次に見る人がどこが危ないのか分からない。
 */
export function Variant({
  label, note, children,
}: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <h2 style={{
          margin: 0, fontSize: 13, fontWeight: 700, color: "var(--royal)",
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>{label}</h2>
        {note && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>{note}</p>
        )}
      </div>
      {/* ⚠️ 実ページと同じ「白いカードの中」に置く。背景が違うと色の印象が変わる */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
        {children}
      </div>
    </section>
  );
}

/** ページ冒頭の説明。**何を確認する画面か**を必ず書く */
export function PreviewHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{
        margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink)",
        fontFamily: "var(--font-noto-serif)",
      }}>{title}</h1>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>{children}</div>
      <p style={{
        margin: "12px 0 0", padding: "10px 12px", borderRadius: 8,
        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
        fontSize: 12, color: "var(--royal)", lineHeight: 1.7,
      }}>
        幅の確認は<strong>ブラウザ自体をリサイズ</strong>してください（375 / 768 / 1300）。
        固定幅の箱に入れていないので、全バリエーションが同時に追従します。
      </p>
      {/* ⚠️★2026-08-30 に実際に誤読しかけた。導入事例のカード高さを CLAUDE.md の
             実測値（1280px・企業ページ列幅 946px で 159px）と比べようとしたが、
             この画面の本文幅は最大 980px でカード幅が違うため一致しない。 */}
      <p style={{
        margin: "8px 0 0", padding: "10px 12px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "#92400E", lineHeight: 1.7,
      }}>
        <strong>絶対値（px）を実ページと比べないでください。</strong>
        この画面の本文幅は最大 980px で、企業詳細・求人詳細の列幅とは違います。
        ここで見るのは<strong>バリエーション同士の差</strong>（何件目で折りたたみが挟まるか、
        長文で崩れないか）です。実寸を測るときは実ページで測ってください。
      </p>
    </div>
  );
}
