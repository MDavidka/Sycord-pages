import { notFound } from "next/navigation"
import clientPromise from "@/lib/mongodb"
import { currencySymbols, themeConfigs } from "@/lib/webshop-types"
import { Facebook, Instagram, Twitter, ShoppingCart } from "lucide-react"
import { ObjectId } from "mongodb"

interface PageProps {
  params: Promise<{
    subdomain: string
  }>
}

export default async function SubdomainPage({ params }: PageProps) {
  const { subdomain } = await params

  console.log("[v0] Loading subdomain:", subdomain)

  try {
    const client = await clientPromise
    const db = client.db()

    console.log("[v0] Webshop: Looking up deployment for subdomain:", subdomain)

    let deployment = await db.collection("deployments").findOne({
      subdomain: subdomain.toLowerCase(),
    })

    if (!deployment) {
      console.log("[v0] Webshop: Deployment not found by subdomain, trying project lookup")
      // Fallback: try to find a project directly by subdomain
      const project = await db.collection("projects").findOne({
        subdomain: subdomain.toLowerCase(),
      })

      if (project) {
        console.log("[v0] Webshop: Found project by subdomain, creating virtual deployment reference")
        deployment = {
          _id: new ObjectId(),
          projectId: project._id,
          subdomain: subdomain.toLowerCase(),
          status: "active",
        }
      }
    }

    if (!deployment) {
      console.log("[v0] Webshop: No deployment or project found for subdomain:", subdomain)
      notFound()
    }

    console.log("[v0] Webshop: Deployment found. ID:", deployment._id, "ProjectID:", deployment.projectId) // Add projectId logging

    const projectId = deployment.projectId
    if (!projectId) {
      console.error("[v0] Webshop: Deployment has no projectId field")
      notFound()
    }

    let projectObjectId: ObjectId
    try {
      if (projectId instanceof ObjectId) {
        projectObjectId = projectId
      } else if (typeof projectId === "string") {
        projectObjectId = new ObjectId(projectId)
      } else {
        throw new Error("Invalid projectId type")
      }
    } catch (err: any) {
      console.error("[v0] Webshop: Failed to convert projectId to ObjectId:", err.message)
      notFound()
    }

    console.log("[v0] Webshop: Querying project with ObjectId:", projectObjectId.toString())

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    })

    if (!project) {
      console.error("[v0] Webshop: Project not found for ObjectId:", projectObjectId.toString())
      notFound()
    }

    console.log("[v0] Webshop: Project found. Name:", project.businessName, "Has AI code:", !!project.aiGeneratedCode)

    if (project.pages || project.aiGeneratedCode) {
      console.log("[v0] Webshop: Rendering AI-generated site.")
      return (
        <div className="min-h-screen bg-background">
          <iframe
            src="/content/index.html"
            title="AI Generated Website"
            className="w-full min-h-screen border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
          />
        </div>
      )
    }

    console.log("[v0] Using default template")

    const settings = await db.collection("webshop_settings").findOne({ projectId: projectObjectId })
    const products = await db.collection("products").find({ projectId: projectObjectId }).toArray()

    const shopSettings = settings || {
      theme: "tech",
      currency: "USD",
      layout: "grid",
      showPrices: true,
      primaryColor: "#0f172a",
      secondaryColor: "#3b82f6",
      headerStyle: "hero",
      footerText: "All rights reserved.",
      contactEmail: "",
      socialLinks: {},
    }

    const currencySymbol = currencySymbols[shopSettings.currency as keyof typeof currencySymbols] || "$"
    const themeConfig = themeConfigs[shopSettings.theme as keyof typeof themeConfigs] || themeConfigs.tech

    const layoutClasses = {
      grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8",
      list: "flex flex-col gap-6",
      masonry: "columns-1 sm:columns-2 lg:columns-3 gap-8",
    }

    return (
      <div className={`min-h-screen ${themeConfig.bg}`}>
        <header className={`${themeConfig.header} sticky top-0 z-50`}>
          <div className={`container mx-auto px-4 py-6 flex justify-between items-center`}>
            <div>
              <h1 className={`text-3xl md:text-4xl font-bold ${themeConfig.accent}`}>{project.businessName}</h1>
              {project.businessDescription && (
                <p className={`${themeConfig.text} text-sm mt-1 opacity-80`}>{project.businessDescription}</p>
              )}
            </div>
            {shopSettings.headerStyle !== "hero" && (
              <button className={`relative p-3 rounded-full transition-all ${themeConfig.accent} hover:opacity-80`}>
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  0
                </span>
              </button>
            )}
          </div>
        </header>

        {shopSettings.headerStyle === "hero" && (
          <section className={`${themeConfig.bg} py-32 text-center border-b ${themeConfig.card}`}>
            <div className="container mx-auto px-4">
              <h2 className={`text-5xl md:text-6xl font-bold mb-6 ${themeConfig.accent}`}>
                Welcome to {project.businessName}
              </h2>
              <p className={`text-xl mb-8 max-w-2xl mx-auto ${themeConfig.text} opacity-80`}>
                {project.businessDescription || "Discover our amazing collection"}
              </p>
              <button
                className={`${themeConfig.button} px-8 py-3 rounded-lg font-semibold transition-all hover:scale-105`}
              >
                Shop Now
              </button>
            </div>
          </section>
        )}

        <main className="container mx-auto px-4 py-16">
          {products.length === 0 ? (
            <div className="text-center py-32">
              <ShoppingCart className={`h-20 w-20 mx-auto mb-6 ${themeConfig.accent} opacity-50`} />
              <h3 className={`text-3xl font-bold mb-2 ${themeConfig.text}`}>No Products Yet</h3>
              <p className={`${themeConfig.text} opacity-60`}>Check back soon!</p>
            </div>
          ) : (
            <>
              <h2 className={`text-4xl font-bold mb-12 ${themeConfig.accent}`}>Our Collection</h2>
              <div className={layoutClasses[shopSettings.layout as keyof typeof layoutClasses]}>
                {products.map((product) => (
                  <div
                    key={product._id.toString()}
                    className={`${themeConfig.card} rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
                  >
                    {product.image && (
                      <div className="w-full h-72 overflow-hidden bg-gray-200">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h3 className={`text-lg font-bold ${themeConfig.text}`}>{product.name}</h3>
                        {!product.inStock && (
                          <span className="text-xs bg-red-500/20 text-red-600 px-2 py-1 rounded-full">
                            Out of Stock
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <p className={`${themeConfig.text} text-sm opacity-70 mb-4 line-clamp-2`}>
                          {product.description}
                        </p>
                      )}
                      {product.category && (
                        <p className={`text-xs ${themeConfig.accent} mb-4 uppercase tracking-wide`}>
                          {product.category}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-300/20">
                        {shopSettings.showPrices && (
                          <span className={`text-2xl font-bold ${themeConfig.accent}`}>
                            {currencySymbol}
                            {product.price.toFixed(2)}
                          </span>
                        )}
                        <button
                          disabled={!product.inStock}
                          className={`${themeConfig.button} px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {product.inStock ? "Add to Cart" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        <footer className={`${themeConfig.header} border-t`}>
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
              <div>
                <p className={`${themeConfig.text} opacity-80 text-sm`}>
                  {shopSettings.footerText ||
                    `© ${new Date().getFullYear()} ${project.businessName}. All rights reserved.`}
                </p>
                {shopSettings.contactEmail && (
                  <p className={`${themeConfig.text} opacity-70 text-sm mt-1`}>Contact: {shopSettings.contactEmail}</p>
                )}
              </div>
              {(shopSettings.socialLinks?.facebook ||
                shopSettings.socialLinks?.instagram ||
                shopSettings.socialLinks?.twitter) && (
                <div className="flex gap-6">
                  {shopSettings.socialLinks.facebook && (
                    <a href={shopSettings.socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                      <Facebook className={`h-6 w-6 ${themeConfig.accent} hover:opacity-60 transition-opacity`} />
                    </a>
                  )}
                  {shopSettings.socialLinks.instagram && (
                    <a href={shopSettings.socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                      <Instagram className={`h-6 w-6 ${themeConfig.accent} hover:opacity-60 transition-opacity`} />
                    </a>
                  )}
                  {shopSettings.socialLinks.twitter && (
                    <a href={shopSettings.socialLinks.twitter} target="_blank" rel="noopener noreferrer">
                      <Twitter className={`h-6 w-6 ${themeConfig.accent} hover:opacity-60 transition-opacity`} />
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className={`text-center pt-8 border-t border-gray-400/20 ${themeConfig.text} opacity-60 text-xs`}>
              Powered by Sycord
            </div>
          </div>
        </footer>
      </div>
    )
  } catch (error) {
    console.error("[v0] Error loading project:", error)
    return notFound()
  }
}
