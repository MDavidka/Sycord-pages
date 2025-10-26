"use client"

import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"

export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLang: string) => {
    router.push(`${pathname}?lang=${newLang}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleLanguageChange("en")}>English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("hu")}>Magyar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("ro")}>Română</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
