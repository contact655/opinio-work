import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import { resolveTestJobId } from "@/lib/supabase/queries";
import { JobDetailView } from "@/components/jobs/JobDetailView";

/**
 * ★検証用の会社の求人ページ（検証用アカウント専用。2026-10-12）。/jobs/[id] は ISR なので検証用の求人を出せない。
 * ⚠️ 見ている人が検証用でなければ 404。求人も「公開中かつ検証用」だけ（下書きは出さない）。
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "検証用の求人 | OPINIO" }, robots: { index: false, follow: false } };

export default async function TestJobPage({ params }: { params: { id: string } }) {
  if (!(await viewerIsTestUser())) notFound();
  const id = await resolveTestJobId(params.id);
  if (!id) notFound();
  return <JobDetailView id={id} testMode />;
}
