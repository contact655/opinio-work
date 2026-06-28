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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
