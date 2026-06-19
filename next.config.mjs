import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
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
  async redirects() {
    return [
      {
        source: "/for-companies",
        destination: "/business",
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
