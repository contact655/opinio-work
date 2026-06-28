import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "ログイン・新規登録 | OPINIO" },
  description: "OPINIOの無料会員登録・ログインページ。メールアドレスのみで登録できます。IT/SaaS業界の企業情報・求人・キャリア相談が全て無料で利用可能。",
};

// Auth pages get their own layout — no global header or footer
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
