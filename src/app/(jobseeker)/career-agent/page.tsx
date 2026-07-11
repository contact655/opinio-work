import type { Metadata } from "next";
import CareerAgentClient from "./CareerAgentClient";

export const metadata: Metadata = {
  title: "無料キャリア相談 | OPINIO Career",
  description:
    "IT/SaaS・外資系・スタートアップへの転職を、先輩の声と一緒に決める。完全無料・営業電話なし。2営業日以内にオンライン面談でご対応します。",
  openGraph: {
    title: "無料キャリア相談 | OPINIO Career",
    description:
      "IT/SaaS・外資系・スタートアップへの転職を、先輩の声と一緒に決める。完全無料・営業電話なし。",
    url: "https://opinio.co.jp/career-agent",
    siteName: "OPINIO",
  },
  alternates: { canonical: "https://opinio.co.jp/career-agent" },
};

export default function CareerAgentPage() {
  return <CareerAgentClient />;
}
