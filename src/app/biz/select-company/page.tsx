import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import SelectCompanyClient from "./SelectCompanyClient";

export default async function SelectCompanyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/biz/auth");

  // Pass undefined → ignore any existing cookie, fetch full membership list
  const ctx = await getCompanyContext(supabase, user.id, undefined);
  if (!ctx || ctx.allMemberships.length === 0) redirect("/biz/auth");
  if (ctx.allMemberships.length === 1) redirect("/biz/dashboard");

  // Fetch company names for display
  const { data: companies } = await supabase
    .from("ow_companies")
    .select("id, name, logo_gradient, logo_letter")
    .in("id", ctx.allMemberships.map((m) => m.companyId));

  const items = ctx.allMemberships.map((m) => {
    const company = companies?.find((c) => c.id === m.companyId);
    return {
      companyId: m.companyId,
      name: company?.name ?? "(不明)",
      logoGradient: company?.logo_gradient ?? null,
      logoLetter: company?.logo_letter ?? null,
      permission: m.permission,
      isDefault: m.isDefault,
    };
  });

  return <SelectCompanyClient items={items} />;
}
