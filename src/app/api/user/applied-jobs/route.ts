import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolveOwUserId } from "@/lib/supabase/resolveOwUserId";

export const dynamic = "force-dynamic";

// GET /api/user/applied-jobs — ログイン中ユーザーの応募済み job_id 一覧
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ids: [] }, { status: 200 });
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) {
    return NextResponse.json({ ids: [] }, { status: 200 });
  }

  const { data } = await supabase
    .from("ow_job_applications")
    .select("job_id")
    .eq("user_id", owUserId);

  const ids = (data ?? []).map((r: { job_id: string }) => r.job_id).filter(Boolean);
  return NextResponse.json({ ids });
}
