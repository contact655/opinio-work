import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadJobRelatedPeople } from "@/lib/jobs/relatedPeople";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobseeker/jobs/[id]/related-people
 *
 * ★求人ページのサイドバー「この募集に関わる人」（2026-11-26）。誰を出すかは lib/jobs/relatedPeople.ts。
 *   ⚠️★人の情報を ISR の HTML に入れないため、ページ本体ではなくここで返す（閲覧者ごとに作る・キャッシュしない）。
 *   ⚠️ 未ログインには「公開」の人だけ（会社で働く人の API と同じ）。
 *
 * 見られる求人:
 *   - 公開中の求人 … 誰でも。ただし検証用の求人は検証用アカウントか、その会社の有効な担当者だけ
 *   - 公開中でない求人（/biz のプレビュー）… その会社の有効な担当者だけ
 *   それ以外は 404（求人があるかを区別させない）。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const notFound = () => NextResponse.json({ people: [] }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return notFound();

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("ow_jobs").select("id, company_id, role_category_id, status, is_test, company_suspended")
    .eq("id", params.id).maybeSingle();
  if (error) { console.error("[related-people] job:", error.message); return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 }); }
  if (!job) return notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let viewerIsTest = false;
  let viewerIsStaff = false;
  if (user) {
    const { data: me, error: meErr } = await admin.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
    if (meErr) console.error("[related-people] viewer:", meErr.message);
    viewerIsTest = me?.is_test === true;
    if (me) {
      const { data: adm, error: aErr } = await admin.from("ow_company_admins").select("id")
        .eq("company_id", job.company_id).eq("user_id", me.id).eq("is_active", true).limit(1);
      if (aErr) console.error("[related-people] staff:", aErr.message);
      viewerIsStaff = (adm ?? []).length > 0;
    }
  }

  const published = job.status === "published" && job.company_suspended !== true;
  if (!published && !viewerIsStaff) return notFound();
  if (job.is_test === true && !viewerIsTest && !viewerIsStaff) return notFound();

  const people = await loadJobRelatedPeople(
    { id: job.id as string, company_id: job.company_id as string, role_category_id: (job.role_category_id as string | null) ?? null },
    { loggedIn: !!user },
  );
  return NextResponse.json({ people }, { headers: { "Cache-Control": "private, no-store" } });
}
