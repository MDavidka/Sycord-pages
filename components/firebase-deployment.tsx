"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2, ExternalLink, Rocket } from "lucide-react"

interface FirebaseDeploymentProps {
  projectId: string
  projectName: string
}

export function FirebaseDeployment({ projectId, projectName }: FirebaseDeploymentProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([])

  const handleAuthenticate = async () => {
    setIsAuthenticating(true)
    setError(null)
    
    try {
      // Redirect to OAuth initiation endpoint
      window.location.href = `/api/firebase/auth/initiate?projectId=${projectId}`
    } catch (err: any) {
      console.error("[Firebase] Auth error:", err)
      setError(err.message || "Authentication failed")
      setIsAuthenticating(false)
    }
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDeploymentLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    setError(null)
    setDeploymentStatus("Starting deployment...")
    setDeploymentLogs([])

    try {
      addLog("🚀 Starting Firebase deployment")
      addLog("📦 Preparing files...")
      
      const response = await fetch("/api/firebase/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Deployment failed")
      }

      const data = await response.json()
      
      addLog("✅ Files uploaded successfully")
      addLog("🎉 Deployment finalized")
      addLog(`🌐 Site is live at: ${data.url}`)
      
      setDeploymentUrl(data.url)
      setDeploymentStatus("Deployment successful!")
      
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
          <CardDescription>
            Deploy your website to Firebase Hosting with automatic SSL and global CDN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {deploymentStatus && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              deploymentStatus.includes("successful") 
                ? "bg-green-50 border-green-200 text-green-700"
                : deploymentStatus.includes("failed")
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
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
              <p className="text-sm font-medium mb-2">Your site is live!</p>
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
              disabled={isAuthenticating || isDeploying}
              variant="outline"
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "1. Authenticate with Google"
              )}
            </Button>

            <Button
              onClick={handleDeploy}
              disabled={isDeploying || isAuthenticating}
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
        </CardContent>
      </Card>

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
          <CardTitle className="text-sm">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">1.</span>
            <p>Click "Authenticate with Google" to grant Firebase deployment permissions</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">2.</span>
            <p>After authentication, click "Deploy to Firebase" to start deployment</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">3.</span>
            <p>Your site will be created on Firebase and deployed with automatic SSL</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-foreground">4.</span>
            <p>You'll receive a live URL (e.g., your-site.web.app) that's ready to share</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
