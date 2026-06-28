import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: { absolute: "OPINIO | IT/SaaS業界の転職・求人情報" },
  description:
    "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報と求人を掲載。スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
  alternates: { canonical: "https://opinio.jp" },
  openGraph: {
    title: "OPINIO | IT/SaaS業界特化のキャリアプラットフォーム",
    description:
      "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報と求人を掲載。スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
    type: "website",
    url: "https://opinio.jp",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
