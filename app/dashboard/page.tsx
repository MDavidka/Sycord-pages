"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, Menu } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { ProjectForm } from "@/components/project-form"
import { useState, useEffect } from "react"
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

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects")
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchProjects()
    }
  }, [status])

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

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
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Üdvözöljük újra, {session?.user?.name || "Felhasználó"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">Itt láthatja, mi történik ma a projektjeivel.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Keresés a webhelyek között..."
              className="flex-1 p-3 border border-input rounded-md bg-transparent text-sm"
            />
            <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Új Projekt
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-foreground mb-2">Még nincsenek projektek</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Kezdje el első projektjét, és indítsa el weboldalát {"{"}név{"}"}.ltpd.xyz címen
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Első Projekt Létrehozása
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {projects.map((project: any) => (
              <div
                key={project._id}
                className="border border-border rounded-lg p-4 md:p-6 flex flex-col justify-between hover:border-foreground/20 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-base md:text-lg mb-2">{project.businessName}</h3>
                  <a
                    href={`https://${project.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs md:text-sm text-primary hover:underline break-all"
                  >
                    {project.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Létrehozva: {new Date(project.createdAt).toLocaleDateString("hu-HU")}
                  </p>
                </div>
                <div className="flex justify-end mt-4">
                  <Link href={`/dashboard/sites/${project._id}`}>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ProjectForm
          onSubmit={async (data) => {
            try {
              // 1. Create the project in the database
              const projectResponse = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              })

              if (projectResponse.ok) {
                const newProject = await projectResponse.json()
                setProjects([...projects, newProject])

                // 2. Trigger the live deployment to subdomain
                const subdomain = `${data.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz`

                const deployResponse = await fetch("/api/deployments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ subdomain, projectId: newProject._id }),
                })

                if (!deployResponse.ok) {
                  console.error("Deployment failed:", await deployResponse.text())
                }

                setIsModalOpen(false)
              }
            } catch (error) {
              console.error("Error creating project:", error)
            }
          }}
        />
      </Modal>
    </div>
  )
}
