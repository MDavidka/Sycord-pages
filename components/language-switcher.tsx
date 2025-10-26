"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"

export default function LanguageSwitcher() {
  const pathname = usePathname()

  const handleLanguageChange = (newLang: string) => {
    const newPath = pathname.replace(/\/(en|hu|ro)/, `/${newLang}`)
    window.location.href = newPath
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
