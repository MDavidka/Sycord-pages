"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LanguageProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const locale = localStorage.getItem("locale")
    if (locale && !pathname.startsWith(`/${locale}`)) {
      const newPath = `/${locale}${pathname}`
      router.replace(newPath)
    }
  }, [pathname, router])

  return <>{children}</>
}