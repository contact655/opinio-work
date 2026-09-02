// 福利厚生・ツールセクション共通カードコンポーネント
// Server / Client どちらからも利用可能（hooks なし）

import React from "react";
import { chipStyle, type ChipVariant } from "@/lib/utils/chipVariant";

type InfoCardProps = {
  icon: React.ReactNode;
  /** ⚠️ 文字列でよい。`ReactNode` に広げてあるのは、開閉の印（シェブロン）を
   *     名前の隣に置くため（`HoverNoteCard`）。既存の呼び出しは文字列のまま動く。 */
  label: React.ReactNode;
  sublabel?: string;
  /**
   * 色は**役割**で決める。既定は neutral（色に意味を持たせない）。
   * `money` は金銭的にプラスの条件だけ（確定拠出年金・退職金・SO/RSU）。
   * ⚠️ 個別の色（color / bg / border）は受け取らない。
   *    呼び出し側で色を決められると、凡例の無い色分けがまた増える。
   * → src/lib/utils/chipVariant.ts
   */
  variant?: ChipVariant;
};

/**
 * ⚠️ 2026-08-08 に縦積み → 横並びにした。
 *    アイコン(30px) をラベルの上に積んでいたため、ツール1件のカードが
 *    **107px（補足なしで85px）**もあり、9件並ぶと縦に伸びていた。
 *    横並びなら 60px 前後で、情報量は変わらない。
 * ⚠️ 福利厚生セクションと共有している。片方だけ別の形にしないこと
 *    （同じ企業ページの中で、同じ見た目のカードが2種類あることになる）。
 */
export function InfoCard({ icon, label, sublabel, variant = "neutral" }: InfoCardProps) {
  const { color, bg, border } = chipStyle(variant);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
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
      <div style={{ minWidth: 0 }}>
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
