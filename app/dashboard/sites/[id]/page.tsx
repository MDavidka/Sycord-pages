"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import AIWebsiteBuilder from "@/components/ai-website-builder"
import {
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Palette,
  ShoppingCart,
  MessageCircle,
} from "lucide-react"
import { currencySymbols } from "@/lib/webshop-types"

const StyleOptionsComponent = ({
  onSelectStyle,
  isLoading,
}: {
  onSelectStyle: (style: string) => void
  isLoading: boolean
}) => {
  const options = [
    {
      id: "default",
      name: "Default",
      description: "Clean, minimal starting template",
      icon: "✨",
    },
    {
      id: "browse",
      name: "Browse",
      description: "Coming soon - Choose from templates",
      icon: "🎨",
      disabled: true,
    },
    {
      id: "ai",
      name: "AI Builder",
      description: "Create with Google AI assistance",
      icon: "🤖",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => !option.disabled && onSelectStyle(option.id)}
          disabled={option.disabled || isLoading}
          className={`relative p-8 rounded-xl border-2 transition-all duration-300 transform ${
            option.disabled
              ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
              : "border-gray-300 hover:border-primary hover:shadow-lg cursor-pointer hover:scale-105"
          }`}
        >
          <div className="text-4xl mb-4">{option.icon}</div>
          <h3 className="font-bold text-lg mb-2">{option.name}</h3>
          <p className="text-sm text-muted-foreground">{option.description}</p>
          {option.disabled && <div className="text-xs text-muted-foreground mt-3">🔄 Coming Soon</div>}
        </button>
      ))}
    </div>
  )
}

const headerComponents = {
  simple: { name: "Simple", description: "A clean, minimalist header" },
  centered: { name: "Centered", description: "Logo and navigation centered" },
  hero: { name: "Hero", description: "Large header with a call to action" },
  luxe: { name: "Luxe", description: "Elegant header with premium feel" },
  split: { name: "Split", description: "Header split into two sections" },
}

const heroComponents = {
  none: { name: "None", description: "No hero section" },
  basic: { name: "Basic", description: "Simple title and subtitle" },
  image: { name: "Image", description: "Hero with background image" },
  carousel: { name: "Carousel", description: "Rotating hero images" },
  video: { name: "Video", description: "Hero with background video" },
}

const productComponents = {
  grid: { name: "Grid", description: "Products in a grid layout" },
  list: { name: "List", description: "Products in a vertical list" },
  masonry: { name: "Masonry", description: "Masonry grid for products" },
  carousel: { name: "Carousel", description: "Scrollable product carousel" },
}

