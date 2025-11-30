import GoogleProvider from "next-auth/providers/google"
import type { AuthOptions } from "next-auth"
import clientPromise from "./mongodb"

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

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

const getCookieDomain = () => {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const domain = new URL(url).hostname

  if (process.env.NODE_ENV === "production") {
    // For production, use domain without www prefix but with dot for subdomains
    return domain.startsWith("www.") ? domain.slice(4) : domain
  }
  return undefined // No domain restriction for local development
}

export const authOptions: AuthOptions = {
  url: NEXTAUTH_URL,
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
        params: { scope: "" }, // Empty scope or remove - Vercel uses "global" by default
      },
      token: "https://api.vercel.com/v2/oauth/access_token",
      userinfo: "https://api.vercel.com/www/user",
      client: {
        token_endpoint_auth_method: "client_secret_basic",
      },
      checks: ["state"],
      profile(profile) {
        console.log("[v0-DEBUG] Vercel Profile Callback RAW:", JSON.stringify(profile, null, 2))
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
        domain: getCookieDomain(),
      },
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log("[v0-DEBUG] JWT Callback Triggered")

      if (account && profile) {
        const profileId = profile.sub || profile.user?.uid || profile.id
        if (profileId) {
          token.id = profileId
        }

        token.picture = profile.picture || (profile.user?.uid ? `https://vercel.com/api/www/avatar/${profile.user.uid}` : null)
        token.email = profile.email || profile.user?.email
        token.name = profile.name || profile.user?.name || profile.user?.username
        token.isPremium = false

        // ALWAYS save/update user in MongoDB on login
        try {
          const client = await clientPromise
          const db = client.db()

          const updateData: any = {
            id: token.id,
            email: token.email,
            name: token.name,
            image: token.picture,
            updatedAt: new Date(),
          }

          // If logging in with Vercel, also save the access token
          if (account.provider === "vercel" && account.access_token) {
             updateData.vercelAccessToken = account.access_token
             updateData.vercelProvider = true
          }

          await db.collection("users").updateOne(
            { id: token.id },
            { $set: updateData },
            { upsert: true },
          )
          console.log("[v0-DEBUG] Stored/Updated user in MongoDB:", token.id, "Provider:", account.provider)
        } catch (error) {
          console.error("[v0-ERROR] Failed to store user in MongoDB:", error)
        }
      }

      // Restore Vercel token if it exists in DB but not in token (e.g. session refresh)
      if (token.id && !token.vercelAccessToken) {
        try {
          const client = await clientPromise
          const db = client.db()
          const user = await db.collection("users").findOne({ id: token.id })
          if (user?.vercelAccessToken) {
            token.vercelAccessToken = user.vercelAccessToken
          }
        } catch (error) {
          console.error("[v0-ERROR] Failed to fetch Vercel token from MongoDB:", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (token.id) session.user.id = token.id as string
        if (token.picture) session.user.image = token.picture as string
        if (token.email) session.user.email = token.email as string
        if (token.name) session.user.name = token.name as string

        // @ts-ignore
        session.user.isPremium = (token.isPremium as boolean) || false
        // @ts-ignore
        session.user.vercelAccessToken = token.vercelAccessToken as string | undefined
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
      console.error(`[NextAuth-ERROR][${code}]`, JSON.stringify(metadata, null, 2))
    },
    warn(code: any) {
      console.warn(`[NextAuth-WARN][${code}]`)
    },
    debug(code: any, metadata: any) {
      console.log(`[NextAuth-DEBUG][${code}]`, JSON.stringify(metadata, null, 2))
    },
  },
  events: {
    async signIn(message) {
      console.log("[v0-EVENT] signIn", message.user.email, "Provider:", message.account?.provider)
    },
    async error(message) {
      console.error("[v0-EVENT] ERROR:", message)
    },
  },
}
