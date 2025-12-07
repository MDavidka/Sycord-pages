"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2, ExternalLink, Rocket, Info, Bug } from "lucide-react"

interface FirebaseDeploymentProps {
  projectId: string
  projectName: string
}

interface DebugInfo {
  project: {
    id: string
    name: string
    hasPages: boolean
    pagesCount: number
    firebaseProjectId: string | null
    firebaseUrl: string | null
    firebaseDeployedAt: string | null
  }
  authentication: {
    isAuthenticated: boolean
    hasAccessToken: boolean
    hasRefreshToken: boolean
    tokenCreatedAt: string | null
    tokenUpdatedAt: string | null
    tokenExpiresIn: number | null
    scopes: string | null
  }
  pages: Array<{ name: string; size: number }>
  recommendations: string[]
}

export function FirebaseDeployment({ projectId, projectName }: FirebaseDeploymentProps) {
  const searchParams = useSearchParams()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDeploymentLogs((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  const fetchDebugInfo = async () => {
    setLoadingDebug(true)
    try {
      const response = await fetch(`/api/firebase/status?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setDebugInfo(data)
        setIsAuthenticated(data.authentication.isAuthenticated)

        if (data.project.firebaseUrl) {
          setDeploymentUrl(data.project.firebaseUrl)
        }
      }
    } catch (err) {
      console.error("[Firebase] Failed to fetch debug info:", err)
    } finally {
      setLoadingDebug(false)
    }
  }

  // Check for OAuth success on mount
  useEffect(() => {
    const firebaseAuth = searchParams.get("firebase_auth")
    if (firebaseAuth === "success") {
      setIsAuthenticated(true)
      addLog("✅ Authentication successful! You can now deploy.")
      fetchDebugInfo()

      // Clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete("firebase_auth")
      window.history.replaceState({}, "", url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleAuthenticate = async () => {
    setIsAuthenticating(true)
    setError(null)

    try {
      addLog("🔐 Redirecting to Google OAuth...")
      // Redirect to OAuth initiation endpoint
      window.location.href = `/api/firebase/auth/initiate?projectId=${projectId}`
    } catch (err: any) {
      console.error("[Firebase] Auth error:", err)
      setError(err.message || "Authentication failed")
      setIsAuthenticating(false)
    }
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    setError(null)
    setDeploymentStatus("Starting deployment...")

    try {
      addLog("🚀 Starting Firebase deployment")
      addLog("🔍 Checking authentication...")

      const response = await fetch("/api/firebase/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle project/hosting not found errors with instructions
        if (response.status === 404 && errorData.instructions) {
          addLog("⚠️ " + errorData.message)
          addLog("📋 Instructions:")
          errorData.instructions.forEach((instruction: string) => {
            addLog("   " + instruction)
          })
          throw new Error(errorData.message + "\n\nPlease check the deployment logs for setup instructions.")
        }
        
        throw new Error(errorData.message || "Deployment failed")
      }

      const data = await response.json()

      addLog("📦 Files prepared successfully")
      addLog("☁️ Creating hosting version...")
      addLog("📤 Uploading files to Firebase Hosting...")
      addLog("✅ Files uploaded successfully")
      addLog("🔨 Finalizing version...")
      addLog("🚀 Creating release...")
      addLog("🎉 Deployment completed!")
      addLog(`🌐 Site is live at: ${data.url}`)

      setDeploymentUrl(data.url)
      setDeploymentStatus("Deployment successful!")

      // Refresh debug info
      fetchDebugInfo()
    } catch (err: any) {
      console.error("[Firebase] Deploy error:", err)
      setError(err.message || "Deployment failed")
      addLog(`❌ Error: ${err.message}`)
      setDeploymentStatus("Deployment failed")
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy to Firebase
          </CardTitle>
          <CardDescription>Deploy your website to Firebase Hosting with automatic SSL and global CDN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isAuthenticated && !deploymentStatus && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">Authentication successful! You're ready to deploy.</p>
            </div>
          )}

          {deploymentStatus && (
            <div
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                deploymentStatus.includes("successful")
                  ? "bg-green-50 border-green-200 text-green-700"
                  : deploymentStatus.includes("failed")
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              {deploymentStatus.includes("successful") ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : deploymentStatus.includes("failed") ? (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
              )}
              <p className="text-sm font-medium">{deploymentStatus}</p>
            </div>
          )}

          {deploymentUrl && (
            <div className="p-4 border border-border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">Your site is live! 🎉</p>
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-2"
              >
                {deploymentUrl}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleAuthenticate}
              disabled={isAuthenticating || isDeploying || isAuthenticated}
              variant={isAuthenticated ? "outline" : "default"}
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : isAuthenticated ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Authenticated
                </>
              ) : (
                "1. Authenticate with Google"
              )}
            </Button>

            <Button
              onClick={handleDeploy}
              disabled={isDeploying || isAuthenticating || !isAuthenticated}
              className="w-full"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  2. Deploy to Firebase
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={() => {
              setShowDebug(!showDebug)
              if (!showDebug && !debugInfo) {
                fetchDebugInfo()
              }
            }}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebug ? "Hide" : "Show"} Debug Information
          </Button>
        </CardContent>
      </Card>

      {showDebug && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDebug ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : debugInfo ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Project Status</h4>
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono space-y-1">
                    <div>Name: {debugInfo.project.name}</div>
                    <div>Pages: {debugInfo.project.pagesCount}</div>
                    <div>Firebase Project: {debugInfo.project.firebaseProjectId || "Not created"}</div>
                    <div>Firebase URL: {debugInfo.project.firebaseUrl || "Not deployed"}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Authentication Status</h4>
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono space-y-1">
                    <div>Authenticated: {debugInfo.authentication.isAuthenticated ? "✅ Yes" : "❌ No"}</div>
                    <div>Has Access Token: {debugInfo.authentication.hasAccessToken ? "✅ Yes" : "❌ No"}</div>
                    <div>Has Refresh Token: {debugInfo.authentication.hasRefreshToken ? "✅ Yes" : "❌ No"}</div>
                    {debugInfo.authentication.tokenExpiresIn && (
                      <div>Token Expires In: {debugInfo.authentication.tokenExpiresIn}s</div>
                    )}
                  </div>
                </div>

                {debugInfo.pages.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Pages to Deploy</h4>
                    <div className="bg-muted p-3 rounded-lg text-xs font-mono space-y-1">
                      {debugInfo.pages.map((page, i) => (
                        <div key={i}>
                          {page.name} ({(page.size / 1024).toFixed(2)} KB)
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {debugInfo.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Recommendations</h4>
                    <div className="space-y-2">
                      {debugInfo.recommendations.map((rec, i) => (
                        <div key={i} className="text-sm">
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click to load debug information</p>
            )}
          </CardContent>
        </Card>
      )}

      {deploymentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Deployment Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-64 overflow-auto">
              {deploymentLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">1.</span>
            <p>Click "Authenticate with Google" to grant Firebase deployment permissions</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">2.</span>
            <p>You'll be redirected to Google to authorize access to Firebase</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">3.</span>
            <p>After successful authentication, return here and click "Deploy to Firebase"</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">4.</span>
            <p>Your site will be created on Firebase with automatic SSL and global CDN</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">5.</span>
            <p>You'll receive a live URL (e.g., your-site.web.app) that's ready to share!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
