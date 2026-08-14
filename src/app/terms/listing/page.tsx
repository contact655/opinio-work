import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "掲載利用規約（企業向け） | OPINIO" },
  description: "OPINIO の掲載利用規約（企業向け）です。企業情報を掲載する前に必ずお読みください。",
  alternates: { canonical: "https://opinio.jp/terms/listing" },
  robots: { index: true, follow: true },
};

export default function TermsListingPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-listing.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
