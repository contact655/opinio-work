"use client";

import CareerPromptCard from "@/components/profile/editor/CareerPromptCard";

/** ★プレビュー専用。押しても何も保存しない（`fail` のときは保存失敗を描く） */
export function CareerPromptDemo({ companyName, fail = false }: { companyName: string | null; fail?: boolean }) {
  return (
    <CareerPromptCard
      companyName={companyName}
      onAddRole={() => window.alert("（プレビュー）異動・昇進の追加モーダルが開く")}
      onAddPast={() => window.alert("（プレビュー）職歴の追加モーダルが開く")}
      onComplete={async () => {
        await new Promise((r) => setTimeout(r, 400));
        if (fail) throw new Error("preview");
        window.alert("（プレビュー）保存してカードが消える");
      }}
    />
  );
}
