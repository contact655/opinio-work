import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCompanyContactPeople } from "@/lib/jobs/relatedPeople";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/jobseeker/companies/[id]/contacts
 *
 * ★企業ページのサイドバー「話せる人」（2026-11-26）。誰を出すかは lib/jobs/relatedPeople.ts の loadCompanyContactPeople。
 *   ⚠️★人の情報を ISR の HTML に入れないため、ページ本体ではなくここで返す（閲覧者ごとに作る・キャッシュしない）。
 *   ⚠️ 未ログインには「公開」の人だけ（求人ページの related-people と同じ）。
 *
 * 見られる会社: 詳細ページが公開されていて停止中でない会社。検証用の会社は検証用アカウントか、その会社の有効な担当者だけ。
 *   公開されていない会社（/biz のプレビュー）はその会社の有効な担当者だけ。
 *   それ以外は 404（会社があるかを区別させない）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return notFound();
  const admin = createAdminClient();
  const { data: co, error } = await admin.from("ow_companies")
    .select("id, is_published, is_test, suspended_at").eq("id", params.id).maybeSingle();
  if (error) {
    console.error("[company contacts] company:", error.message);
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }
  if (!co) return notFound();
  const open = co.is_published === true && !co.suspended_at;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  /* ⚠️ 公開されていない会社（担当者のプレビュー）と検証用の会社は、その会社の有効な担当者か（検証用の会社なら）検証用アカウントだけ */
  if (!open || co.is_test === true) {
    if (!user) return notFound();
    const { data: me, error: meErr } = await admin.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
    if (meErr) console.error("[company contacts] viewer:", meErr.message);
    let ok = open && me?.is_test === true;
    if (!ok && me) {
      const { data: adm, error: aErr } = await admin.from("ow_company_admins").select("id")
        .eq("company_id", co.id).eq("user_id", me.id).eq("is_active", true).limit(1);
      if (aErr) console.error("[company contacts] staff:", aErr.message);
      ok = (adm ?? []).length > 0;
    }
    if (!ok) return notFound();
  }

  const people = await loadCompanyContactPeople(co.id as string, { loggedIn: !!user });
  return NextResponse.json({ people }, { headers: { "Cache-Control": "private, no-store" } });
}

function notFound() {
  return NextResponse.json({ error: "見つかりません" }, { status: 404 });
}
