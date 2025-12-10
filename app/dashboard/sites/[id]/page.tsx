"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import AIWebsiteBuilder, { GeneratedPage } from "@/components/ai-website-builder"
import { CloudflareDeployment } from "@/components/cloudflare-deployment"
import { CloudflareDomainManager } from "@/components/cloudflare-domain-manager"
import {
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  Info,
  Loader2,
  ArrowLeft,
  Palette,
  ShoppingCart,
  Zap,
  Package,
  Sparkles,
  Lock,
  Unlock,
  Menu,
  X,
  Settings,
  Store,
  Layout,
  Upload,
  Check,
  Tag,
  BarChart3,
  Users,
  History,
  FileText,
  CreditCard,
  Rocket
} from "lucide-react"
import { currencySymbols } from "@/lib/webshop-types"

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
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([])
  const [deploymentError, setDeploymentError] = useState<string | null>(null)

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

  const [activeTab, setActiveTab] = useState<"home" | "styles" | "products" | "payments" | "ai" | "pages" | "orders" | "customers" | "analytics" | "discount" | "deploy">("home")
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "store" | "pages">("settings")

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<string>("landing")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Settings State
  const [shopName, setShopName] = useState("")
  const [profileImage, setProfileImage] = useState("")

  // AI Generated Pages State (Lifted)
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([])

  useEffect(() => {
    if (!id) return

    const fetchAllData = async () => {
      console.log(`[v0] Settings page: Starting data fetch for project ${id}`)
      try {
        const fetchProject = fetch(`/api/projects/${id}`)
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Project data fetched:", data ? "Success" : "Empty")
            if (data.message) throw new Error(data.message)
            setProject(data)
            setShopName(data.businessName || "")

            if (data.pages && Array.isArray(data.pages)) {
              setGeneratedPages(data.pages.map((p: any) => ({
                name: p.name,
                code: p.content,
                timestamp: Date.now()
              })))
            }
            setProjectLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching project:", err)
            setProjectLoading(false)
          })

        const fetchSettings = fetch(`/api/projects/${id}/settings`)
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Settings data fetched")
            setSettings(data)
            setSettingsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching settings:", err)
            setSettingsLoading(false)
          })

        const fetchProducts = fetch(`/api/projects/${id}/products`)
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Products data fetched")
            setProducts(Array.isArray(data) ? data : [])
            setProductsLoading(false)
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching products:", err)
            setProductsLoading(false)
          })

        const fetchDeployments = fetch(`/api/projects/${id}/deployments`)
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Deployments data fetched")
            setDeployment(data.deployment || null)
            setDeploymentLoading(false)
            if (data.logs) {
              setDeploymentLogs(data.logs)
            }
          })
          .catch((err) => {
            console.error("[v0] Settings page: Error fetching deployment:", err)
            setDeploymentLoading(false)
            setDeploymentError("Failed to fetch deployment status")
          })

        await Promise.all([fetchProject, fetchSettings, fetchProducts, fetchDeployments])
        console.log("[v0] All data fetches completed")
      } catch (error) {
        console.error("[v0] Error in fetchAllData:", error)
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

  const handleSettingsUpdate = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)

    try {
      console.log("[v0] Sending settings to API:", settings)

      const updatedSettings = {
        ...settings,
        shopName: shopName,
        profileImage: profileImage || settings.profileImage
      }

      const response = await fetch(`/api/projects/${id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to save settings")
      }

      setSaveSuccess(true)
      fetch(`/api/projects/${id}/settings`)
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

  const subdomain = (project.businessName || "").toLowerCase().replace(/\s+/g, "-")
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

  const navGroups = [
    {
      title: "Home",
      items: [
        { id: "home", label: "Dashboard", icon: Layout },
        { id: "styles", label: "Themes", icon: Palette },
        { id: "ai", label: "AI Builder", icon: Zap },
        { id: "pages", label: "Pages", icon: FileText },
        { id: "products", label: "Products", icon: ShoppingCart },
        { id: "payments", label: "Payments", icon: CreditCard },
      ]
    },
    {
      title: "Deployment",
      items: [
        { id: "deploy", label: "Firebase Deploy", icon: Rocket },
      ]
    },
    {
      title: "Orders",
      items: [
        { id: "orders", label: "History", icon: History },
      ]
    },
    {
      title: "Management",
      items: [
        { id: "customers", label: "Customers", icon: Users },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "discount", label: "Discount", icon: Tag },
      ]
    }
  ]

  const subTabs = [
    { id: "settings", label: "Settings", icon: Settings },
    { id: "store", label: "Store", icon: Store },
    { id: "pages", label: "Pages", icon: Layout },
  ]

  // Construct preview URL safely
  const previewUrl = deployment?.cloudflareUrl || (deployment?.domain ? `https://${deployment.domain}` : null)

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed top-4 left-4 z-30 md:hidden">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => router.push("/dashboard")}
          className="shadow-lg bg-background/60 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="fixed top-4 right-4 z-50 md:hidden">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="shadow-lg bg-background/60 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } backdrop-blur-xl bg-sidebar border-r border-sidebar-border flex flex-col`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-8 text-sidebar-foreground">
            <WebsiteIcon className="h-6 w-6" />
            <span className="font-bold text-lg truncate">{project?.businessName || "Site Settings"}</span>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto pr-2">
            {navGroups.map((group) => (
              <div key={group.title}>
                <h3 className="px-4 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any)
                          setIsSidebarOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent gap-3 px-4"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium text-sm">Back to Dashboard</span>
            </Button>
          </div>
        </div>
      </aside>

      <main className="transition-all duration-300 md:ml-56 min-h-screen flex flex-col">
        {/* Preview Area (Always Visible) */}
        <div className="relative w-full h-[30vh] md:h-[50vh] bg-black overflow-hidden flex-shrink-0">
          <div className="absolute top-4 left-4 z-30 hidden md:block">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="shadow-lg bg-background/60 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>

          {!deploymentLoading && previewUrl && (
            <>
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Live Preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
              />

              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent z-10 pointer-events-none" />

              <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-base font-bold text-white font-sans truncate">
                      {previewUrl}
                    </span>
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

          {!previewUrl && !deploymentLoading && (
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
             <div className="flex flex-col gap-4">
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
                      href={previewUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                          if (isFrozen || !previewUrl) e.preventDefault()
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-7xl flex-1">
          {activeTab === "home" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-6">
                        <CloudflareDeployment projectId={id} projectName={project?.businessName || "Site"} />
                        <CloudflareDomainManager projectId={id} />
                    </div>
                </div>
            </div>
          )}

          {activeTab === "styles" && (
            <div className="space-y-6">
              {/* Website Card / Header */}
              <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-sm group">
                {/* Banner */}
                <div className="h-32 bg-gradient-to-r from-blue-600/20 to-purple-600/20 w-full" />

                {/* Profile Circle */}
                <div className="absolute top-20 left-6">
                   <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-background bg-muted overflow-hidden">
                      {profileImage ? (
                         <img src={profileImage} alt="Shop Profile" className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center bg-muted">
                           <Store className="h-8 w-8 text-muted-foreground/50" />
                         </div>
                      )}
                    </div>
                    <label htmlFor="card-profile-upload" className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
                      <Upload className="h-4 w-4" />
                      <input type="file" id="card-profile-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                   </div>
                </div>

                {/* Info & Actions */}
                <div className="pt-14 pb-6 px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="mt-2">
                     <h2 className="text-2xl font-bold">{shopName || "My Awesome Shop"}</h2>
                     <p className="text-muted-foreground text-sm">{siteUrl}</p>
                  </div>
                  <Button onClick={handleSettingsUpdate} disabled={isSaving} className="gap-2">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* Sub-tabs Navigation */}
              <div className="flex border-b border-border/50">
                {subTabs.map(tab => {
                   const Icon = tab.icon
                   return (
                     <button
                       key={tab.id}
                       onClick={() => setActiveSubTab(tab.id as any)}
                       className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                         activeSubTab === tab.id
                           ? "border-primary text-primary"
                           : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                       }`}
                     >
                       <Icon className="h-4 w-4" />
                       {tab.label}
                     </button>
                   )
                })}
              </div>

              {/* Settings Sub-tab */}
              {activeSubTab === "settings" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <Card>
                    <CardHeader>
                      <CardTitle>General Information</CardTitle>
                      <CardDescription>Update your shop's basic details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Shop Name</Label>
                        <Input
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder="My Awesome Shop"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Store Sub-tab */}
              {activeSubTab === "store" && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div>
                     <h3 className="text-lg font-medium mb-4">Product Layout</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {Object.entries(productComponents).map(([key, comp]) => (
                         <div
                           key={key}
                           onClick={() => handleComponentSelect("productComponent", key)}
                           className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                             settings?.productComponent === key
                               ? "border-primary bg-primary/5 ring-1 ring-primary"
                               : "border-transparent bg-card hover:bg-accent hover:border-border shadow-sm"
                           }`}
                         >
                           <div className="mb-3 h-20 bg-muted/50 rounded flex items-center justify-center">
                             {/* Placeholder visual */}
                             <div className="w-12 h-12 bg-muted rounded grid grid-cols-2 gap-1 p-1">
                               <div className="bg-foreground/10 rounded" />
                               <div className="bg-foreground/10 rounded" />
                               <div className="bg-foreground/10 rounded" />
                               <div className="bg-foreground/10 rounded" />
                             </div>
                           </div>
                           <p className="font-medium text-sm">{comp.name}</p>
                           <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{comp.description}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
              )}

              {/* Pages Sub-tab */}
              {activeSubTab === "pages" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div>
                     <h3 className="text-lg font-medium mb-4">Header Style</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       {Object.entries(headerComponents).map(([key, comp]) => (
                         <div
                           key={key}
                           onClick={() => handleComponentSelect("headerComponent", key)}
                           className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                             settings?.headerComponent === key
                               ? "border-primary bg-primary/5 ring-1 ring-primary"
                               : "border-transparent bg-card hover:bg-accent hover:border-border shadow-sm"
                           }`}
                         >
                           <p className="font-medium text-sm mb-1">{comp.name}</p>
                           <p className="text-xs text-muted-foreground">{comp.description}</p>
                         </div>
                       ))}
                     </div>
                   </div>

                   <div>
                     <h3 className="text-lg font-medium mb-4">Hero Section</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                       {Object.entries(heroComponents).map(([key, comp]) => (
                         <div
                           key={key}
                           onClick={() => handleComponentSelect("heroComponent", key)}
                           className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                             settings?.heroComponent === key
                               ? "border-primary bg-primary/5 ring-1 ring-primary"
                               : "border-transparent bg-card hover:bg-accent hover:border-border shadow-sm"
                           }`}
                         >
                           <p className="font-medium text-sm mb-1">{comp.name}</p>
                           <p className="text-xs text-muted-foreground">{comp.description}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
              )}
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
            <div className="h-[calc(100vh-200px)] min-h-96 flex flex-col -mx-4 -mb-8">
              <div className="flex-1 bg-background overflow-hidden">
                {id ? (
                  <AIWebsiteBuilder
                    projectId={id}
                    generatedPages={generatedPages}
                    setGeneratedPages={setGeneratedPages}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <AlertCircle className="h-6 w-6 text-destructive mr-2" />
                    <span className="text-destructive">Project ID not available</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "deploy" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-2xl font-bold mb-2">Cloudflare Pages Deployment</h2>
                <p className="text-muted-foreground mb-6">Deploy your website to Cloudflare Pages with automatic SSL and global CDN</p>
              </div>
              <CloudflareDeployment projectId={id} projectName={project?.businessName || "Site"} />
            </div>
          )}

          {["orders", "customers", "analytics", "discount"].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center border-2 border-dashed border-border rounded-xl bg-muted/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                {activeTab === "orders" && <History className="h-8 w-8 text-muted-foreground" />}
                {activeTab === "customers" && <Users className="h-8 w-8 text-muted-foreground" />}
                {activeTab === "analytics" && <BarChart3 className="h-8 w-8 text-muted-foreground" />}
                {activeTab === "discount" && <Tag className="h-8 w-8 text-muted-foreground" />}
              </div>
              <h3 className="text-xl font-semibold capitalize mb-2">{activeTab}</h3>
              <p className="text-muted-foreground max-w-md">
                This feature is coming soon. You will be able to manage your {activeTab} here.
              </p>
            </div>
          )}

          {activeTab === "pages" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between">
                 <div>
                   <h2 className="text-2xl font-bold">Site Pages</h2>
                   <p className="text-muted-foreground">Manage your AI-generated pages and content.</p>
                 </div>
                 <Button onClick={() => setActiveTab("ai")}>
                   <Plus className="h-4 w-4 mr-2" /> Create New Page
                 </Button>
               </div>

               {generatedPages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[40vh] text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                   <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                     <FileText className="h-8 w-8 text-muted-foreground" />
                   </div>
                   <h3 className="text-xl font-semibold mb-2">No Pages Yet</h3>
                   <p className="text-muted-foreground max-w-md mb-6">
                     Use the AI Builder to generate your website structure and pages.
                   </p>
                   <Button onClick={() => setActiveTab("ai")}>Go to AI Builder</Button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {generatedPages.map((page, i) => (
                     <Card key={i} className="overflow-hidden hover:border-primary/50 transition-all group">
                       <CardHeader className="pb-3">
                         <CardTitle className="flex items-center justify-between">
                           <span className="flex items-center gap-2 truncate">
                             <FileText className="h-4 w-4 text-primary"/>
                             {page.name}
                           </span>
                         </CardTitle>
                         <CardDescription className="text-xs">
                           Generated {new Date(page.timestamp).toLocaleTimeString()}
                         </CardDescription>
                       </CardHeader>
                       <CardContent className="pb-3">
                         <div className="bg-muted rounded-md p-3 font-mono text-[10px] text-muted-foreground h-32 overflow-hidden relative border border-border/50">
                           {page.code}
                           <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent"/>
                         </div>
                       </CardContent>
                       <CardFooter className="pt-0 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button size="sm" variant="outline" className="h-7 text-xs">View Code</Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
