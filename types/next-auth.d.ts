import "next-auth"

// The auth callbacks (lib/auth.ts) attach a stable `id` (and `isPremium`) to the
// session user; declare it so server routes can read session.user.id safely.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      isPremium?: boolean
    }
  }
}
