import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "利用規約（求職者向け） | OPINIO" },
  description: "OPINIO の利用規約（求職者向け）です。本サービスをご利用の前に必ずお読みください。",
  alternates: { canonical: "https://opinio.jp/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-jobseeker.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
