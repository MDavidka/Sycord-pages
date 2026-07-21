/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['ssh2', 'node-ssh'],
  async rewrites() {
    // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is the custom authDomain (e.g. sycord.com).
    // NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN is the actual Firebase hosting origin
    // (e.g. <project-id>.firebaseapp.com) used as the proxy destination.
    //
    // These MUST be different values. If both point to the same host the proxy
    // would loop back to itself and Vercel returns 508 INFINITE_LOOP.
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    const projectDomain = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN

    // Validate that each value is a plain hostname (no protocol, path, or query chars)
    const hostnameRe = /^[a-zA-Z0-9._-]+$/
    if (!projectDomain || !hostnameRe.test(projectDomain)) return []

    // SSRF guard: only allow official Firebase Hosting origins. Rejects evil.com
    // and suffix tricks like firebaseapp.com.evil.com.
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

    // Guard: refuse to create a self-referential proxy that would cause an
    // infinite loop (e.g. authDomain === projectDomain === "sycord.com").
    if (authDomain && projectDomain === authDomain) {
      console.warn(
        "[next.config] NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN equals NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN " +
          `("${projectDomain}"). The Firebase auth proxy would loop back to itself and has been disabled. ` +
          "Set NEXT_PUBLIC_FIREBASE_PROJECT_DOMAIN to your <project-id>.firebaseapp.com hostname."
      )
      return []
    }

    return [
      // Proxy Firebase Auth popup/redirect handler so that signInWithPopup works
      // when authDomain is set to this app's custom domain instead of
      // the default <project>.firebaseapp.com.
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
    // WebContainers (used by the Glovix AI builder) require the embedding
    // document to be cross-origin isolated. These headers are intentionally
    // scoped to the builder routes only so the rest of the app (Firebase auth
    // popups, external embeds, etc.) is unaffected.
    const crossOriginCredentialless = [
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
    ]

    const crossOriginRequireCorp = [
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ]

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      { source: "/builder", headers: crossOriginCredentialless },
      { source: "/builder/:path*", headers: crossOriginCredentialless },
      { source: "/dashboard/sites/:id/syra", headers: crossOriginRequireCorp },
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
