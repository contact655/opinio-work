import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCompanyDetailPage } from "../../companies/[id]/CompanyDetailPage";

/**
 * ★求職者から見た企業ページのプレビュー（2026-10-12 / 柴さんの指示）。/biz のサイドバーと企業ページ編集の
 *   「求職者からの見え方」から開く。中身は /companies/[id] と同じ部品・同じ表示内容（公開済みの値。下書きは出さない）。
 *   ・その会社の担当者（ow_company_admins の有効な行）なら、掲載状態・検証用かどうかに関わらず開ける
 *   ・担当者でなければ 404。検索エンジンに出さない（noindex）。閲覧は数えない
 * ⚠️ 求職者側のレイアウト（ヘッダー等）で見せるため /biz の下ではなくここに置いている（/biz の枠に入れると見え方が変わる）。
 * ⚠️ 見る会社は /biz で選んでいる会社（getTenantContext）。URL で会社を選ばせない（他社のプレビューを開けないように）。
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "求職者から見た企業ページ | OPINIO Business" }, robots: { index: false, follow: false } };

export default async function CompanyPreviewPage() {
  const ctx = await getTenantContext();
  if (!ctx) notFound();
  const { data: c, error } = await createAdminClient().from("ow_companies")
    .select("id, slug, is_published, is_test").eq("id", ctx.tenantId).maybeSingle();
  if (error) console.error("[preview/company]", error.message);
  if (!c) notFound();
  const publicHref = `/companies/${(c.slug as string | null) ?? c.id}`;
  const bar: React.CSSProperties = { margin: 0, padding: "8px 16px", textAlign: "center", fontSize: 12.5, color: "var(--ink-mute)", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" };
  const banner = c.is_test ? (
    <p data-state="preview-banner-test" style={bar}>検証用の会社です。一般の利用者には表示されません</p>
  ) : c.is_published ? (
    <p data-state="preview-banner-live" style={bar}>
      求職者に公開中のページです　<a href={publicHref} target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", fontWeight: 600 }}>実際のページを開く ↗</a>
    </p>
  ) : (
    <p data-state="preview-banner-draft" style={bar}>プレビュー：まだ求職者には表示されていません</p>
  );
  return renderCompanyDetailPage({ id: c.id as string }, { preview: { companyId: c.id as string, banner } });
}
