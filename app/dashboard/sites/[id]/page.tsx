"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, ExternalLink, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { themes, currencySymbols } from "@/lib/webshop-types"
import { DeploymentsStatus } from "./deployments-status"

export default function SiteSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deployment, setDeployment] = useState<any>(null)
  const [deploymentLoading, setDeploymentLoading] = useState(true)

  const [redeploySubdomain, setRedeploySubdomain] = useState("")
  const [isRedeploying, setIsRedeploying] = useState(false)

  // New product form
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    category: "",
    inStock: true,
  })

  useEffect(() => {
    if (id) {
      Promise.all([
        fetch(`/api/projects/${id}`).then((r) => r.json()),
        fetch(`/api/projects/${id}/settings`).then((r) => r.json()),
        fetch(`/api/projects/${id}/products`).then((r) => r.json()),
        fetch(`/api/projects/${id}/deployments`)
          .then((r) => r.json())
          .catch(() => ({ deployment: null })),
      ]).then(([projectData, settingsData, productsData, deploymentData]) => {
        setProject(projectData)
        setSettings(settingsData)
        setProducts(productsData)
        setDeployment(deploymentData.deployment)
        setDeploymentLoading(false)
      })
    }
  }, [id])

  const handleSettingsUpdate = async () => {
    setSaving(true)
    await fetch(`/api/projects/${id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    setSaving(false)
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) return

    const response = await fetch(`/api/projects/${id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProduct),
    })

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
  }

  const handleDeleteProduct = async (productId: string) => {
    await fetch(`/api/projects/${id}/products?productId=${productId}`, {
      method: "DELETE",
    })
    setProducts(products.filter((p) => p._id !== productId))
  }

  const handleRedeploy = async () => {
    if (!redeploySubdomain) return

    setIsRedeploying(true)
    console.log("[v0] Attempting redeploy to subdomain:", redeploySubdomain)

    try {
      const response = await fetch(`/api/projects/${id}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: redeploySubdomain,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] Redeploy successful:", result)
        setDeployment(result.deployment)
        setRedeploySubdomain("")
      } else {
        const error = await response.json()
        console.error("[v0] Redeploy failed:", error)
        alert(`Redeploy failed: ${error.message}`)
      }
    } catch (error) {
      console.error("[v0] Redeploy error:", error)
      alert("An error occurred during redeploy")
    } finally {
      setIsRedeploying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return <div className="container mx-auto px-4 py-8">Project not found.</div>
  }

  const subdomain = project.businessName?.toLowerCase().replace(/\s+/g, "-")
  const siteUrl = `https://${subdomain}.ltpd.xyz`

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.businessName}</h1>
          <p className="text-muted-foreground mt-1">Manage your webshop settings and products</p>
        </div>
        <Button asChild variant="outline" className="w-full md:w-auto bg-transparent">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Site
          </a>
        </Button>
      </div>

      {!deploymentLoading && (
        <div className="mb-6">
          <DeploymentsStatus projectId={id} projectName={project.businessName} />
        </div>
      )}

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme & Colors</CardTitle>
              <CardDescription>Customize the look and feel of your webshop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={settings?.theme || "modern"}
                  onValueChange={(value) => setSettings({ ...settings, theme: value })}
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
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                  {settings?.theme === "premium" && "Elegant luxury theme with gold accents"}
                  {settings?.theme === "minimalist" && "Clean, minimal design with focus on products"}
                  {settings?.theme === "vibrant" && "Energetic colors for modern brands"}
                  {settings?.theme === "glassmorphic" && "Contemporary glassmorphism with blur effects"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings?.secondaryColor || "#8b5cf6"}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={settings?.secondaryColor || "#8b5cf6"}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Prices</Label>
                  <p className="text-sm text-muted-foreground">Display product prices on your site</p>
                </div>
                <Switch
                  checked={settings?.showPrices ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, showPrices: checked })}
                />
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

              <div className="space-y-2">
                <Label>Products Per Page</Label>
                <Input
                  type="number"
                  min="4"
                  max="24"
                  value={settings?.productsPerPage || 12}
                  onChange={(e) => setSettings({ ...settings, productsPerPage: Number.parseInt(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSettingsUpdate} disabled={saving} className="w-full md:w-auto">
            {saving ? "Saving..." : "Save Appearance Settings"}
          </Button>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Product</CardTitle>
              <CardDescription>Add products to your webshop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name*</Label>
                  <Input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Enter product name"
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
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    placeholder="e.g., Clothing, Electronics"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={newProduct.image}
                    onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Input
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Product description"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={newProduct.inStock}
                  onCheckedChange={(checked) => setNewProduct({ ...newProduct, inStock: checked })}
                />
                <Label>In Stock</Label>
              </div>

              <Button onClick={handleAddProduct} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Products ({products.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No products yet. Add your first product above.</p>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <div
                      key={product._id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {product.image && (
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-sm font-medium">
                              {currencySymbols[settings?.currency || "USD"]}
                              {product.price}
                            </span>
                            {product.category && (
                              <span className="text-sm text-muted-foreground">• {product.category}</span>
                            )}
                            <span className={`text-sm ${product.inStock ? "text-green-600" : "text-red-600"}`}>
                              • {product.inStock ? "In Stock" : "Out of Stock"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={settings?.contactEmail || ""}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input
                  value={settings?.footerText || ""}
                  onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                  placeholder="© 2025 All rights reserved."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  value={settings?.socialLinks?.facebook || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      socialLinks: { ...settings?.socialLinks, facebook: e.target.value },
                    })
                  }
                  placeholder="https://facebook.com/yourpage"
                />
              </div>

              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={settings?.socialLinks?.instagram || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      socialLinks: { ...settings?.socialLinks, instagram: e.target.value },
                    })
                  }
                  placeholder="https://instagram.com/yourpage"
                />
              </div>

              <div className="space-y-2">
                <Label>Twitter</Label>
                <Input
                  value={settings?.socialLinks?.twitter || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      socialLinks: { ...settings?.socialLinks, twitter: e.target.value },
                    })
                  }
                  placeholder="https://twitter.com/yourpage"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSettingsUpdate} disabled={saving} className="w-full md:w-auto">
            {saving ? "Saving..." : "Save General Settings"}
          </Button>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Management</CardTitle>
              <CardDescription>Manage your subdomain deployment and DNS configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deployment ? (
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Current Deployment</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Deployed to:{" "}
                        <code className="bg-white px-2 py-1 rounded text-xs font-mono">{deployment.domain}</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: <span className="font-mono text-green-700 font-semibold">{deployment.status}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm">No Active Deployment</h4>
                      <p className="text-sm text-muted-foreground">This project has not been deployed yet.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label className="mb-2 block">Deploy to Subdomain</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., myshop, business-name"
                      value={redeploySubdomain}
                      onChange={(e) => setRedeploySubdomain(e.target.value)}
                      disabled={isRedeploying}
                    />
                    <Button onClick={handleRedeploy} disabled={isRedeploying || !redeploySubdomain}>
                      {isRedeploying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        "Deploy"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter a subdomain name. It will be available at: subdomain.ltpd.xyz
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DNS Configuration Required</CardTitle>
              <CardDescription>Your DNS provider must be configured for this to work</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Wildcard DNS Record Needed</h4>
                <code className="bg-white px-2 py-1 rounded text-xs font-mono block mb-2">
                  Type: CNAME | Name: *.ltpd.xyz | Value: cname.vercel-dns.com
                </code>
                <p className="text-xs text-muted-foreground">
                  Contact your DNS provider and add this record. Changes may take 5-15 minutes to propagate.
                </p>
              </div>

              <div className="text-sm space-y-2">
                <p className="font-semibold">Common DNS Providers:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Vercel Domains - Add domain in project settings</li>
                  <li>Cloudflare - DNS management → Add CNAME record</li>
                  <li>Namecheap - Advanced DNS → Add record</li>
                  <li>GoDaddy - DNS Settings → Add CNAME</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-xs bg-muted p-3 rounded block overflow-auto max-h-40">
                <pre>{JSON.stringify({ deployment, projectId: id }, null, 2)}</pre>
              </code>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
