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
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://o4505551827705856.ingest.sentry.io",
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
