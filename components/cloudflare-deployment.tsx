"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Loader2, ExternalLink, Rocket, Info, Settings } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CloudflareDeploymentProps {
  projectId: string
  projectName: string
}

interface DebugInfo {
  project: {
    id: string
    name: string
    hasPages: boolean
    pagesCount: number
    cloudflareProjectName: string | null
    cloudflareUrl: string | null
    cloudflareDeployedAt: string | null
    cloudflareDeploymentId: string | null
  }
  authentication: {
    isAuthenticated: boolean
    hasApiToken: boolean
    hasAccountId: boolean
    tokenCreatedAt: string | null
    tokenUpdatedAt: string | null
  }
  pages: Array<{ name: string; size: number }>
  recommendations: string[]
}

export function CloudflareDeployment({ projectId, projectName }: CloudflareDeploymentProps) {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)

  // Configuration form state
  const [apiToken, setApiToken] = useState("")
  const [accountId, setAccountId] = useState("")

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDeploymentLogs((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  const fetchDebugInfo = async () => {
    setLoadingDebug(true)
    try {
      const response = await fetch(`/api/cloudflare/status?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setDebugInfo(data)
        setIsAuthenticated(data.authentication.isAuthenticated)

        if (data.project.cloudflareUrl) {
          setDeploymentUrl(data.project.cloudflareUrl)
        }
      }
    } catch (err) {
      console.error("[Cloudflare] Failed to fetch debug info:", err)
    } finally {
      setLoadingDebug(false)
    }
  }

  // Fetch status on mount
  useEffect(() => {
    fetchDebugInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveCredentials = async () => {
    if (!apiToken || !accountId) {
      setError("Please provide both API token and Account ID")
      return
    }

    setIsConfiguring(true)
    setError(null)

    try {
      addLog("🔐 Validating Cloudflare credentials...")
      
      const response = await fetch("/api/cloudflare/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiToken,
          accountId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to validate credentials")
      }

      addLog("✅ Credentials validated and saved!")
      setIsAuthenticated(true)
      setShowConfig(false)
      setApiToken("")
      setAccountId("")
      await fetchDebugInfo()
    } catch (err: any) {
      console.error("[Cloudflare] Config error:", err)
      setError(err.message || "Failed to save credentials")
      addLog(`❌ Error: ${err.message}`)
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleDeploy = async () => {
    if (!isAuthenticated) {
      setError("Please configure your Cloudflare credentials first")
      return
    }

    setIsDeploying(true)
    setError(null)
    setDeploymentStatus("deploying")
    setDeploymentLogs([])

    try {
      addLog("🚀 Starting deployment to Cloudflare Pages...")

      const response = await fetch("/api/cloudflare/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Deployment failed")
      }

      const result = await response.json()

      addLog("✅ Deployment successful!")
      addLog(`🌐 Your site is live at: ${result.url}`)
      
      setDeploymentStatus("success")
      setDeploymentUrl(result.url)
      await fetchDebugInfo()
    } catch (err: any) {
      console.error("[Cloudflare] Deploy error:", err)
      setError(err.message || "Deployment failed")
      setDeploymentStatus("error")
      addLog(`❌ Deployment failed: ${err.message}`)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleRemoveCredentials = async () => {
    if (!confirm("Are you sure you want to remove your Cloudflare credentials?")) {
      return
    }

    try {
      await fetch(`/api/cloudflare/auth?projectId=${projectId}`, {
        method: "DELETE",
      })

      setIsAuthenticated(false)
      addLog("🗑️ Credentials removed")
      await fetchDebugInfo()
    } catch (err) {
      console.error("[Cloudflare] Failed to remove credentials:", err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deploy to Cloudflare Pages
        </CardTitle>
        <CardDescription>
          Deploy your website to Cloudflare Pages with global CDN and automatic HTTPS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Section */}
        {!isAuthenticated && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You need to configure your Cloudflare API credentials before deploying.
              <Button
                variant="link"
                className="ml-2 p-0 h-auto"
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? "Hide" : "Show"} configuration
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showConfig && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="space-y-2">
              <Label htmlFor="apiToken">Cloudflare API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Enter your Cloudflare API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Create a token with "Cloudflare Pages: Edit" permission at{" "}
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Cloudflare Dashboard
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input
                id="accountId"
                placeholder="Enter your Cloudflare Account ID"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Find your Account ID in the Cloudflare dashboard URL or Pages section
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveCredentials}
                disabled={isConfiguring || !apiToken || !accountId}
              >
                {isConfiguring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Save Credentials
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Status Display */}
        {isAuthenticated && debugInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Cloudflare credentials configured</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCredentials}
                className="ml-auto h-auto p-0 text-xs"
              >
                Remove
              </Button>
            </div>
            {debugInfo.project.cloudflareUrl && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4" />
                <span>Last deployed: </span>
                <a
                  href={debugInfo.project.cloudflareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {debugInfo.project.cloudflareUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Deploy Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleDeploy}
            disabled={isDeploying || !isAuthenticated}
            className="w-full"
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Deploy to Cloudflare
              </>
            )}
          </Button>

          {!isAuthenticated && (
            <Button
              variant="outline"
              onClick={() => setShowConfig(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Button>
          )}
        </div>

        {/* Deployment Status */}
        {deploymentStatus && (
          <div className="space-y-2">
            {deploymentStatus === "success" && deploymentUrl && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Deployment successful! Your site is live at{" "}
                  <a
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {deploymentUrl}
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Deployment Logs */}
        {deploymentLogs.length > 0 && (
          <div className="space-y-2">
            <Label>Deployment Logs</Label>
            <div className="rounded-lg bg-muted p-4 max-h-60 overflow-y-auto font-mono text-sm">
              {deploymentLogs.map((log, i) => (
                <div key={i} className="text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info */}
        {debugInfo && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Debug Information
            </summary>
            <pre className="mt-2 rounded-lg bg-muted p-4 overflow-x-auto text-xs">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
