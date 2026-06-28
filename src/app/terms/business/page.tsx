import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "利用規約（掲載企業向け） | OPINIO" },
  description: "OPINIO の利用規約（掲載企業向け）です。掲載企業としてご利用の前に必ずお読みください。",
  alternates: { canonical: "https://opinio.jp/terms/business" },
  robots: { index: true, follow: true },
};

export default function TermsBusinessPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-business.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
