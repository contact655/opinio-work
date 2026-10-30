import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/business/dashboard";
import { hasPublicCompanyPage } from "@/lib/companies/visibility";
import { BizShellProvider } from "@/components/business/BizShellContext";
import { BizFrame } from "@/components/business/BusinessLayout";
import { BizLoadError } from "@/components/business/BizLoadError";

/**
 * ★会社の担当者が使う画面の枠（2026-10-30 に app/biz/layout.tsx から移した）。
 *   ログインなど担当者でなくても開ける画面は (public)/ にあり、このレイアウトを通らない
 *   （以前ここにあった MEMBERSHIP_EXEMPT のパスの出し分けは要らなくなった）。
 */
export default async function BizAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "/biz";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/biz/auth");
  }

  const admin = createAdminClient();
  const ctx = await getCompanyContext(admin, user.id);
  if (!ctx) {
    redirect("/biz/companies/add");
  }

  /* ★サイドバーの「公開ページを見る」のため（2026-09-21）。
        ⚠️ ページ側と同じ `getTenantContext` を呼ぶ（`cache` で1回に畳まれる）。
           `getCompanyContext` の結果を使わないこと —— あちらは切り替え Cookie を見ないので、
           複数社に所属する人で**ページと違う会社**を指しうる。 */
  /* ⚠️ 複数社に所属していて切り替え Cookie が無いと `getTenantContext` は
        `/biz/select-company` へ redirect する。**その判断はページに任せる**
        （このレイアウトを足す前から、呼ばないページはそこへ飛ばしていなかった）。
        ここでは握って「公開ページを見る」を出さない側に倒すだけ。 */
  /* ★読み込みに失敗したとき（2026-10-30 / 柴さんの指示）。
        それまでは `.catch(() => null)` で失敗も「会社が取れない」と同じ扱いにし、**空のサイドバーで画面を描いていた**
        （エラーも出ないので、壊れたように見える）。上で担当者であることは確かめてあるので、ここで会社が取れないのは失敗。
        ⚠️ 複数社に所属していて会社を選んでいないとき（redirect）は従来どおりページに任せる（枠なしで描く） */
  let tenant: Awaited<ReturnType<typeof getTenantContext>> = null;
  let needsCompanyChoice = false;
  try {
    tenant = await getTenantContext();
  } catch (e) {
    if (isRedirectError(e)) needsCompanyChoice = true;
    else console.error("[biz/layout] getTenantContext:", e);
  }
  if (!tenant && !needsCompanyChoice) {
    console.error("[biz/layout] 担当者なのに会社の情報を読み込めなかった", { userId: user.id, pathname });
    return <BizLoadError retryHref={pathname} />;
  }
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
