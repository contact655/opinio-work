import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { hasPublicCompanyPage } from "@/lib/companies/visibility";
import { BizShellProvider } from "@/components/business/BizShellContext";
import { BizFrame } from "@/components/business/BusinessLayout";

export const metadata: Metadata = {
  /* ★題名を持たない /biz の画面（ログインなど）の既定（2026-10-18）。それまで求職者向けの「OPINIO | IT業界の転職・求人情報」が出ていた */
  title: { absolute: "OPINIO Business" },
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
  // Check path before auth to avoid redirect loops on public biz pages (e.g. /biz/auth itself)
  const headersList = headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isExempt = MEMBERSHIP_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isExempt) return <>{children}</>;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/biz/auth");
  }

  if (!isExempt) {
    const admin = createAdminClient();
    const ctx = await getCompanyContext(admin, user.id);
    if (!ctx) {
      redirect("/biz/companies/add");
    }
  }

  /* ★サイドバーの「公開ページを見る」のため（2026-09-21）。
        ⚠️ ページ側と同じ `getTenantContext` を呼ぶ（`cache` で1回に畳まれる）。
           `getCompanyContext` の結果を使わないこと —— あちらは切り替え Cookie を見ないので、
           複数社に所属する人で**ページと違う会社**を指しうる。 */
  /* ⚠️ 複数社に所属していて切り替え Cookie が無いと `getTenantContext` は
        `/biz/select-company` へ redirect する。**その判断はページに任せる**
        （このレイアウトを足す前から、呼ばないページはそこへ飛ばしていなかった）。
        ここでは握って「公開ページを見る」を出さない側に倒すだけ。 */
  const tenant = await getTenantContext().catch(() => null);
  return (
    <BizShellProvider value={{
      tenantId: tenant?.tenantId ?? null,
      hasPublicPage: tenant ? hasPublicCompanyPage({ isPublished: tenant.isPublished }) : false,
      /* ★ヘッダーの名前と権限もここから（2026-09-21）。`loading.tsx` は `userName=""` を
            渡しているので、props だけだと**読み込み中はヘッダーの名前が空になる**。 */
      userName: tenant?.userName ?? null,
      permission: tenant?.currentPermission ?? null,
    }}>
      {/* ★サイドバーとヘッダーはここで1回だけ描く（2026-10-12）。ページを移っても作り直さない。
             ⚠️ 企業が取れないとき（複数社で未選択など）は枠を出さず、ページ側が全部を描く（従来どおり） */}
      {tenant ? (
        <BizFrame
          userName={tenant.userName}
          tenantName={tenant.tenantName}
          tenantLogoGradient={tenant.logoGradient}
          tenantLogoLetter={tenant.logoLetter}
          memberships={tenant.allCompanies}
          currentTenantId={tenant.tenantId}
        >
          {children}
        </BizFrame>
      ) : children}
    </BizShellProvider>
  );
}
