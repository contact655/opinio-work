import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/business/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getTenantContext();
    if (!ctx) {
      return NextResponse.json({ pendingMeetings: 0, pendingApplications: 0 });
    }

    const supabase = createClient();
    const companyId = ctx.tenantId;

    // pending casual meetings (status = 'pending')
    const { count: meetingsCount } = await supabase
      .from("ow_casual_meetings")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");

    // new / unreviewed applications (status = 'pending')
    const { count: applicationsCount } = await supabase
      .from("ow_applications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");

    return NextResponse.json({
      pendingMeetings: meetingsCount ?? 0,
      pendingApplications: applicationsCount ?? 0,
    });
  } catch {
    return NextResponse.json({ pendingMeetings: 0, pendingApplications: 0 });
  }
}
