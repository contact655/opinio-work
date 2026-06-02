import type { Metadata } from "next";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { MobileBottomNav } from "@/components/jobseeker/MobileBottomNav";
import { GlobalToast } from "@/components/ui/GlobalToast";

export const metadata: Metadata = {
  title: {
    default: "OPINIO | IT/SaaS転職・キャリア相談。先輩と話して選ぶ。",
    template: "%s | OPINIO",
  },
  description:
    "IT/SaaS業界特化のキャリアプラットフォーム。36社の企業情報・求人を掲載し、現役先輩メンターに無料で相談できます。完全無料・営業電話なし・メール登録のみ。",
  openGraph: {
    title: "OPINIO | IT/SaaS転職・キャリア相談。先輩と話して選ぶ。",
    description: "IT/SaaS業界特化。36社の企業情報・求人と、現役先輩メンターへの無料相談が揃うキャリアプラットフォーム。",
    type: "website",
    url: "https://www.opinio.co.jp",
    siteName: "OPINIO",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPINIO | IT/SaaS転職・キャリア相談",
    description: "IT/SaaS業界特化。企業情報・求人・先輩メンター相談が揃うキャリアプラットフォーム。完全無料。",
  },
  alternates: {
    canonical: "https://www.opinio.co.jp",
  },
};

export default function JobseekerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <JobseekerHeader />
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>
      <JobseekerFooter />
      <MobileBottomNav />
      <GlobalToast />
    </div>
  );
}
