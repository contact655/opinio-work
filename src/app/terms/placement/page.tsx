import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "人材紹介利用規約（企業向け） | OPINIO" },
  description: "OPINIO の人材紹介利用規約（企業向け）です。成功報酬・採用決定の報告について定めています。",
  alternates: { canonical: "https://opinio.jp/terms/placement" },
  robots: { index: true, follow: true },
};

export default function TermsPlacementPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-placement.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
