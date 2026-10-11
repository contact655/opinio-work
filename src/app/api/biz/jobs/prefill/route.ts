import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { runJobPrefill, isJobPrefillEnabled } from "@/lib/jobs/prefill";

export const dynamic = "force-dynamic";

/**
 * ★求人票の貼り付けから下書きを作る（段階3 / 2026-10-11）。
 * ⚠️★受け取った文章は保存しない・ログに出さない（lib/jobs/prefill.ts）。
 * ⚠️ 権限は求人の作成と同じ（その企業の管理者）。キーが無ければ 404（入口も出していない）。
 * ⚠️ 返すのは下書きだけ。DB の求人は1文字も変えない（入れるのはフォームで人が確認したとき）。
 */
export async function POST(req: Request) {
  if (!isJobPrefillEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  let body: { text?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.text !== "string") return NextResponse.json({ error: "求人票の文章を貼り付けてください" }, { status: 400 });

  const r = await runJobPrefill({ companyId: ctx.companyId, text: body.text });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ draft: r.draft, remaining: r.remaining });
}
