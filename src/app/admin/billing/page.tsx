import { createAdminClient } from "@/lib/supabase/admin";
import { BillingClient, BillingRecord } from "./BillingClient";

export const dynamic = "force-dynamic";

async function getBillingRecords(): Promise<{ records: BillingRecord[]; error: boolean }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_job_applications")
    .select(`
      id, name, hired_salary, hired_confirmed_at,
      billing_status, billing_note, invoiced_at, paid_at,
      ow_jobs!job_id ( title, company_id,
        ow_companies!company_id ( name )
      ),
      ow_users!user_id ( name )
    `)
    .eq("status", "hired")
    .not("hired_salary", "is", null)
    .order("hired_confirmed_at", { ascending: false });

  if (error) {
    console.error("[billing] fetch error:", error.message);
    return { records: [], error: true };
  }

  return { records: (data ?? []).map((row) => {
    type JobRow = { title: string; ow_companies: { name: string } | null };
    const jobRaw = row.ow_jobs as unknown as JobRow | JobRow[] | null;
    const job = Array.isArray(jobRaw) ? (jobRaw[0] ?? null) : jobRaw;
    type UserRow = { name: string };
    const userRaw = row.ow_users as unknown as UserRow | UserRow[] | null;
    const user = Array.isArray(userRaw) ? (userRaw[0] ?? null) : userRaw;
    const companyRaw = job?.ow_companies as unknown as { name: string } | { name: string }[] | null;
    const company = Array.isArray(companyRaw) ? (companyRaw[0] ?? null) : companyRaw;
    return {
      id: row.id as string,
      companyName: company?.name ?? "—",
      jobTitle: job?.title ?? "—",
      applicantName: (user?.name ?? (row as { name?: string }).name) || "—",
      hiredSalary: row.hired_salary as number,
      hiredConfirmedAt: row.hired_confirmed_at as string,
      billingStatus: (row.billing_status as "unpaid" | "invoiced" | "paid") ?? "unpaid",
      billingNote: row.billing_note as string | null,
      invoicedAt: row.invoiced_at as string | null,
      paidAt: row.paid_at as string | null,
    };
  }), error: false };
}

export default async function AdminBillingPage() {
  const { records } = await getBillingRecords();

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>請求管理</h1>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", background: "var(--error)", color: "#fff", padding: "2px 7px", borderRadius: 4 }}>ADMIN</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
          採用確定が報告された案件の請求ステータスを管理します。成果報酬は採用年収 × 10%。
        </p>
      </div>

      <BillingClient records={records} />
    </div>
  );
}
