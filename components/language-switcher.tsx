"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { GlobeIcon } from "lucide-react"

export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    localStorage.setItem("locale", newLocale)
    router.replace(newPath)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <GlobeIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleLanguageChange("en")}>
          {t("en")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("hu")}>
          {t("hu")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("ro")}>
          {t("ro")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}