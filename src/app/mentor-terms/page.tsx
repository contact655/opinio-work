import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "利用規約（メンター向け） | Opinio Work",
  description: "Opinio Work のメンター向け利用規約です。メンター登録をご検討の方は必ずお読みください。",
  robots: { index: true, follow: true },
};

export default function MentorTermsPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-mentor.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={content} />;
}
