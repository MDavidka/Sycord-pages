"use client"

import type React from "react"

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
  Zap,
  Package,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react"
import { currencySymbols } from "@/lib/webshop-types"

const StyleOptionsComponent = ({
  onSelectStyle,
  isLoading,
}: {
  onSelectStyle: (style: string) => void
  isLoading: boolean
}) => {
  const [profileImage, setProfileImage] = useState<string>("")
  const [shopName, setShopName] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shop Profile Image Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shop Profile Image</CardTitle>
            <CardDescription>Upload a logo or profile picture for your shop</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="profile-upload" />
              <label htmlFor="profile-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                  {profileImage ? (
                    <img
                      src={profileImage || "/placeholder.svg"}
                      alt="Profile"
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-primary">Click to upload</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                </div>
              </label>
            </div>
            <Button className="w-full" disabled={!profileImage || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Profile Image"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Edit Shop Name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shop Name</CardTitle>
            <CardDescription>Edit your shop's display name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Enter your shop name"
                className="text-base"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This name will be displayed on your website and public profile
            </p>
            <Button className="w-full" disabled={!shopName || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update Shop Name"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
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

const paymentOptions = [
  { id: "stripe", name: "Stripe", description: "Credit cards and digital wallets" },
  { id: "paypal", name: "PayPal", description: "PayPal payments" },
  { id: "bank", name: "Bank Transfer", description: "Direct bank transfers" },
]

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
  const [isFrozen, setIsFrozen] = useState(false)

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

  const [activeTab, setActiveTab] = useState<"styles" | "products" | "payments" | "ai">("styles")
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<string>("landing")

  useEffect(() => {
    if (!id) return

    console.log("[v0] Settings page: Loading project with ID:", id)
    console.log("[v0] Settings page: ID type:", typeof id)
    console.log("[v0] Settings page: ID is valid ObjectId format:", /^[0-9a-f]{24}$/i.test(id))

    const fetchAllData = async () => {
      try {
        fetch(`/api/projects/${id}`)
          .then((r) => {
            console.log("[v0] Settings page: Project fetch response status:", r.status)
            return r.json()
          })
          .then((data) => {
            console.log("[v0] Settings page: Project fetch response:", data)
            if (data.message) throw new Error(data.message)
            console.log("[v0] Settings page: Project loaded successfully. ID:", data._id, "Type:", typeof data._id)
            setProject(data)
            setProjectLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching project:", err)
            setProjectLoading(false)
          })

        fetch(`/api/projects/${id}/settings`)
          .then((r) => r.json())
          .then((data) => {
            setSettings(data)
            setSettingsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching settings:", err)
            setSettingsLoading(false)
          })

        fetch(`/api/projects/${id}/products`)
          .then((r) => r.json())
          .then((data) => {
            setProducts(Array.isArray(data) ? data : [])
            setProductsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching products:", err)
            setProductsLoading(false)
          })

        fetch(`/api/projects/${id}/deployments`)
          .then((r) => r.json())
          .then((data) => {
            setDeployment(data.deployment || null)
            setDeploymentLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching deployment:", err)
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
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-foreground" />
          <p className="text-foreground">Loading site settings...</p>
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

  const getWebsiteIcon = () => {
    const style = project.style || "default"
    switch (style) {
      case "default":
        return Package
      case "browse":
        return Sparkles
      case "ai":
        return Zap
      default:
        return Package
    }
  }

  const WebsiteIcon = getWebsiteIcon()

  const pages = [
    { id: "landing", name: "Landing" },
    { id: "shop", name: "Shop" },
    { id: "about", name: "About" },
    { id: "contact", name: "Contact" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full h-[30vh] md:h-[90vh] bg-black overflow-hidden">
        <div className="absolute top-4 left-4 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="bg-black/40 hover:bg-black/70 text-white opacity-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {!deploymentLoading && deployment && (
          <>
            <iframe
              src={`https://${deployment.domain}`}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
            />

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {deployment.domain && (
                    <span className="text-xs md:text-base font-bold text-white font-sans truncate">
                      {deployment.domain}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="text-xs text-white/60 uppercase tracking-wider">Live</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFrozen(!isFrozen)}
                className="bg-white/20 hover:bg-white/30 text-white flex-shrink-0"
              >
                {isFrozen ? (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    <span className="text-xs">Frozen</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3 mr-1" />
                    <span className="text-xs">Active</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {deploymentLoading && (
          <div className="flex items-center justify-center w-full h-full bg-card">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-foreground" />
              <p className="text-xs md:text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        )}

        {!deployment && !deploymentLoading && (
          <div className="flex items-center justify-center w-full h-full bg-card">
            <div className="text-center px-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs md:text-sm text-muted-foreground">
                Preview not available. Deploy your website first.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="py-4 px-4 bg-background border-b">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-2">
            {isFrozen && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-500">
                <Lock className="h-3 w-3" />
                <span className="font-medium">Frozen</span>
              </div>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="px-2 py-1 border border-input rounded bg-background text-xs md:text-sm text-foreground"
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
              <Button asChild size="sm" variant="outline" className="h-8 px-2 bg-transparent">
                <a
                  href={`https://${deployment?.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => isFrozen && e.preventDefault()}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-background sticky top-0 z-40 overflow-x-auto">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex gap-2 min-w-min md:min-w-0 py-3">
            <button
              onClick={() => setActiveTab("styles")}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 font-medium whitespace-nowrap text-sm md:text-base transition-all duration-200 rounded-lg ${
                activeTab === "styles"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:shadow-sm"
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>Styles</span>
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 font-medium whitespace-nowrap text-sm md:text-base transition-all duration-200 rounded-lg ${
                activeTab === "products"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:shadow-sm"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Products</span>
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 font-medium whitespace-nowrap text-sm md:text-base transition-all duration-200 rounded-lg ${
                activeTab === "payments"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:shadow-sm"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
              <span className="sm:hidden">Pay</span>
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 font-medium whitespace-nowrap text-sm md:text-base transition-all duration-200 rounded-lg ${
                activeTab === "ai"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:shadow-sm"
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">AI Builder</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {activeTab === "styles" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Customize Your Shop</h2>
              <p className="text-muted-foreground mb-6">Upload a profile image and edit your shop name</p>
            </div>

            <StyleOptionsComponent onSelectStyle={handleStyleSelect} isLoading={false} />

            {/* Additional content can be added here */}
          </div>
        )}

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

        {activeTab === "payments" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Payment Methods</h2>
              <p className="text-muted-foreground mb-6">Choose how your customers can pay</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {paymentOptions.map((option) => (
                <Card key={option.id} className="cursor-pointer hover:border-primary hover:shadow-md transition-all">
                  <CardHeader>
                    <CardTitle className="text-lg">{option.name}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">Enable</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="h-[calc(100vh-400px)] min-h-96 flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">AI Website Builder</h2>
              <p className="text-muted-foreground">Describe your website and let AI design it for you</p>
            </div>
            <div className="flex-1 border rounded-lg bg-card overflow-hidden">
              {id ? (
                <AIWebsiteBuilder projectId={id} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <AlertCircle className="h-6 w-6 text-destructive mr-2" />
                  <span className="text-destructive">Project ID not available</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
