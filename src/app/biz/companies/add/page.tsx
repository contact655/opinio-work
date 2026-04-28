import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "会社を追加 | Opinio Business",
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

const OPTIONS = [
  {
    href: "/biz/companies/add/token",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "招待コードを入力",
    description: "管理者から受け取った招待コードを入力します",
  },
  {
    href: "/biz/companies/add/url",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: "招待 URL を貼り付け",
    description: "メール等で受け取った招待 URL を貼り付けます",
  },
  {
    href: "/biz/companies/add/new",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: "新しい会社を作成",
    description: "自分が代表となる新しい会社を Opinio に登録します",
  },
];

export default async function AddCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
        {/* 戻るリンク */}
        <a
          href="/biz/dashboard"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
            marginBottom: 32,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          ダッシュボードに戻る
        </a>

        {/* タイトル */}
        <h1 style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 24, fontWeight: 700,
          color: "var(--ink)", marginBottom: 8,
        }}>
          会社を追加
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 40, lineHeight: 1.6 }}>
          参加方法を選んでください。
        </p>

        {/* 3 枚のカード */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {OPTIONS.map((opt) => (
            <a
              key={opt.href}
              href={opt.href}
              className="biz-add-card"
            >
              <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                {opt.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                  {opt.title}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {opt.description}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--ink-mute)", flexShrink: 0 }}>
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
        <style>{`
          .biz-add-card {
            display: flex; align-items: center; gap: 20px;
            padding: 20px 24px;
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 12px;
            text-decoration: none;
            color: inherit;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .biz-add-card:hover {
            border-color: var(--accent);
            box-shadow: 0 2px 12px rgba(59,95,217,0.10);
          }
        `}</style>
      </div>
    </BusinessLayout>
  );
}
