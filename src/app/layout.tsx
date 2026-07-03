import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import { Analytics } from "@/components/analytics/Analytics";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import NextTopLoader from "nextjs-toploader";
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

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://opinio.jp"),
  title: {
    default: "OPINIO | IT/SaaS業界の転職・求人情報",
    template: "%s | OPINIO",
  },
  description:
    "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報と求人を掲載。スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
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
    siteName: "OPINIO",
    title: "OPINIO | IT/SaaS業界特化のキャリアプラットフォーム",
    description:
      "IT/SaaS業界の転職は、情報戦。OPINIO編集部が120社を取材し、スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OPINIO — キャリアに、第三者の目を。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OPINIO | IT/SaaS業界特化のキャリアプラットフォーム",
    description:
      "OPINIO編集部が120社を取材し、スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/pwa/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/pwa/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon-16x16.png",
    apple: { url: "/icons/pwa/icon-192.png", sizes: "192x192" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OPINIO",
  },
  formatDetection: {
    telephone: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://opinio.jp/#organization",
      name: "OPINIO",
      url: "https://opinio.jp",
      logo: {
        "@type": "ImageObject",
        url: "https://opinio.jp/opengraph-image.png",
      },
      description:
        "IT/SaaS業界に特化したキャリアプラットフォーム。企業の今を知り、先輩と話し、自分で決める。完全無料・営業電話なし。",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": "https://opinio.jp/#website",
      url: "https://opinio.jp",
      name: "OPINIO",
      description:
        "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報・求人を掲載。スカウトなし・カジュアル面談対応のキャリアプラットフォーム。完全無料。",
      publisher: { "@id": "https://opinio.jp/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://opinio.jp/jobs?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable} ${notoSerifJP.variable}`}>
      <head>
        {/* PWA */}
        <meta name="theme-color" content="var(--royal)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OPINIO" />
        <link rel="apple-touch-icon" href="/icons/pwa/icon-192.png" />
        <link rel="mask-icon" href="/icons/pwa/icon-192.png" color="var(--royal)" />
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <NextTopLoader
          color="var(--royal, var(--royal))"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px rgba(0,35,102,0.4),0 0 5px rgba(0,35,102,0.3)"
        />
        <a href="#main-content" className="skip-to-main">メインコンテンツへスキップ</a>
        {children}
        <Analytics />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
