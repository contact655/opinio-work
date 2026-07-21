import type { Metadata } from "next";
import LandingPage from "./LandingPage";

export const metadata: Metadata = {
  title: "OPINIO — IT/SaaS業界特化のキャリアプラットフォーム",
  description:
    "取材された企業情報と求人を、ひとつの場所に。スカウトも営業電話もなく、自分のペースでIT/SaaS企業のリアルを調べられます。",
  openGraph: {
    title: "OPINIO — 知ってから、動く。",
    description:
      "IT/SaaS業界に特化したキャリアプラットフォーム。取材された企業情報と求人票で、追われずに転職を考えられます。",
    url: "https://opinio.jp",
    siteName: "OPINIO",
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://opinio.jp" },
};

export default function HomePage() {
  return <LandingPage />;
}
