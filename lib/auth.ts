import GoogleProvider from "next-auth/providers/google"
import type { AuthOptions } from "next-auth"

// Warn instead of crashing immediately to allow imports in other files
if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("Warning: Missing GOOGLE_CLIENT_ID environment variable")
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Warning: Missing GOOGLE_CLIENT_SECRET environment variable")
}

if (!process.env.AUTH_SECRET) {
  console.warn("Warning: Missing AUTH_SECRET environment variable")
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
      if (account && profile) {
        token.id = profile.sub
        token.picture = profile.picture
        token.email = profile.email
        token.name = profile.name
        token.isPremium = false
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
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(code: any, metadata: any) {
      console.error(`NextAuth Error - Code: ${code}`, JSON.stringify(metadata, null, 2))
    },
  },
}
