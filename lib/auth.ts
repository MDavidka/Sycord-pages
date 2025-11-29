import GoogleProvider from "next-auth/providers/google"
import type { AuthOptions } from "next-auth"

// Log detailed warnings for debugging
if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("[v0] Auth Warning: Missing GOOGLE_CLIENT_ID")
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("[v0] Auth Warning: Missing GOOGLE_CLIENT_SECRET")
}
if (!process.env.VERCEL_CLIENT_ID) {
  console.warn("[v0] Auth Warning: Missing VERCEL_CLIENT_ID")
}
if (!process.env.VERCEL_CLIENT_SECRET) {
  console.warn("[v0] Auth Warning: Missing VERCEL_CLIENT_SECRET")
}
if (!process.env.AUTH_SECRET) {
  console.warn("[v0] Auth Warning: Missing AUTH_SECRET")
}

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "https://ltpd.xyz"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    // Custom Vercel Provider
    {
      id: "vercel",
      name: "Vercel",
      type: "oauth",
      clientId: process.env.VERCEL_CLIENT_ID,
      clientSecret: process.env.VERCEL_CLIENT_SECRET,
      authorization: {
        url: "https://vercel.com/oauth/authorize",
        params: { scope: "global" },
      },
      token: "https://api.vercel.com/v2/oauth/access_token",
      userinfo: "https://api.vercel.com/www/user",
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      // Ensure checks are standard. Vercel doesn't mandate PKCE but supports state.
      checks: ["state"],
      profile(profile) {
        return {
          id: profile.user.uid,
          name: profile.user.name || profile.user.username,
          email: profile.user.email,
          image: `https://vercel.com/api/www/avatar/${profile.user.uid}`,
        }
      },
    },
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" ? ".ltpd.xyz" : undefined,
      },
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log("[v0] JWT Callback Triggered")
      if (account) {
        console.log(`[v0] JWT Update: Provider=${account.provider}`)
      }

      if (account && profile) {
        token.id = profile.sub
        token.picture = profile.picture
        token.email = profile.email
        token.name = profile.name
        token.isPremium = false
      }
      // Store Vercel access token if logging in via Vercel or linking
      if (account?.provider === "vercel") {
        console.log("[v0] Vercel token detected, saving to session...")
        token.vercelAccessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.image = token.picture as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        // @ts-ignore
        session.user.isPremium = (token.isPremium as boolean) || false
        // @ts-ignore
        session.user.vercelAccessToken = token.vercelAccessToken as string | undefined

        // Log status of Vercel linking in session
        // @ts-ignore
        if (session.user.vercelAccessToken) {
             console.log(`[v0] Session created for user ${session.user.email} (Vercel Linked)`)
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  debug: true,
  logger: {
    error(code: any, metadata: any) {
      console.error(`[NextAuth][Error][${code}]`, JSON.stringify(metadata, null, 2))
    },
    warn(code: any) {
      console.warn(`[NextAuth][Warn][${code}]`)
    },
    debug(code: any, metadata: any) {
      console.log(`[NextAuth][Debug][${code}]`, JSON.stringify(metadata, null, 2))
    }
  },
  events: {
    async signIn(message) {
        console.log("[v0] Auth Event: signIn", message.user.email, "Provider:", message.account?.provider)
    },
    async linkAccount(message) {
        console.log("[v0] Auth Event: linkAccount", message.user.email, "Provider:", message.account.provider)
    },
    async session(message) {
        // console.log("[v0] Auth Event: session active") // Too verbose
    },
    async error(message) {
        console.error("[v0] Auth Event: ERROR", message)
    }
  }
}
