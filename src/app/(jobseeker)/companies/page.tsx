import type { Metadata } from "next";
import { Suspense } from "react";
import { getCompaniesForList } from "@/lib/supabase/queries";
import CompaniesClient from "./CompaniesClient";

export const metadata: Metadata = {
  title: "IT/SaaS企業を知る — Opinio",
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の企業の最新求人・組織文化・カジュアル面談情報をまとめて確認。",
};

export default async function CompaniesPage() {
  const companies = await getCompaniesForList();

  return (
    <Suspense fallback={
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-mute)", fontSize: 15 }}>
        読み込み中...
      </div>
    }>
      <CompaniesClient companies={companies} />
    </Suspense>
  );
}
