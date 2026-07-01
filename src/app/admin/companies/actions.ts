"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

const VALID_ENGAGEMENT = new Set(["none", "verified", "contracted"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateEngagementStatus(
  companyId: string,
  newStatus: string,
  verifiedAt: string | null,
  contractedAt: string | null,
): Promise<void> {
  if (!UUID_RE.test(companyId)) throw new Error("Invalid companyId");
  if (!VALID_ENGAGEMENT.has(newStatus)) throw new Error("Invalid status");
  await assertAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { engagement_status: newStatus, updated_at: now };
  if (newStatus === "verified" && !verifiedAt) updates.verified_at = now;
  if (newStatus === "contracted" && !contractedAt) updates.contracted_at = now;
  if (newStatus === "none" || newStatus === "verified") updates.jobs_public = false;
  await admin.from("ow_companies").update(updates).eq("id", companyId);
  revalidatePath("/admin/companies");
}

export async function updateJobsPublic(companyId: string, newValue: boolean): Promise<void> {
  if (!UUID_RE.test(companyId)) throw new Error("Invalid companyId");
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("ow_companies").update({ jobs_public: newValue, updated_at: new Date().toISOString() }).eq("id", companyId);
  revalidatePath("/admin/companies");
}

export async function updateIsPublished(companyId: string, newValue: boolean): Promise<void> {
  if (!UUID_RE.test(companyId)) throw new Error("Invalid companyId");
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("ow_companies").update({ is_published: newValue, updated_at: new Date().toISOString() }).eq("id", companyId);
  revalidatePath("/admin/companies");
}

export async function updateSortOrder(items: { id: string; sort_order: number }[]): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  await Promise.all(
    items
      .filter((item) => UUID_RE.test(item.id))
      .map((item) =>
        admin.from("ow_companies").update({ sort_order: item.sort_order }).eq("id", item.id)
      )
  );
  revalidatePath("/admin/companies");
}
