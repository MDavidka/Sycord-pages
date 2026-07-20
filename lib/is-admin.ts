import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const ADMIN_EMAILS = ["admin@sycord.com"]

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return session?.user?.email ? ADMIN_EMAILS.includes(session.user.email) : false
}

export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error("Unauthorized: Admin access required")
  }
}
