"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingCart, HelpCircle } from "lucide-react"
import { useSession } from "next-auth/react"

export function BottomMenu() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isActive = (href: string) => pathname === href

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/subscriptions", label: "Plans", icon: ShoppingCart },
    { href: "#", label: "Help", icon: HelpCircle, disabled: true },
  ]

  return (
    <>
      {/* Mobile Bottom Menu */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border z-40">
        <div className="flex items-center justify-around h-16">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive(item.href)
                    ? "text-primary border-t-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                } ${item.disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Desktop Side Menu */}
      <div className="hidden md:fixed md:left-0 md:top-0 md:bottom-0 md:w-16 md:bg-card md:border-r md:border-border md:flex md:flex-col md:items-center md:justify-between md:p-4 md:pt-20">
        <div className="flex flex-col gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                } ${item.disabled ? "pointer-events-none opacity-50" : ""}`}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
