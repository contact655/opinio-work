import type { Metadata } from "next";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export const metadata: Metadata = {
  title: "Opinio | 対話の、産業を作る。IT/SaaS業界のキャリアインフラ",
  description:
    "IT/SaaS業界に特化したキャリアプラットフォーム。企業の今を知り、先輩と話し、自分で決める。完全無料・営業電話なし。",
  openGraph: {
    title: "Opinio | 対話の、産業を作る。",
    description: "IT/SaaS業界に特化。求人・企業情報・先輩相談が揃うキャリアインフラ。",
    type: "website",
  },
};

export default function JobseekerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <JobseekerHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <JobseekerFooter />
    </div>
  );
}
