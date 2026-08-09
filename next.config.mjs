import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xtutnecqeamftygufxco.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
    ],
  },
  async headers() {
    // CSP: script-src には 'unsafe-inline' が必要（Next.js のインラインスクリプト）。
    // script-src-elem で外部スクリプトを制限し、外部ドメインのスクリプト読み込みを防ぐ。
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.sentry-cdn.com https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      /* ⚠️ Sentry の送信先はプロジェクト固有のホスト。**ここを固定値で書かないこと。**
            2026-08-09 まで別プロジェクトの `o4505551827705856.ingest.sentry.io` が
            書かれており、実際の DSN（`o…4511592536276992.ingest.us.sentry.io`）と
            一致しないため、**本番のクライアントエラーが1件も届いていなかった**。
            JS は配信・実行されるので、画面もビルドも正常に見える。
            US / EU など地域サフィックスも変わるのでワイルドカードで受ける。 */
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
      /* Sentry の Session Replay が blob: の Worker を作る。
         これが無いと script-src にフォールバックして弾かれる */
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/for-companies",
        destination: "/business",
        permanent: true,
      },
      {
        source: "/mentors",
        destination: "/people",
        permanent: true,
      },
      {
        source: "/mentors/:path*",
        destination: "/people",
        permanent: true,
      },
      // 職種ページを ow_roles の9大分類に揃えた際に消えた2スラッグ（2026-08-03）。
      // 移行時点で両方とも0件だったが sitemap に載っていたのでクローラは辿る。
      // /jobs/dept/management は「経営・事業開発」で、9大分類では exec と bizdev に
      // 分かれる。ラベルの先頭が「経営」だったため exec に寄せた。
      {
        source: "/jobs/dept/management",
        destination: "/jobs/dept/exec",
        permanent: true,
      },
      // 「インフラ・SRE」は9大分類では engineer 配下（SRE/インフラ）に含まれる。
      {
        source: "/jobs/dept/infra",
        destination: "/jobs/dept/engineer",
        permanent: true,
      },
      {
        source: "/biz/company/employees/categories",
        destination: "/biz/organization",
        permanent: true,
      },
      {
        source: "/biz/company/employees/categories/:path*",
        destination: "/biz/organization/:path*",
        permanent: true,
      },
    ];
  },
};

const isDev = process.env.NODE_ENV === "development";

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: "opinio",
      project: "javascript-nextjs",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    });
