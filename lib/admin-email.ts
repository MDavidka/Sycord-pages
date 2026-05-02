const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL

if (!adminEmail) {
  throw new Error("ADMIN_EMAIL is not configured. Set NEXT_PUBLIC_ADMIN_EMAIL or ADMIN_EMAIL.")
}

export const ADMIN_EMAIL = adminEmail
