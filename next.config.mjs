/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            // This regex matches any subdomain of ltpd.xyz, but not www.ltpd.xyz or ltpd.xyz itself.
            value: '^(?!www)(?<subdomain>.*)\\.ltpd\\.xyz$',
          },
        ],
        destination: '/dashboard/webshop-demo',
      },
    ];
  },
};

export default nextConfig;
