import GoogleProvider from "next-auth/providers/google"
import type { AuthOptions } from "next-auth"
import clientPromise from "@/lib/mongodb"

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
      checks: ["state", "pkce"],
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
        domain: process.env.NODE_ENV === "production" ? ".ltpd.xyz" : undefined,
      },
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // 1. Determine User ID and Data
      let userId = token.id as string | undefined;
      let userEmail = token.email as string | undefined;
      let userName = token.name as string | undefined;
      let userImage = token.picture as string | undefined;

      if (profile) {
          // Fallback for Vercel which might not have 'sub' at top level of raw profile
          const profileId = profile.sub || profile.user?.uid || profile.id
          if (profileId) userId = profileId;
          if (profile.email || profile.user?.email) userEmail = profile.email || profile.user?.email;
          if (profile.name || profile.user?.name || profile.user?.username) userName = profile.name || profile.user?.name || profile.user?.username;
          if (profile.picture || profile.user?.uid) userImage = profile.picture || `https://vercel.com/api/www/avatar/${profile.user?.uid}`;

          token.id = userId;
          token.email = userEmail;
          token.name = userName;
          token.picture = userImage;
      }

      // 2. Persist User in MongoDB
      if (userId && (account || profile)) {
          try {
              const client = await clientPromise;
              const db = client.db();
              const updateDoc: any = {
                  $set: {
                      email: userEmail,
                      name: userName,
                      image: userImage,
                      lastLogin: new Date(),
                      ip: "unknown" // We can't easily get IP here, updated in API routes usually
                  },
                  $setOnInsert: {
                      createdAt: new Date(),
                      isPremium: false
                  }
              };

              // If Vercel login, save token
              if (account?.provider === "vercel") {
                  console.log("[v0-DEBUG] Vercel token detected, saving to database for user:", userId);
                  token.vercelAccessToken = account.access_token;
                  updateDoc.$set.vercelAccessToken = account.access_token;
                  updateDoc.$set.vercelConnected = true;
                  updateDoc.$set.vercelId = userId; // Vercel ID is the User ID in this context if logged in with Vercel
              }

              // Update or Insert User
              await db.collection("users").updateOne(
                  { _id: userId },
                  updateDoc,
                  { upsert: true }
              );
          } catch (e) {
              console.error("[v0-ERROR] Failed to save user to DB in JWT callback", e);
          }
      } else if (userId) {
          // If we don't have account/profile (subsequent requests), try to fetch Vercel token from DB if missing in token
          // This ensures if session cookie is lost but DB has it, we might recover it,
          // though usually we trust the token payload.
          // For now, rely on token persistence.
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
      // console.log(`[NextAuth-DEBUG][${code}]`, JSON.stringify(metadata, null, 2))
    }
  },
  events: {
    async signIn(message) {
        console.log("[v0-EVENT] signIn", message.user.email, "Provider:", message.account?.provider)
    },
    async error(message) {
        console.error("[v0-EVENT] ERROR:", message)
    }
  }
}
