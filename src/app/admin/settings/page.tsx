import { createAdminClient } from "@/lib/supabase/admin";
import AdminSettingsClient from "./AdminSettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "設定 | OPINIO Admin" } };

export default async function AdminSettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ow_settings")
    .select("key, value")
    .in("key", ["review_gate_enabled"]);

  const settings: Record<string, string> = {};
  for (const row of data ?? []) settings[row.key] = row.value;

  return <AdminSettingsClient initialSettings={settings} />;
}
