import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

function loadAdminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const defaultAdmins = ["dmarton336@gmail.com"]
  return Array.from(new Set([...defaultAdmins, ...fromEnv]))
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return loadAdminEmails().includes(email.toLowerCase())
}

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return isAdminEmail(session?.user?.email)
}

export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error("Unauthorized: Admin access required")
  }
}