export default function SiteSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deployment, setDeployment] = useState<any>(null)

  const [projectLoading, setProjectLoading] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [deploymentLoading, setDeploymentLoading] = useState(true)

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    category: "",
    inStock: true,
  })
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<"styles" | "products">("styles")
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchAllData = async () => {
      try {
        fetch(`/api/projects/${id}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.message) throw new Error(data.message)
            setProject(data)
            setProjectLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Error fetching project:", err)
            setProjectLoading(false)
          })

        fetch(`/api/projects/${id}/settings`)
          .then((r) => r.json())
          .then((data) => {
            setSettings(data)
            setSettingsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Error fetching settings:", err)
            setSettingsLoading(false)
          })

        fetch(`/api/projects/${id}/products`)
          .then((r) => r.json())
          .then((data) => {
            setProducts(Array.isArray(data) ? data : [])
            setProductsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Error fetching products:", err)
            setProductsLoading(false)
          })

        fetch(`/api/projects/${id}/deployments`)
          .then((r) => r.json())
          .then((data) => {
            setDeployment(data.deployment || null)
            setDeploymentLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Error fetching deployment:", err)
            setDeploymentLoading(false)
          })
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchAllData()
  }, [id])

  const handleStyleSelect = (style: string) => {
    console.log("[v0] Selected style:", style)
    setSelectedStyle(style)
  }

  const handleComponentSelect = async (componentType: string, componentValue: string) => {
    console.log(`[v0] Selecting ${componentType}: ${componentValue}`)
    setSettings((prev: any) => ({
      ...prev,
      [componentType]: componentValue,
    }))
  }

  const handleSettingsUpdate = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)

    try {
      console.log("[v0] Sending settings to API:", settings)

      if (!settings.headerComponent) {
        throw new Error("Please select a header style")
      }
      if (!settings.heroComponent) {
        throw new Error("Please select a hero section")
      }
      if (!settings.productComponent) {
        throw new Error("Please select a product layout")
      }

      const response = await fetch(`/api/projects/${id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      const responseData = await response.json()
      console.log("[v0] API response:", responseData)

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to save settings")
      }

      setSaveSuccess(true)
      await fetch(`/api/projects/${id}/settings`)
        .then((r) => r.json())
        .then(setSettings)

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error: any) {
      setSaveError(error.message || "An error occurred while saving")
      console.error("[v0] Settings save error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddProduct = async () => {
    setProductError(null)

    if (!newProduct.name || !newProduct.name.trim()) {
      setProductError("Product name is required")
      return
    }

    if (newProduct.price < 0) {
      setProductError("Price cannot be negative")
      return
    }

    setIsAddingProduct(true)

    try {
      const response = await fetch(`/api/projects/${id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to add product")
      }

      const addedProduct = await response.json()
      setProducts([...products, addedProduct])
      setNewProduct({
        name: "",
        description: "",
        price: 0,
        image: "",
        category: "",
        inStock: true,
      })
    } catch (error: any) {
      setProductError(error.message || "An error occurred while adding the product")
      console.error("[v0] Add product error:", error)
    } finally {
      setIsAddingProduct(false)
    }
  }

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${id}/products?productId=${productId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete product")
      }

      setProducts(products.filter((p) => p._id !== productId))
    } catch (error: any) {
      console.error("[v0] Delete product error:", error)
      alert("Failed to delete product. Please try again.")
    }
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading site settings...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">This project no longer exists or you don't have access to it.</p>
          <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  const subdomain = project.businessName?.toLowerCase().replace(/\s+/g, "-")
  const siteUrl = `https://${subdomain}.ltpd.xyz`

  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full h-64 sm:h-80 md:h-screen bg-black overflow-hidden">
        {/* Back button - positioned absolutely over preview */}
        <div className="absolute top-4 left-4 z-50">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="bg-black/30 hover:bg-black/50">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview iframe */}
        {!deploymentLoading && deployment && (
          <>
            <iframe
              src={`https://${deployment.domain}`}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              onLoad={(e) => {
                console.log("[v0] Preview iframe loaded successfully")
              }}
              onError={(e) => {
                console.error("[v0] Preview iframe failed to load:", e)
              }}
            />

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <code className="text-sm font-mono text-white/80">{deployment.domain}</code>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-white/60 uppercase tracking-wider">Live</span>
                </div>
              </div>
            </div>
          </>
        )}

        {deploymentLoading && (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-white" />
              <p className="text-white/60">Loading preview...</p>
            </div>
          </div>
        )}

        {!deployment && !deploymentLoading && (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-white/60" />
              <p className="text-white/60">Preview not available yet. Please deploy your website first.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center py-8 px-4 bg-background border-b">
        <Button asChild size="lg" className="px-8">
          <a href={`https://${deployment?.domain}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit Website
          </a>
        </Button>
      </div>

      <div className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("styles")}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === "styles"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>Styles</span>
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === "products"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Products</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Styles Tab */}
        {activeTab === "styles" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Choose Your Style</h2>
              <p className="text-muted-foreground mb-6">Select how you'd like to design your website</p>
            </div>

            <StyleOptionsComponent onSelectStyle={handleStyleSelect} isLoading={false} />

            {selectedStyle === "default" && (
              <Card>
                <CardHeader>
                  <CardTitle>Default Template</CardTitle>
                  <CardDescription>Start with our clean, minimal template</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    The default template includes a professional header, hero section, product grid, and footer. You can
                    customize colors and add products from the Products tab.
                  </p>
                  <Button
                    onClick={() => {
                      setSettings((prev: any) => ({ ...prev, template: "default" }))
                      handleSettingsUpdate()
                    }}
                  >
                    Apply Default Template
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedStyle === "ai" && (
              <Card className="h-[600px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    AI Website Builder
                  </CardTitle>
                  <CardDescription>Describe your vision, and AI will generate the code</CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-80px)]">
                  <AIWebsiteBuilder projectId={id} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="space-y-6">
            {productsLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading products...</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {productError && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p>{productError}</p>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Add New Product</CardTitle>
                    <CardDescription>Add products with price, description, and image</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Product Name*</Label>
                        <Input
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          placeholder="Enter product name"
                          disabled={isAddingProduct}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Price*</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({ ...newProduct, price: Number.parseFloat(e.target.value) })}
                          placeholder="0.00"
                          disabled={isAddingProduct}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                          placeholder="e.g., Clothing, Electronics"
                          disabled={isAddingProduct}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Image URL</Label>
                        <Input
                          value={newProduct.image}
                          onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                          placeholder="https://..."
                          disabled={isAddingProduct}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={newProduct.description}
                          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                          placeholder="Product description"
                          disabled={isAddingProduct}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newProduct.inStock}
                        onCheckedChange={(checked) => setNewProduct({ ...newProduct, inStock: checked })}
                        disabled={isAddingProduct}
                      />
                      <Label>In Stock</Label>
                    </div>

                    <Button onClick={handleAddProduct} disabled={isAddingProduct} className="w-full">
                      {isAddingProduct ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Product
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Your Products ({products.length})</CardTitle>
                    <CardDescription>Manage all your products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {products.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-muted-foreground">No products yet. Add your first product above.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {products.map((product) => (
                          <div
                            key={product._id}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-4 flex-1">
                              {product.image && (
                                <img
                                  src={product.image || "/placeholder.svg"}
                                  alt={product.name}
                                  className="w-16 h-16 object-cover rounded"
                                  onError={(e) => {
                                    ;(e.target as any).style.display = "none"
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{product.name}</h3>
                                <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
                                    {currencySymbols[settings?.currency || "USD"]}
                                    {product.price}
                                  </span>
                                  {product.category && (
                                    <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
                                      {product.category}
                                    </span>
                                  )}
                                  <span
                                    className={`text-xs px-2 py-1 rounded font-medium ${
                                      product.inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {product.inStock ? "In Stock" : "Out of Stock"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteProduct(product._id, product.name)}
                              className="w-full md:w-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
