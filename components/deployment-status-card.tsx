"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, AlertCircle, Loader2, Trash2, ExternalLink, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DeploymentStatusCardProps {
  domain: string
  subdomain: string
  deploymentId: string
  projectId: string
  onDelete: (deploymentId: string) => void
  isDeleting?: boolean
}

export function DeploymentStatusCard({
  domain,
  subdomain,
  deploymentId,
  projectId,
  onDelete,
  isDeleting = false,
}: DeploymentStatusCardProps) {
  const [isLive, setIsLive] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const checkDeploymentStatus = async () => {
      setIsChecking(true)
      try {
        const response = await fetch("/api/deployments/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        })

        const result = await response.json()
        setIsLive(result.isLive)
      } catch (error) {
        console.error("[v0] Error checking deployment status:", error)
        setIsLive(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkDeploymentStatus()
    const interval = setInterval(checkDeploymentStatus, 30000)
    return () => clearInterval(interval)
  }, [domain])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://${domain}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-card/50 hover:bg-card transition-colors text-sm">
      {/* Status Icon */}
      {isChecking ? (
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
      ) : isLive ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      )}

      {/* Domain Text */}
      <a
        href={`https://${domain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary hover:underline truncate flex-1 min-w-0"
        title={domain}
      >
        {domain}
      </a>

      {/* Status Badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded whitespace-nowrap font-medium flex-shrink-0 ${
          isLive ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {isChecking ? "..." : isLive ? "Live" : "Pending"}
      </span>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Copy URL Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={copyToClipboard}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Copy URL"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>

        {/* Open Site Button */}
        {isLive && (
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Visit site"
          >
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(deploymentId)}
          disabled={isDeleting}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Delete deployment"
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
