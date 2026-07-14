import { createAdminClient } from "@/lib/supabase/admin";
import SalarySubmitForm from "./SalarySubmitForm";

export const metadata = {
  title: "給与データを投稿 | OPINIO",
};

export default async function SalaryNewPage({
  searchParams,
}: {
  searchParams: { company_id?: string; company_name?: string };
}) {
  const admin = createAdminClient();

  // Load top-level role categories + their children
  const { data: roles } = await admin
    .from("ow_roles")
    .select("id, name, parent_id")
    .order("name");

  const allRoles = roles ?? [];
  const parents = allRoles.filter((r) => !r.parent_id);
  const children = allRoles.filter((r) => r.parent_id);

  const grouped = parents.map((p) => ({
    id: p.id,
    name: p.name,
    children: children.filter((c) => c.parent_id === p.id),
  }));

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
        給与データを投稿
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        匿名で投稿されます。5件以上集まると公開集計に使われます。
        個人が特定できる情報は収集しません。
      </p>
      <SalarySubmitForm
        grouped={grouped}
        prefillCompanyId={searchParams.company_id}
        prefillCompanyName={searchParams.company_name}
      />
    </main>
  );
}
