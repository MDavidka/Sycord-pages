import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import type { AuthOptions } from "next-auth"
import { headers } from "next/headers"
import clientPromise from "./torso"

// Log detailed warnings for debugging
if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("[v0] Auth Warning: Missing GOOGLE_CLIENT_ID")
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("[v0] Auth Warning: Missing GOOGLE_CLIENT_SECRET")
}
if (!process.env.AUTH_SECRET) {
  console.warn("[v0] Auth Warning: Missing AUTH_SECRET")
}

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

const getRequestIP = () => {
  try {
    const requestHeaders = headers()
    const forwarded = requestHeaders.get("x-forwarded-for")
    if (forwarded) {
      return forwarded.split(",")[0].trim()
    }
    return requestHeaders.get("x-real-ip") || "Unknown"
  } catch (error) {
    return "Unknown"
  }
}

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
          scope: "openid profile email https://www.googleapis.com/auth/cloud-platform",
        },
      },
    }),
    CredentialsProvider({
      id: "bypass",
      name: "Bypass",
      credentials: {
        email: { label: "Email", type: "text" }
      },
      async authorize(credentials) {
        if (credentials?.email === "dmarton336@gmail.com") {
          return {
            id: "admin-bypass-id",
            name: "Admin User",
            email: "dmarton336@gmail.com",
            image: "https://github.com/shadcn.png"
          }
        }
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // console.log("[v0-DEBUG] JWT Callback Triggered")
      const client = await clientPromise
      const db = client.db()

      if (account && (profile || user)) {
        // Initial Sign In
        const profileId =
          (profile as any)?.sub ||
          (profile as any)?.user?.uid ||
          (profile as any)?.id ||
          (user as any)?.id
        if (profileId) {
          token.id = profileId
        }

        token.picture = (profile as any)?.picture || (user as any)?.image
        token.email = (profile as any)?.email || (profile as any)?.user?.email || (user as any)?.email
        token.name = (profile as any)?.name || (profile as any)?.user?.name || (profile as any)?.user?.username || (user as any)?.name
        token.isPremium = false

        // Initialize sessionVersion if not present
        token.sessionVersion = Date.now();

        // ALWAYS save/update user in MongoDB on login
        try {
          const existingUser = await db.collection("users").findOne({ id: token.id })
          const now = new Date()
          const joinDate = existingUser?.user?.join_date || existingUser?.createdAt || now

          const updateData: any = {
            id: token.id,
            email: token.email,
            name: token.name,
            image: token.picture,
            updatedAt: now,
            sessionVersion: token.sessionVersion, // Set initial session version
            user: {
              name: token.name,
              email: token.email,
              join_date: joinDate,
              ip: getRequestIP(),
            },
            git_conection: existingUser?.git_conection || {},
            infromations: existingUser?.infromations || {},
          }

          await db.collection("users").updateOne(
            { id: token.id },
            {
              $set: updateData,
              $setOnInsert: {
                createdAt: now,
              },
            },
            { upsert: true },
          )
        } catch (error) {
          console.error("[v0-ERROR] Failed to store/fetch user in MongoDB:", error)
        }
      } else {
        // Subsequent requests (check session version)
        if (token.id) {
            try {
                const user = await db.collection("users").findOne({ id: token.id });
                if (user && user.sessionVersion) {
                    if (token.sessionVersion && (token.sessionVersion as number) < user.sessionVersion) {
                        // Token is older than server session version - invalidate
                        return null as any; // This will trigger a sign out / error
                    }
                }
            } catch (error) {
                console.error("Error validating session version:", error);
            }
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
      // console.log("[v0-EVENT] signIn", message.user.email, "Provider:", message.account?.provider)
    },
    async signOut(message) {
      try {
        const client = await clientPromise
        const db = client.db()
        // Invalidate session by updating version in DB
        // @ts-ignore
        const userId = message.token?.id || message.session?.user?.id
        const email = message.token?.email || message.session?.user?.email
        if (userId || email) {
          await db.collection("users").updateOne(
            userId ? { id: userId } : { email },
            { $set: { sessionVersion: Date.now() } }
          )
          // console.log(`[v0-EVENT] signOut: Invalidated session for user ${userId}`)
        }
      } catch (error) {
        console.error("[v0-EVENT] signOut ERROR:", error)
      }
    },
    async error(message) {
      console.error("[v0-EVENT] ERROR:", message)
    },
  },
}
