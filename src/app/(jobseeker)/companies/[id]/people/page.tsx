/**
 * ★企業の現役社員・OB/OG の一覧（2026-11-26 / 柴さんの指示）。
 *   企業ページでは最大6名だけ出し、「すべて見る」でここへ来る。
 *
 * ⚠️ 人はブラウザで取る（CompanyEmployeeSections → /api/jobseeker/companies/[id]/employees）。
 *    ここで認証を読まない・人をサーバーで描かない（ログインユーザーのみの人の名前が HTML に入る）。
 * ⚠️ 検索エンジンには出さない（企業ページが正）。
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyBySlugOrId } from "@/lib/supabase/queries";
import { cleanEnName } from "@/lib/companies/displayName";
import { companyPath } from "@/lib/jobs/testViewMode";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CompanyEmployeeSections } from "../CompanyEmployeeSections";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const result = await getCompanyBySlugOrId(params.id);
  const name = result ? cleanEnName(result.company.name_en) ?? result.company.name : "企業";
  return { title: { absolute: `${name}の社員・OB/OG | OPINIO` }, robots: { index: false, follow: true } };
}

export default async function CompanyPeoplePage({ params }: { params: { id: string } }) {
  const result = await getCompanyBySlugOrId(params.id);
  if (!result) notFound();
  const { company } = result;
  const name = cleanEnName(company.name_en) ?? company.name;
  const href = companyPath(company.slug ?? company.id);

  return (
    <div style={{ background: "var(--bg-tint)" }}>
      <Breadcrumb items={[{ label: "企業", href: "/companies" }, { label: company.name, href }, { label: "社員・OB/OG" }]} />
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="cd-body px-4 pt-5 pb-10 md:px-12 md:pb-12">
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{name}の社員・OB/OG</h1>
        <p style={{ margin: "0 0 16px" }}>
          <Link href={href} style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>← 企業ページに戻る</Link>
        </p>
        <div className="dt-stack" data-state="company-people-list">
          <CompanyEmployeeSections companyId={company.id} />
        </div>
      </div>
    </div>
  );
}
