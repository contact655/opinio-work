import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyConnections } from "@/lib/companies/connections";
import { isRegisteredUser } from "@/lib/users/registered";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/jobseeker/companies/[id]/connections（2026-10-16 / フェーズ3）
 *
 * 閲覧者と相互フォローで、この会社に在籍中の人（本人が表示を許可した人だけ）。
 * ⚠️★**ログイン必須・キャッシュしない。** 閲覧者ごとに中身が違う。企業ページ（ISR）に混ぜないこと。
 * ⚠️ 判定は `lib/companies/connections.ts` の1か所。ここに条件を書かない。
 * ⚠️ 検証用アカウントの閲覧者には返さない（実在の人のつながりを検証用から見せない）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { data: viewer, error } = await createAdminClient()
    .from("ow_users").select("id, auth_id, is_test, is_system").eq("auth_id", user.id).maybeSingle();
  if (error) {
    console.error("[connections] viewer:", error.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500, headers: NO_STORE });
  }
  if (!viewer || !isRegisteredUser(viewer) || viewer.is_test || viewer.is_system) {
    return NextResponse.json({ connections: [] }, { headers: NO_STORE });
  }

  const connections = await getCompanyConnections(params.id, viewer.id as string);
  if (!connections) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ connections }, { headers: NO_STORE });
}
