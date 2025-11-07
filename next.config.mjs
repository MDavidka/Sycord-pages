/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            // This regex matches any subdomain of ltpd.xyz, but not www.ltpd.xyz or ltpd.xyz itself.
            value: "^(?!www)(?<subdomain>.*)\\.ltpd\\.xyz$",
          },
        ],
        destination: "/sites/:subdomain/:path*",
      },
    ]
  },
}

export default nextConfig
