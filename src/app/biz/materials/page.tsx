import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { listMaterials } from "@/lib/companyMaterials/server";
import MaterialsClient from "./MaterialsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業資料 | OPINIO Business" },
};

/**
 * ★企業資料（依頼② フェーズ1a / 2026-10-09）。
 *
 * 資料（ファイル・URL）を登録し、項目を手入力して、項目ごとに
 * 「公開 / 合意後に開示 / 内部のみ」を決めて確定する。
 *
 * ⚠️ 1a では資料の中身を読まない（AI による項目分けは 1b。規約の改定が先）。
 * ⚠️ 読みは `getTenantContext` で所属を確かめたあと、admin クライアント経由
 *    （表は RLS ポリシー0本・GRANT なし。`lib/companyMaterials/server.ts`）。
 * ⚠️ 閲覧権限の担当者は見るだけ。操作は管理者権限だけ（API 側でも断る）。
 * ⚠️ `loading.tsx` を置いていない。置くと認証まわりの redirect が 200 に化ける
 *    （CLAUDE.md「ソフト200」）。
 */
export default async function BizMaterialsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const data = await listMaterials(ctx.tenantId);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <MaterialsClient
        documents={data?.documents ?? []}
        items={data?.items ?? []}
        loadFailed={data === null}
        canEdit={ctx.currentPermission === "admin"}
      />
    </BusinessLayout>
  );
}
