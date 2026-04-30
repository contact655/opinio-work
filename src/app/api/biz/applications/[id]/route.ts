import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { VALID_APPLICATION_STATUSES } from "@/lib/business/applications";
import { notify } from "@/lib/notify/email";
import { applicationStatusTemplate } from "@/lib/notify/templates";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const appId = params.id;
  const supabase = createClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newStatus = body.status;
  if (!newStatus || !VALID_APPLICATION_STATUSES.has(newStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${Array.from(VALID_APPLICATION_STATUSES).join(", ")}` },
      { status: 400 }
    );
  }

  // ── Company context (auth + companyId) ────────────────────────────────────
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Verify application belongs to this company (defense in depth) ─────────
  // RLS handles this automatically, but we also check explicitly to return
  // a proper 404 (vs silent 0-rows which RLS would produce).
  const { data: appRow } = await supabase
    .from("ow_job_applications")
    .select("id, ow_jobs!inner(company_id)")
    .eq("id", appId)
    .maybeSingle();

  if (!appRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Type assertion: ow_jobs join returns object
  const jobCompanyId = (appRow.ow_jobs as unknown as { company_id: string })?.company_id;
  if (jobCompanyId !== ctx.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── UPDATE + 0-rows detection (Commit W lesson: RLS silent block) ─────────
  const { data: updated, error } = await supabase
    .from("ow_job_applications")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", appId)
    .select("id")
    .single();

  if (error) {
    console.error("[applications PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updated) {
    // RLS blocked the UPDATE silently
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Notify (best-effort, T2) ──────────────────────────────────────────────
  const NOTIFY_STATUSES = new Set(["reviewing", "interview", "accepted", "rejected"]);
  if (NOTIFY_STATUSES.has(newStatus)) {
    const { data: appForNotify } = await supabase
      .from("ow_job_applications")
      .select("email, name, ow_jobs!inner(title, ow_companies!inner(name))")
      .eq("id", appId)
      .maybeSingle();

    if (appForNotify?.email) {
      const job = appForNotify.ow_jobs as unknown as {
        title: string;
        ow_companies: { name: string };
      } | null;
      await notify(
        applicationStatusTemplate({
          to: appForNotify.email,
          name: appForNotify.name ?? "",
          companyName: job?.ow_companies?.name ?? "",
          jobTitle: job?.title ?? "",
          status: newStatus as "reviewing" | "interview" | "accepted" | "rejected",
        })
      );
    }
  }

  return NextResponse.json({ ok: true, id: updated.id });
}
