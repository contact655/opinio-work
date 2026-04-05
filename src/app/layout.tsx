import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "opinio.work — Truth to Careers",
  description:
    "IT/SaaS業界のビジネス職に特化した転職サービス。カルチャー・雰囲気で企業を選べる。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
