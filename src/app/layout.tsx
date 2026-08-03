import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
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
  // サイト共通の説明文。掲載数のような変動する数字はここに置かない
  // （全ページの既定値なので、古くなったときに気づけず外から見える説明が腐る）。
  // 実数はLPの generateMetadata が実データから出す。
  //
  // ⚠️ 2026-08-03: 「スカウトも営業電話もありません」を削除した。事実と異なっていたため。
  //    スカウト機能は実装済みで（ow_scouts / can_send_scout）、受け取る設定に
  //    した場合にだけ届く（初期設定はオフ）。この但し書きは説明文に収まらないので
  //    ここでは触れず、正確な説明は LP の FAQ に置いている。
  //    営業電話が無いのは事実なのでそちらは残す。
  description:
    "IT/SaaS業界の企業情報と求人を掲載。登録なしで全て読めます。完全無料・営業電話なし。",
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
      "IT/SaaS業界の企業情報と求人を掲載。登録なしで全て読めます。完全無料・営業電話なし。",
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
      "IT/SaaS業界の企業情報と求人を、登録なしで。完全無料・営業電話なし。",
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
        "IT/SaaS業界の企業情報・求人を、登録なしで全て読めるキャリアプラットフォーム。完全無料。",
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
      {/*
        ⚠️ inter.className を body に当てないこと（2026-08-03 修正）。
           Inter は日本語グリフを持たないため、body の font-family が Inter だけだと
           和文はすべて OS のフォールバック（macOS: Hiragino Sans / Windows: Yu Gothic）に落ちる。
           next/font で 400〜800 を読み込んでいる Noto Sans JP が一度も使われず、
           weight 500/600 は実ファイルが無いまま合成されるか、より細いウェイトに丸められていた。
           これが「文字が薄い」の主因だった（コントラスト不足ではない）。

           font-family は globals.css の body 側で
           「Inter（欧文・数字）→ Noto Sans JP（和文）」の順に指定する。
      */}
      <body className="antialiased">
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
        {/* <PageViewTracker /> */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
