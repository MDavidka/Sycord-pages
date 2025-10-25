import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID environment variable")
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing GOOGLE_CLIENT_SECRET environment variable")
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          hd: "ltpd.xyz",
        },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(code, metadata) {
      console.error(`NextAuth Error - Code: ${code}`, metadata)
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
