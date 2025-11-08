"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Palette,
  ShoppingCart,
  Copy,
  Check,
} from "lucide-react"
import { themes, currencySymbols } from "@/lib/webshop-types"
import { WebsitePreviewCard } from "@/components/website-preview-card"

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

  const [copiedUrl, setCopiedUrl] = useState(false)

  // New product form
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

  const [redeploySubdomain, setRedeploySubdomain] = useState("")
  const [isRedeploying, setIsRedeploying] = useState(false)
  const [redeployError, setRedeployError] = useState<string | null>(null)

  // New state for tab navigation and style selection
  const [activeTab, setActiveTab] = useState<"styles" | "products">("styles")
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)

  const previewStyles = [
    {
      id: "minimal",
      name: "Minimal",
      description: "Clean and simple design",
      theme: "minimalist",
      colors: { bg: "#ffffff", primary: "#000000", secondary: "#f3f4f6" },
    },
    {
      id: "vibrant",
      name: "Vibrant",
      description: "Bold and colorful",
      theme: "vibrant",
      colors: { bg: "#fafafa", primary: "#ec4899", secondary: "#3b82f6" },
    },
    {
      id: "premium",
      name: "Premium",
      description: "Elegant luxury theme",
      theme: "premium",
      colors: { bg: "#1f2937", primary: "#d4af37", secondary: "#ffffff" },
    },
    {
      id: "glassmorphic",
      name: "Glassmorphic",
      description: "Modern glass effect",
      theme: "glassmorphic",
      colors: { bg: "#f8fafc", primary: "#6366f1", secondary: "#8b5cf6" },
    },
  ]

  useEffect(() => {
    if (!id) return

    const fetchAllData = async () => {
      try {
        // Fetch project
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

        // Fetch settings
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

        // Fetch products
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

        // Fetch deployment
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

  const handleStyleSelect = async (styleId: string) => {
    setSelectedStyle(styleId)
    const selectedTheme = previewStyles.find((s) => s.id === styleId)
    if (selectedTheme) {
      setSettings((prev: any) => ({
        ...prev,
        theme: selectedTheme.theme,
        primaryColor: selectedTheme.colors.primary,
        secondaryColor: selectedTheme.colors.primary,
        backgroundColor: selectedTheme.colors.bg,
      }))
    }
  }

  const handleSettingsUpdate = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)

    try {
      console.log("[v0] Sending settings to API:", settings)
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

  const handleRedeploy = async () => {
    setRedeployError(null)

    if (!redeploySubdomain || !redeploySubdomain.trim()) {
      setRedeployError("Subdomain is required")
      return
    }

    setIsRedeploying(true)

    try {
      const response = await fetch(`/api/projects/${id}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: redeploySubdomain,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Deployment failed")
      }

      const result = await response.json()
      setDeployment(result.deployment)
      setRedeploySubdomain("")
    } catch (error: any) {
      setRedeployError(error.message || "An error occurred during deployment")
      console.error("[v0] Redeploy error:", error)
    } finally {
      setIsRedeploying(false)
    }
  }

  const copyDeploymentUrl = async () => {
    if (deployment?.domain) {
      const url = `https://${deployment.domain}`
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
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
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold">{project.businessName}</h1>
              </div>
              <p className="text-sm text-muted-foreground">Customize your webshop appearance and manage products</p>
            </div>
            {/* Removed the redundant ExternalLink Button here as it's duplicated below */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Real-time Preview Section */}
        {!deploymentLoading && deployment && (
          <div className="mb-8 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Preview</CardTitle>
                <CardDescription>Real-time preview of your webshop</CardDescription>
              </CardHeader>
              <CardContent>
                <WebsitePreviewCard domain={deployment.domain} isLive={true} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button asChild variant="default" className="w-full">
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visit Live Site
                </a>
              </Button>

              <Button variant="outline" className="w-full bg-transparent" onClick={copyDeploymentUrl}>
                {copiedUrl ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </>
                )}
              </Button>
            </div>

            {/* Deployment Status Card */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Deployment Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <p className="font-semibold text-sm">{deployment.status}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Domain</p>
                    <code className="text-sm font-mono">{deployment.domain}</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                    <p className="text-sm">{new Date(deployment.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 border-b bg-card rounded-t-lg">
          <div className="flex gap-0">
            <button
              onClick={() => {
                setActiveTab("styles")
                setSelectedStyle(null)
              }}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === "styles"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>Style</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("products")
                setSelectedStyle(null)
              }}
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

        {/* Styles Tab */}
        {activeTab === "styles" && (
          <div className="space-y-8">
            {!selectedStyle ? (
              <>
                {/* Style Selection Grid */}
                <div>
                  <h2 className="text-xl font-bold mb-2">Choose Your Style</h2>
                  <p className="text-muted-foreground mb-6">Select from 4 professionally designed templates</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewStyles.map((style) => (
                      <Card
                        key={style.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        onClick={() => handleStyleSelect(style.id)}
                      >
                        <div
                          className="h-40 flex flex-col items-center justify-center gap-3"
                          style={{ backgroundColor: style.colors.bg }}
                        >
                          <div
                            className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: style.colors.primary }}
                          >
                            {style.colors.primary === "#000000" ? "A" : "S"}
                          </div>
                          <div className="text-center">
                            <h3 className="font-bold" style={{ color: style.colors.primary }}>
                              {style.name}
                            </h3>
                            <p className="text-xs" style={{ color: style.colors.secondary }}>
                              {style.description}
                            </p>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <Button
                            className="w-full bg-transparent"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStyleSelect(style.id)
                            }}
                          >
                            Customize
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Theme Settings */}
                {settingsLoading ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading settings...</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Theme Settings</CardTitle>
                      <CardDescription>Adjust colors and layout</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Theme</Label>
                          <Select
                            value={settings?.theme || "modern"}
                            onValueChange={(value) => {
                              const newSettings = { ...settings, theme: value }
                              setSettings(newSettings)
                              console.log("[v0] Theme changed to:", value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(themes).map(([key, theme]) => (
                                <SelectItem key={key} value={key}>
                                  {theme.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Header Style</Label>
                          <Select
                            value={settings?.headerStyle || "simple"}
                            onValueChange={(value) => {
                              const newSettings = { ...settings, headerStyle: value }
                              setSettings(newSettings)
                              console.log("[v0] Header style changed to:", value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple">Simple</SelectItem>
                              <SelectItem value="centered">Centered</SelectItem>
                              <SelectItem value="split">Split</SelectItem>
                              <SelectItem value="luxe">Luxe</SelectItem>
                              <SelectItem value="hero">Hero</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Primary Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={settings?.primaryColor || "#3b82f6"}
                              onChange={(e) => {
                                const newSettings = { ...settings, primaryColor: e.target.value }
                                setSettings(newSettings)
                              }}
                              className="w-20 h-10"
                            />
                            <Input
                              type="text"
                              value={settings?.primaryColor || "#3b82f6"}
                              onChange={(e) => {
                                const newSettings = { ...settings, primaryColor: e.target.value }
                                setSettings(newSettings)
                              }}
                              className="flex-1"
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Secondary Color</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={settings?.secondaryColor || "#8b5cf6"}
                              onChange={(e) => {
                                const newSettings = { ...settings, secondaryColor: e.target.value }
                                setSettings(newSettings)
                              }}
                              className="w-20 h-10"
                            />
                            <Input
                              type="text"
                              value={settings?.secondaryColor || "#8b5cf6"}
                              onChange={(e) => {
                                const newSettings = { ...settings, secondaryColor: e.target.value }
                                setSettings(newSettings)
                              }}
                              className="flex-1"
                              placeholder="#8b5cf6"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Product Layout</Label>
                          <Select
                            value={settings?.layout || "grid"}
                            onValueChange={(value) => setSettings({ ...settings, layout: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="grid">Grid</SelectItem>
                              <SelectItem value="list">List</SelectItem>
                              <SelectItem value="masonry">Masonry</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Currency</Label>
                          <Select
                            value={settings?.currency || "USD"}
                            onValueChange={(value) => setSettings({ ...settings, currency: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(currencySymbols).map(([code, symbol]) => (
                                <SelectItem key={code} value={code}>
                                  {code} ({symbol})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Show Prices</Label>
                          <p className="text-sm text-muted-foreground">Display prices on your site</p>
                        </div>
                        <Switch
                          checked={settings?.showPrices ?? true}
                          onCheckedChange={(checked) => setSettings({ ...settings, showPrices: checked })}
                        />
                      </div>

                      <Button onClick={handleSettingsUpdate} disabled={isSaving || settingsLoading} className="w-full">
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Style Settings"
                        )}
                      </Button>

                      {saveError && (
                        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                          <AlertCircle className="h-5 w-5 flex-shrink-0" />
                          <p className="text-sm">{saveError}</p>
                        </div>
                      )}

                      {saveSuccess && (
                        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                          <CheckCircle className="h-5 w-5 flex-shrink-0" />
                          <p className="text-sm">Style settings saved successfully!</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <Button variant="outline" onClick={() => setSelectedStyle(null)} className="mb-4">
                  ← Back to Styles
                </Button>

                <Card>
                  <CardHeader>
                    <CardTitle>Customize {previewStyles.find((s) => s.id === selectedStyle)?.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Background Color */}
                      <div className="space-y-2">
                        <Label>Background Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={settings?.backgroundColor || "#ffffff"}
                            onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                            className="w-20 h-10"
                          />
                          <Input
                            type="text"
                            value={settings?.backgroundColor || "#ffffff"}
                            onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* Header Style */}
                      <div className="space-y-2">
                        <Label>Header Style</Label>
                        <Select
                          value={settings?.headerStyle || "simple"}
                          onValueChange={(value) => setSettings({ ...settings, headerStyle: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple</SelectItem>
                            <SelectItem value="centered">Centered</SelectItem>
                            <SelectItem value="split">Split</SelectItem>
                            <SelectItem value="luxe">Luxe</SelectItem>
                            <SelectItem value="hero">Hero</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Primary Color */}
                      <div className="space-y-2">
                        <Label>Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={settings?.primaryColor || "#3b82f6"}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="w-20 h-10"
                          />
                          <Input
                            type="text"
                            value={settings?.primaryColor || "#3b82f6"}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* Logo URL */}
                      <div className="space-y-2">
                        <Label>Logo URL</Label>
                        <Input
                          type="url"
                          value={settings?.logoUrl || ""}
                          onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>
                    </div>

                    <Button onClick={handleSettingsUpdate} disabled={isSaving} className="w-full">
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Customization"
                      )}
                    </Button>

                    {saveError && (
                      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">{saveError}</p>
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                        <CheckCircle className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">Customization saved successfully!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
