/**
 * ★企業ページ（/companies/[id]・ISR）。本体は `CompanyDetailPage.tsx`（2026-10-12 に分けた）。
 *   同じ本体を /t/companies/[id]（検証用アカウント専用・動的）が testMode で使うため。
 * ⚠️ ここで認証を読まないこと（ISR が効かなくなる）。
 */
import { renderCompanyDetailPage } from "./CompanyDetailPage";
export { generateStaticParams, generateMetadata } from "./CompanyDetailPage";

/* ⚠️ ルートの設定はこのファイルにだけ置く（値は元のまま） */
export const revalidate = 300;

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  return renderCompanyDetailPage(params, false);
}
