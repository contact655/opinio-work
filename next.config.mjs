/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/for-companies",
        destination: "/business",
        permanent: true, // 301
      },
      {
        source: "/biz/company/employees/categories",
        destination: "/biz/organization",
        permanent: true, // 301
      },
      {
        source: "/biz/company/employees/categories/:path*",
        destination: "/biz/organization/:path*",
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;
