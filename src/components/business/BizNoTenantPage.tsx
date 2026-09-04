import { BusinessLayout } from "@/components/business/BusinessLayout";
import Link from "next/link";

type Props = {
  userName?: string;
};

/**
 * 企業アカウントがないユーザーに表示するフォールバックページ。
 * biz/* ページで共通利用。
 */
export function BizNoTenantPage({ userName = "ご担当者" }: Props) {
  return (
    <BusinessLayout userName={userName} hasCompany={false}>
      <div style={{
        maxWidth: 480,
        margin: "80px auto",
        padding: "40px 36px",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid var(--line)",
        textAlign: "center",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--royal-50)", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        </div>

        <h2 style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 20, fontWeight: 600, color: "var(--ink)",
          marginBottom: 10, lineHeight: 1.4,
        }}>
          企業アカウントが必要です
        </h2>
        <p style={{
          fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8,
          marginBottom: 28,
        }}>
          このページを利用するには、企業ロールの紐付けが必要です。<br />
          OPINIO運営より送られた招待リンクからご参加ください。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/biz/dashboard"
            style={{
              display: "block", padding: "12px 24px", borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              background: "var(--royal)", color: "#fff", textDecoration: "none",
            }}
          >
            ホームへ戻る
          </Link>
          <Link
            href="/biz/companies/add"
            style={{
              display: "block", padding: "10px 24px", borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              border: "1px solid var(--line)", color: "var(--ink-soft)",
              textDecoration: "none", background: "#fff",
            }}
          >
            企業アカウントを追加する →
          </Link>
        </div>
      </div>
    </BusinessLayout>
  );
}
