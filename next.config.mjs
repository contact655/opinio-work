/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/for-companies",
        destination: "/business",
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;
