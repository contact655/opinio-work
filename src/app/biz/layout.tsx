import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// These paths are accessible without an active company membership
const MEMBERSHIP_EXEMPT = [
  "/biz/auth",
  "/biz/auth/signup",
  "/biz/auth/accept-invite",
  "/biz/select-company",
  "/biz/companies/add",
];

export default async function BizLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/biz/auth");
  }

  // Check if this path requires active company membership
  const headersList = headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isExempt = MEMBERSHIP_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isExempt) {
    const admin = createAdminClient();
    const ctx = await getCompanyContext(admin, user.id);
    if (!ctx) {
      redirect("/biz/companies/add");
    }
  }

  return <>{children}</>;
}
