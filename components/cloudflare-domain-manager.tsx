"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Globe, Plus, AlertCircle, CheckCircle, ExternalLink } from "lucide-react"

interface CloudflareDomainManagerProps {
  projectId: string
}

export function CloudflareDomainManager({ projectId }: CloudflareDomainManagerProps) {
  const [domains, setDomains] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchDomains = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cloudflare/domain?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setDomains(data.domains || [])
      } else {
         // If 400/404, might just mean no config yet
         if (response.status !== 404) {
             // console.error("Failed to fetch domains")
         }
      }
    } catch (err) {
      console.error("Error fetching domains:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
        fetchDomains()
    }
  }, [projectId])

  const handleAddDomain = async () => {
    if (!newDomain) return
    setIsAdding(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/cloudflare/domain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          hostname: newDomain,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add domain")
      }

      setSuccess(`Successfully added ${newDomain}`)
      setNewDomain("")
      setDomains(data.domains || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Custom Domains
        </CardTitle>
        <CardDescription>
          Connect your own domain (e.g., example.com) to your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Domain List */}
        {isLoading ? (
             <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
        ) : domains.length > 0 ? (
            <div className="space-y-2">
                {domains.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{d.hostname}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                                Active
                            </span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                            <a href={`https://${d.hostname}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                No custom domains connected yet.
            </div>
        )}

        {/* Add Domain Form */}
        <div className="space-y-2 pt-2">
            <Label>Add New Domain</Label>
            <div className="flex gap-2">
                <Input
                    placeholder="e.g. shop.example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    disabled={isAdding}
                />
                <Button onClick={handleAddDomain} disabled={isAdding || !newDomain}>
                    {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4" />
                    )}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Ensure you have configured the DNS CNAME record pointing to your worker URL in your DNS provider.
            </p>
        </div>

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {success && (
            <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  )
}
