/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['ssh2', 'node-ssh'],
  async rewrites() {
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    const projectDomain = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN

    const hostnameRe = /^[a-zA-Z0-9._-]+$/
    if (!projectDomain || !hostnameRe.test(projectDomain)) return []

    if (
      !projectDomain.endsWith(".firebaseapp.com") ||
      projectDomain === "firebaseapp.com" ||
      projectDomain.includes("..")
    ) {
      console.warn(
        "[next.config] NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN must be a *.firebaseapp.com hostname " +
          `(got "${projectDomain}"). Firebase auth proxy disabled.`
      )
      return []
    }

    if (authDomain && projectDomain === authDomain) {
      console.warn(
        "[next.config] NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN equals NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN " +
          `("${projectDomain}"). The Firebase auth proxy would loop back to itself and has been disabled. ` +
          "Set NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN to your <project-id>.firebaseapp.com hostname."
      )
      return []
    }

    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${projectDomain}/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${projectDomain}/__/firebase/:path*`,
      },
    ]
  },
  async headers() {
    const crossOriginCredentialless = [
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
    ]

    return [
      // Global security headers for all routes.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // Preview-frame proxy: must be embeddable cross-origin inside the Syra iframe.
      // Override X-Frame-Options with an empty value so Vercel strips the header,
      // and set a permissive ACAO so the proxied Caddy ACAO doesn't block sycord.com.
      {
        source: "/api/workspace/preview-frame",
        headers: [
          // Empty value causes Next.js / Vercel to omit the header entirely.
          { key: "X-Frame-Options", value: "" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      { source: "/builder", headers: crossOriginCredentialless },
      { source: "/builder/:path*", headers: crossOriginCredentialless },
      { source: "/dashboard/sites/:id/syra", headers: crossOriginCredentialless },
      { source: "/dashboard/sites/:id/syra/:path*", headers: crossOriginCredentialless },
    ]
  },
  images: {
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
      {
        protocol: "https",
        hostname: "github.com",
        port: "",
        pathname: "/user-attachments/**",
      },
    ],
  },
}

export default nextConfig
