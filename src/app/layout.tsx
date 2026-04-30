import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Analytics } from "@/components/analytics/Analytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://opinio.jp"),
  title: {
    default: "opinio.jp｜キャリアに、第三者の目を。SaaS業界の転職プラットフォーム",
    template: "%s | opinio.jp",
  },
  description:
    "IT/SaaS業界の転職は、情報戦。Opinio編集部が120社を取材し、先輩メンターが相談に乗る、26-35歳のための転職プラットフォーム。完全無料。",
  keywords: [
    "IT転職",
    "SaaS転職",
    "カスタマーサクセス転職",
    "営業転職",
    "キャリア相談",
    "エージェント",
  ],
  authors: [{ name: "Opinio Inc." }],
  creator: "Opinio Inc.",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://opinio.jp",
    siteName: "opinio.jp",
    title: "opinio.jp｜キャリアに、第三者の目を。SaaS業界の転職プラットフォーム",
    description:
      "IT/SaaS業界の転職は、情報戦。Opinio編集部が120社を取材し、先輩メンターが相談に乗る、26-35歳のための転職プラットフォーム。完全無料。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "opinio.jp — キャリアに、第三者の目を。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "opinio.jp｜キャリアに、第三者の目を。SaaS業界の転職プラットフォーム",
    description:
      "Opinio編集部が120社を取材し、先輩メンターが相談に乗る、26-35歳のための転職プラットフォーム。完全無料。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
