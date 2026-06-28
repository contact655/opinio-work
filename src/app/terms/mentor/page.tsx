import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "利用規約（メンター向け） | OPINIO",
  description: "OPINIO の利用規約（メンター向け）です。メンターとしてご利用の前に必ずお読みください。",
  robots: { index: true, follow: true },
};

export default function TermsMentorPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-mentor.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
