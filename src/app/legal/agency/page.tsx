import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "職業安定法に基づく明示事項 | OPINIO" },
  description: "OPINIOを運営する株式会社Opinioの、職業安定法第32条の13に基づく明示事項です。",
  alternates: { canonical: "https://opinio.jp/legal/agency" },
  robots: { index: true, follow: true },
};

export default function LegalAgencyPage() {
  const filePath = path.join(process.cwd(), "content/legal/legal-agency.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} showToc />;
}
