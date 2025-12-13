"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, User, Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function DashboardHeader() {
  const { data: session } = useSession()
  const router = useRouter()

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/dashboard" className="text-sm text-foreground font-medium px-4 py-2 hover:bg-accent rounded-md">
            Áttekintés
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Projektek
          </Link>
          <Link
            href="/subscriptions"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Plans
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Analitika
          </Link>
          <Link
            href="/dashboard/webshop-demo"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Webshop Demo
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )

  return (
    <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={32} height={32} />
            <span className="text-xl font-semibold text-foreground">Sycord</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-foreground font-medium">
              Áttekintés
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Projektek
            </Link>
            <Link
              href="/subscriptions"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Plans
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Analitika
            </Link>
            <Link
              href="/dashboard/webshop-demo"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Webshop Demo
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <MobileNav />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Beállítások</span>
              </DropdownMenuItem>
              {session?.user?.email === "dmarton336@gmail.com" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span className="text-primary font-semibold">Admin Panel</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Kijelentkezés</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
