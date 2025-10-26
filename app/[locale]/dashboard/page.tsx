"use client"

import {Link} from "../../../navigation"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import {useTranslations} from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") {
    return <div>{t('Loading')}</div>
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} />
              <span className="text-xl font-semibold text-foreground">Sycord</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm text-foreground font-medium">
                {t('Overview')}
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('Projects')}
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t('Analytics')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Settings className="h-5 w-5" />
            </Button>
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt="User profile"
                width={32}
                height={32}
                className="rounded-full cursor-pointer"
                onClick={() => signOut()}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('Welcome', {name: session?.user?.name || "User"})}
          </h1>
          <p className="text-muted-foreground">{t('WelcomeSubtitle')}</p>
        </div>
      </main>
    </div>
  )
}
