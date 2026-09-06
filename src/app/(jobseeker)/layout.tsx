import type { Metadata } from "next";
import { Suspense } from "react";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { MobileBottomNav } from "@/components/jobseeker/MobileBottomNav";
import { GlobalToast } from "@/components/ui/GlobalToast";
import { OnboardingGuard } from "@/components/jobseeker/OnboardingGuard";

export const metadata: Metadata = {
  title: {
    default: "IT業界の転職・求人情報",
    template: "%s | OPINIO",
  },
  /*
    ⚠️ ここは検索結果と SNS シェアに出る、外から見える説明文。
       方針を変えたら真っ先に直すこと。2026-08-03 に3点を修正した。

       1. 「カジュアル面談対応」を削除
          面談を前提にした説明はプラットフォーム側では使わない方針。

       2. 「編集部取材済み」「編集部取材の」を削除
          取材は前提ではないため「取材」という言葉を使わない方針
          （実際に取材した記事の中で「取材協力」と書くのは事実として正確なので、そちらは残す）。

       3. 「スカウトなし」「スカウトも営業電話もありません」を削除
          事実と異なっていた。スカウト機能は実装済みで（ow_scouts / can_send_scout）、
          2026-08-04 以降の新規登録は初期設定で受け取る（設定でオフにできる）。
          この但し書きは meta description に収まらないので、ここでは触れない。
          正確な説明は LP の FAQ にある。
  */
  description:
    "IT業界特化のキャリアプラットフォーム。企業情報・求人・そこで働く人の経歴まで、登録なしで検索できます。完全無料・営業電話なし・登録はメールのみ。",
  openGraph: {
    title: "OPINIO | IT業界特化の転職・求人情報",
    description: "IT業界特化。企業情報と求人を、登録なしでまとめて探せるキャリアプラットフォーム。",
    type: "website",
    url: "https://opinio.jp",
    siteName: "OPINIO",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPINIO | IT転職・キャリア",
    description: "IT業界特化。企業情報と求人を、登録なしで。完全無料・営業電話なし。",
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
