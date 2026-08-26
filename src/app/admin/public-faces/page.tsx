import { getPublicFaces } from "@/lib/admin/publicFaces";
import { PublicFacesClient } from "./PublicFacesClient";

/**
 * 「いま公開面に出ている人」（2026-08-26）。
 *
 * ⚠️ **`/admin/candidates` とは別の問いに答える画面。**
 *    あちらは「登録している人は誰か」、ここは「**訪問者に実際に見えている人は誰か**」。
 *    混ぜると両方が読みにくくなるので分けてある。
 *
 * ⚠️ 判定は `lib/admin/publicFaces.ts`。**ここに条件を書かない。**
 */
export const dynamic = "force-dynamic";

export default async function PublicFacesPage() {
  const faces = await getPublicFaces();
  return <PublicFacesClient faces={faces} />;
}
