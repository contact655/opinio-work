import type { Metadata } from "next";
import { Suspense } from "react";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { MobileBottomNav } from "@/components/jobseeker/MobileBottomNav";
import { GlobalToast } from "@/components/ui/GlobalToast";
import { OnboardingGuard } from "@/components/jobseeker/OnboardingGuard";

export const metadata: Metadata = {
  title: {
    default: "IT/SaaS業界の転職・求人情報",
    template: "%s | OPINIO",
  },
  description:
    "IT/SaaS業界特化のキャリアプラットフォーム。編集部取材済みの企業情報・求人を掲載。スカウトなし・カジュアル面談対応。完全無料・営業電話なし・メール登録のみ。",
  openGraph: {
    title: "OPINIO | IT/SaaS業界特化の転職・求人情報",
    description: "IT/SaaS業界特化。編集部取材の企業情報・求人と、カジュアル面談でリアルな声が聞けるキャリアプラットフォーム。",
    type: "website",
    url: "https://opinio.jp",
    siteName: "OPINIO",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPINIO | IT/SaaS転職・キャリア",
    description: "IT/SaaS業界特化。企業情報・求人・カジュアル面談が揃うキャリアプラットフォーム。完全無料。",
  },
  alternates: {
    canonical: "https://opinio.jp",
  },
};

export default function JobseekerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Suspense fallback={null}><JobseekerHeader /></Suspense>
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>
      <JobseekerFooter />
      <MobileBottomNav />
      <GlobalToast />
      <OnboardingGuard />
    </div>
  );
}
