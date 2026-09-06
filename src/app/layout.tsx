import type { Metadata } from "next";
import { Inter, Noto_Serif_JP } from "next/font/google";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

/*
 * ⚠️ 本文の和文（Noto Sans JP）は Webフォントを**やめた**（2026-08-09）。
 *    `--font-noto` は globals.css の :root でシステムフォントとして定義している。
 *
 * ── なぜやめたか ─────────────────────────────────────────────────────────
 * 初回訪問で **34ファイル・635KB** を落としていた。ページ全体のリクエスト58本の
 * うち35本がフォントで、JS(308KB)の2倍という最大の項目だった。
 *
 * ⚠️ **ウェイトを減らしても1バイトも減らない。** 可変フォントなので、
 *    400〜800 の5ウェイトは**同じ124ファイルを共有している**（実測）。
 *    「5ウェイトも要らないから減らそう」は効果ゼロ。確かめ方は CLAUDE.md 参照。
 *    重さの正体はウェイト数ではなく、和文が124個の unicode-range サブセットに
 *    分かれていて、そのうち34個が必要になること。ここは制御できない。
 *
 * ⚠️ 見出しの Noto Serif JP は**残す**。見出しは使う文字数が少ないため
 *    サブセット1個・33KB しか落ちず、ブランドの印象を担っている割に安い。
 *    数字・欧文の Inter も同じ理由で残す（1ファイル・48KB）。
 */

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
    /* ⚠️★**`images` を書かないこと**（2026-09-06 に外した）。
          ここに書くとファイル規約の [opengraph-image.tsx](./opengraph-image.tsx) を
          上書きする。**実際に実在しない `/og-image.png` を指しており、本番で 404**
          ——つまりサイト既定の OG 画像が一枚も出ていなかった。
          既定画像を変えたいときは opengraph-image.tsx を直す。 */
  },
  twitter: {
    card: "summary_large_image",
    title: "OPINIO | IT/SaaS業界特化のキャリアプラットフォーム",
    description:
      "IT/SaaS業界の企業情報と求人を、登録なしで。完全無料・営業電話なし。",
    /* ⚠️ 同上。書くと opengraph-image.tsx が Twitter カードに使われなくなる。 */
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
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/pwa/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/pwa/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    /* ⚠️ **存在しないファイルを指さない。** 2026-08-20 まで `/favicon-16x16.png` を
          指していたが public/ に無く、**全ページで 404**（訪問者全員が毎回1回叩く）。
          `/favicon.ico`（src/app/favicon.ico）は実在するのでそれを指す。 */
    shortcut: "/favicon.ico",
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
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
      // ⚠️ 「先輩と話し」から書き換えた（2026-08-04）。
      //    /people を「企業が承認した先輩の一覧」から「登録ユーザーの一覧」に
      //    位置づけ直したため、外向きの説明にだけ旧方針の語が残っていた。
      //    LP の見出し「確かめてから、動く。」と同じ言い方に寄せている。
      description:
        "IT/SaaS業界に特化したキャリアプラットフォーム。企業の今と、そこで働く人を確かめてから、自分で決める。完全無料・営業電話なし。",
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
    <html lang="ja" className={`${inter.variable} ${notoSerifJP.variable}`}>
      <head>
        {/* PWA */}
        {/* ⚠️ content / color は CSS ではないので var(--royal) は解決されない。16進で書く（--royal と同値） */}
        <meta name="theme-color" content="#002366" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OPINIO" />
        {/* ⚠️ apple-touch-icon はここに書かない。metadata.icons.apple が同じ link を出すので
               **2枚出ていた**（2026-09-06 に削除）。変えるときは metadata 側を直す。 */}
        {/* ⚠️ mask-icon（Safari のピン留めタブ）は **単色の SVG しか受け付けない。**
               2026-09-06 まで PNG を指しており、**一度も表示されていなかった。**
               色は color 属性で Safari が塗るので、SVG 側に fill を書かない。 */}
        <link rel="mask-icon" href="/icons/mask-icon.svg" color="#141414" />
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
