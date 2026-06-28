import type { Metadata } from "next";
import CompareClient from "./CompareClient";

export const metadata: Metadata = {
  title: { absolute: "企業比較 | OPINIO" },
  description: "選択した企業を並べて比較できます。",
};

export default function ComparePage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      <CompareClient />
    </main>
  );
}
