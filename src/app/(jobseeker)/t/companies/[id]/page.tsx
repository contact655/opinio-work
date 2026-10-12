import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import { renderCompanyDetailPage } from "../../../companies/[id]/CompanyDetailPage";

/**
 * ★検証用の会社のページ（検証用アカウント専用。2026-10-12 / 柴さんの指示）。
 *   /companies/[id] は ISR で全員に同じ HTML を配るので、検証用の会社はそこでは出せない（404）。
 *   検証用アカウントには、ここ（動的・noindex）で同じ本体を描く。
 * ⚠️ 見ている人が検証用でなければ 404（未ログイン・実在の利用者には一切出さない）。判定はサーバーだけ。
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "検証用の会社 | OPINIO" }, robots: { index: false, follow: false } };

export default async function TestCompanyPage({ params }: { params: { id: string } }) {
  if (!(await viewerIsTestUser())) notFound();
  return renderCompanyDetailPage(params, true);
}
