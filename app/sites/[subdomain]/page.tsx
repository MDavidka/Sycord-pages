import { notFound } from "next/navigation"
import clientPromise from "@/lib/mongodb"

interface PageProps {
  params: Promise<{
    subdomain: string
  }>
}

export default async function SubdomainPage({ params }: PageProps) {
  const { subdomain } = await params

  try {
    const client = await clientPromise
    const db = client.db()

    // Extract business name from subdomain (reverse the transformation)
    const businessName = subdomain.replace(/-/g, " ")

    const project = await db.collection("projects").findOne({
      businessName: { $regex: new RegExp(`^${businessName}$`, "i") },
    })

    if (!project) {
      return notFound()
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-foreground">{project.businessName}</h1>
            {project.businessDescription && <p className="text-muted-foreground mt-2">{project.businessDescription}</p>}
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="border border-border rounded-lg p-8 bg-card">
              <h2 className="text-2xl font-semibold mb-4">Üdvözöljük!</h2>
              <p className="text-muted-foreground mb-4">Ez a webhely a Sycord platformon készült.</p>

              {project.businessType && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Üzleti típus</h3>
                  <p className="text-muted-foreground">{project.businessType}</p>
                </div>
              )}

              {project.contactEmail && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Kapcsolat</h3>
                  <p className="text-muted-foreground">{project.contactEmail}</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-border mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            Powered by Sycord • © {new Date().getFullYear()}
          </div>
        </footer>
      </div>
    )
  } catch (error) {
    console.error("[v0] Error loading project:", error)
    return notFound()
  }
}
