import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: { absolute: "プライバシーポリシー | OPINIO" },
  description: "OPINIO のプライバシーポリシーです。個人情報の取扱いについて定めています。",
  alternates: { canonical: "https://opinio.jp/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const filePath = path.join(process.cwd(), "content/legal/privacy-policy.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
