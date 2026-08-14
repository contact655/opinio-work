import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext, getBizUserName } from "@/lib/business/dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "会社を追加 | OPINIO Business" },
};

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
    description: "自分が代表となる新しい会社を OPINIO に登録します",
  },
];

export default async function AddCompanyPage() {
  /*
    ⚠️ **所属が無い人にこそ出すページ。** 2026-08-14 まで
       `if (!ctx) return <BizNoTenantPage />` としており、企業に所属していない人には
       3つの選択肢が一度も出なかった。しかも `BizLayout` は所属が無いと
       `/biz/dashboard` をここへリダイレクトするので、

         /biz/dashboard → /biz/companies/add →「企業アカウントが必要です」
         → ボタンは「ホームへ戻る」と「企業アカウントを追加する →」だけ
         → どちらを押しても同じ画面

       という行き止まりになっていた（`/biz/companies/add/new` に直接来た人だけが
       会社を作れていた）。**ここで所属を要求しないこと。**
  */
  const ctx = await getTenantContext();
  const userName = ctx?.userName ?? (await getBizUserName());

  return (
    <BusinessLayout
      userName={userName}
      tenantName={ctx?.tenantName}
      tenantLogoGradient={ctx?.logoGradient}
      tenantLogoLetter={ctx?.logoLetter}
      memberships={ctx?.allCompanies}
      currentTenantId={ctx?.tenantId}
    >
      <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
        {/* 戻るリンク
            ⚠️ 所属が無いときは出さない。/biz/dashboard は BizLayout が
               このページへリダイレクトするので、押すと同じ画面に戻ってくる。 */}
        {ctx && <a
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
          ホームに戻る
        </a>}

        {/* タイトル */}
        <h1 style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 24, fontWeight: 700,
          color: "var(--ink)", marginBottom: 8,
        }}>
          会社を追加
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 40, lineHeight: 1.8 }}>
          参加方法を選んでください。
          {!ctx && (
            <>
              {/* ⚠️ 求職者としての登録（経歴）と企業アカウントは別物。
                     ここを書かないと「勤務先は登録済みなのに企業が無いと言われる」と読まれる。 */}
              <br />
              プロフィールに登録した勤務先とは別に、採用担当者として使う企業アカウントが必要です。
            </>
          )}
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
