import { notFound } from "next/navigation"
import clientPromise from "@/lib/mongodb"
import { currencySymbols } from "@/lib/webshop-types"
import { Facebook, Instagram, Twitter, ShoppingCart } from "lucide-react"
import { ObjectId } from "mongodb"

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

    const deployment = await db.collection("deployments").findOne({
      subdomain: subdomain.toLowerCase(),
    })

    if (!deployment) {
      console.error("[v0] Deployment not found for subdomain:", subdomain)
      return notFound()
    }

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(deployment.projectId),
    })

    if (!project) {
      console.error("[v0] Project not found for deployment")
      return notFound()
    }

    const projectId = project._id.toString()

    const settings = await db.collection("webshop_settings").findOne({ projectId })
    const products = await db.collection("products").find({ projectId }).toArray()

    const shopSettings = settings || {
      theme: "modern",
      currency: "USD",
      layout: "grid",
      showPrices: true,
      primaryColor: "#3b82f6",
      secondaryColor: "#8b5cf6",
      headerStyle: "simple",
      footerText: "All rights reserved.",
      contactEmail: "",
      socialLinks: {},
    }

    const currencySymbol = currencySymbols[shopSettings.currency as keyof typeof currencySymbols] || "$"

    const themeStyles = {
      modern: "bg-gradient-to-br from-blue-50 to-purple-50",
      minimal: "bg-white",
      bold: "bg-gradient-to-br from-red-50 to-orange-50",
      elegant: "bg-gradient-to-br from-purple-50 to-pink-50",
      dark: "bg-gray-900 text-white",
    }

    const headerStyles = {
      simple: "justify-between",
      centered: "flex-col items-center text-center",
      split: "justify-between",
    }

    const layoutClasses = {
      grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
      list: "flex flex-col gap-4",
      masonry: "columns-1 sm:columns-2 lg:columns-3 gap-6",
    }

    return (
      <div
        className={`min-h-screen ${themeStyles[shopSettings.theme as keyof typeof themeStyles] || themeStyles.modern}`}
      >
        {/* Header */}
        <header className="border-b backdrop-blur-sm bg-white/80 sticky top-0 z-50">
          <div
            className={`container mx-auto px-4 py-6 flex ${headerStyles[shopSettings.headerStyle as keyof typeof headerStyles]}`}
          >
            <div>
              <h1 className="text-3xl font-bold" style={{ color: shopSettings.primaryColor }}>
                {project.businessName}
              </h1>
              {project.businessDescription && (
                <p className="text-muted-foreground mt-1">{project.businessDescription}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  0
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: shopSettings.primaryColor }}>
            Welcome to Our Shop
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {project.businessDescription || "Discover our amazing collection of products"}
          </p>
          <button
            className="px-8 py-3 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: shopSettings.primaryColor }}
          >
            Shop Now
          </button>
        </section>

        {/* Products Section */}
        <main className="container mx-auto px-4 py-12">
          {products.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-2xl font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground">Check back soon for new arrivals!</p>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold mb-8" style={{ color: shopSettings.secondaryColor }}>
                Our Products
              </h2>
              <div className={layoutClasses[shopSettings.layout as keyof typeof layoutClasses]}>
                {products.map((product) => (
                  <div
                    key={product._id.toString()}
                    className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow ${
                      shopSettings.layout === "masonry" ? "mb-6 break-inside-avoid" : ""
                    } ${shopSettings.layout === "list" ? "flex flex-col md:flex-row" : ""}`}
                  >
                    {product.image && (
                      <div className={`${shopSettings.layout === "list" ? "md:w-48" : "w-full"} overflow-hidden`}>
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-64 object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                    <div className={`p-6 ${shopSettings.layout === "list" ? "flex-1" : ""}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{product.name}</h3>
                        {!product.inStock && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Out of Stock</span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                      )}
                      {product.category && (
                        <p className="text-sm text-muted-foreground mb-2">Category: {product.category}</p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        {shopSettings.showPrices && (
                          <span className="text-2xl font-bold" style={{ color: shopSettings.primaryColor }}>
                            {currencySymbol}
                            {product.price.toFixed(2)}
                          </span>
                        )}
                        <button
                          disabled={!product.inStock}
                          className="px-4 py-2 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: shopSettings.secondaryColor }}
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

        {/* Footer */}
        <footer className="border-t mt-16 backdrop-blur-sm bg-white/80">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">
                  {shopSettings.footerText ||
                    `© ${new Date().getFullYear()} ${project.businessName}. All rights reserved.`}
                </p>
                {shopSettings.contactEmail && (
                  <p className="text-sm text-muted-foreground mt-1">Contact: {shopSettings.contactEmail}</p>
                )}
              </div>
              {(shopSettings.socialLinks?.facebook ||
                shopSettings.socialLinks?.instagram ||
                shopSettings.socialLinks?.twitter) && (
                <div className="flex gap-4">
                  {shopSettings.socialLinks.facebook && (
                    <a
                      href={shopSettings.socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {shopSettings.socialLinks.instagram && (
                    <a
                      href={shopSettings.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {shopSettings.socialLinks.twitter && (
                    <a
                      href={shopSettings.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity"
                    >
                      <Twitter className="h-5 w-5" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="text-center mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground">Powered by Sycord</p>
            </div>
          </div>
        </footer>
      </div>
    )
  } catch (error) {
    console.error("Error loading project:", error)
    return notFound()
  }
}
