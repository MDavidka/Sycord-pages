"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { ProjectForm } from "@/components/project-form"
import { useState, useEffect } from "react"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    async function fetchProjects() {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    }
    fetchProjects();
  }, []);

  if (status === "loading") {
    return <div>Betöltés...</div>
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
                Áttekintés
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Projektek
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Analitika
              </Link>
              <Link href="/dashboard/webshop-demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Webshop Demo
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
                alt="Felhasználói profil"
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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Üdvözöljük újra, {session?.user?.name || "Felhasználó"}
            </h1>
            <p className="text-muted-foreground">Itt láthatja, mi történik ma a projektjeivel.</p>
          </div>
          <div className="relative mt-4 md:mt-0">
            <input
              type="text"
              placeholder="Keresés a webhelyek között..."
              className="w-full md:w-64 p-2 border border-input rounded-md bg-transparent pr-10"
            />
            <Button className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" size="icon" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Project List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {projects.map((project, index) => (
            <div key={index} className="border border-border rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold">{project.businessName}</h3>
                <a
                href={`http://${project.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                {project.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz
                </a>
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
      </main>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ProjectForm
          onSubmit={async (data) => {
            // 1. Create the project in the database
            const projectResponse = await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });

            if (projectResponse.ok) {
              const newProject = await projectResponse.json();
              setProjects([...projects, newProject]);

              // 2. Trigger the live deployment
              const subdomain = `${data.businessName.toLowerCase().replace(/\s+/g, "-")}.ltpd.xyz`;
              await fetch("/api/deployments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subdomain }),
              });

              setIsModalOpen(false);
            }
          }}
        />
      </Modal>
    </div>
  )
}
