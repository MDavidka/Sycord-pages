import CredentialsProvider from "next-auth/providers/credentials"
import type { AuthOptions } from "next-auth"
import clientPromise from "./mongodb"

// Log detailed warnings for debugging
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
    CredentialsProvider({
      name: "Vercel",
      credentials: {
        access_token: { label: "Access Token", type: "password" },
        refresh_token: { label: "Refresh Token", type: "password" },
        user_id: { label: "User ID", type: "text" },
        user_email: { label: "Email", type: "email" },
        user_name: { label: "Name", type: "text" },
        expires_at: { label: "Expires At", type: "text" },
      },
      async authorize(credentials) {
        // This is called after the OAuth callback stores tokens in session
        if (credentials?.access_token && credentials?.user_id && credentials?.user_email) {
          return {
            id: credentials.user_id,
            email: credentials.user_email,
            name: credentials.user_name || credentials.user_email,
            image: `https://vercel.com/api/www/avatar/${credentials.user_id}`,
            vercelAccessToken: credentials.access_token,
            vercelRefreshToken: credentials.refresh_token,
            vercelExpiresAt: credentials.expires_at,
          }
        }
        return null
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        // @ts-ignore
        token.vercelAccessToken = user.vercelAccessToken
        // @ts-ignore
        token.vercelRefreshToken = user.vercelRefreshToken
        // @ts-ignore
        token.vercelExpiresAt = user.vercelExpiresAt

        // ALWAYS save/update user in MongoDB on login
        try {
          const client = await clientPromise
          const db = client.db()

          const updateData: any = {
            id: token.id,
            email: token.email,
            name: token.name,
            image: token.picture,
            vercelAccessToken: token.vercelAccessToken,
            vercelRefreshToken: token.vercelRefreshToken,
            vercelExpiresAt: token.vercelExpiresAt,
            provider: "vercel",
            updatedAt: new Date(),
          }

          await db.collection("users").updateOne({ id: token.id }, { $set: updateData }, { upsert: true })

          console.log("[v0-DEBUG] Stored/Updated user in MongoDB:", token.id)
        } catch (error) {
          console.error("[v0-ERROR] Failed to store/fetch user in MongoDB:", error)
        }
      } else {
        // If no user, try to fetch from DB (session refresh)
        try {
          const client = await clientPromise
          const db = client.db()
          const user = await db.collection("users").findOne({ id: token.id })
          if (user) {
            token.vercelAccessToken = user.vercelAccessToken
            token.vercelRefreshToken = user.vercelRefreshToken
            token.vercelExpiresAt = user.vercelExpiresAt
          }
        } catch (error) {
          console.error("[v0-ERROR] Failed to fetch user from MongoDB:", error)
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
        session.user.vercelAccessToken = (token.vercelAccessToken as string) || null
        // @ts-ignore
        session.user.isPremium = false
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
      // console.log(`[NextAuth-DEBUG][${code}]`, JSON.stringify(metadata, null, 2))
    },
  },
  events: {
    async signIn(message) {
      console.log("[v0-EVENT] signIn", message.user.email)
    },
    async error(message) {
      console.error("[v0-EVENT] ERROR:", message)
    },
  },
}
