"use client"

import { useLocale } from "next-intl"
import { useRouter, usePathname } from "next/navigation"

export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.replace(newPath)
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground"
    >
      <option value="en">English</option>
      <option value="hu">Magyar</option>
      <option value="ro">Română</option>
    </select>
  )
}
