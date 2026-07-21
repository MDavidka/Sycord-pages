import GoogleProvider from "next-auth/providers/google"
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
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // console.log("[v0-DEBUG] JWT Callback Triggered")
      let client;
      let db;
      try {
        client = await clientPromise;
        db = client.db();
      } catch (err) {
        console.error("[v0] Torso not available, skipping user DB operations:", err);
        return token;
      }

      if (account && (profile || user)) {
        // Initial Sign In
        const profileId =
          (profile as any)?.sub ||
          (profile as any)?.user?.uid ||
          (profile as any)?.id ||
          (user as any)?.id;
        if (profileId) {
          token.id = profileId;
        }

        token.picture = (profile as any)?.picture || (user as any)?.image;
        token.email = (profile as any)?.email || (profile as any)?.user?.email || (user as any)?.email;
        token.name = (profile as any)?.name || (profile as any)?.user?.name || (profile as any)?.user?.username || (user as any)?.name;
        token.isPremium = false;

        // Initialize sessionVersion if not present
        token.sessionVersion = Date.now();

        // ALWAYS save/update user in Torso on login
        try {
          const existingUser = await db.collection("users").findOne<{
            user?: { join_date?: string }
            createdAt?: string
            git_conection?: unknown
            infromations?: unknown
            isBlocked?: boolean
          }>({ id: token.id as string });

          if (existingUser?.isBlocked) {
            // Reject sign-in for blocked accounts
            return null as any;
          }

          const now = new Date();
          const joinDate = existingUser?.user?.join_date || existingUser?.createdAt || now.toISOString();

          const updateData: Record<string, unknown> = {
            id: token.id,
            email: token.email,
            name: token.name,
            image: token.picture,
            updatedAt: now.toISOString(),
            sessionVersion: token.sessionVersion,
            user: {
              name: token.name,
              email: token.email,
              join_date: joinDate,
              ip: getRequestIP(),
            },
            git_conection: existingUser?.git_conection || {},
            infromations: existingUser?.infromations || {},
          };

          await db.collection("users").updateOne(
            { id: token.id as string },
            {
              $set: updateData,
              $setOnInsert: {
                createdAt: now.toISOString(),
              },
            },
            { upsert: true },
          );
        } catch (error) {
          console.error("[v0-ERROR] Failed to store/fetch user in Torso:", error);
          // Don't block login — continue with token from OAuth provider
        }
      } else {
        // Subsequent requests (check session version + block status)
        if (token.id) {
          try {
            const dbUser = await db.collection("users").findOne<{
              sessionVersion?: number
              isBlocked?: boolean
            }>({ id: token.id as string });
            if (dbUser?.isBlocked) {
              return null as any;
            }
            if (dbUser && dbUser.sessionVersion) {
              if (token.sessionVersion && (token.sessionVersion as number) < dbUser.sessionVersion) {
                // Token is older than server session version - invalidate
                return null;
              }
            }
          } catch (error) {
            console.error("[v0] Error validating session version:", error);
            // Don't block — let the JWT stay valid if DB is unavailable
          }
        }
      }

      return token;
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
