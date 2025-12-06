"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, Copy, ExternalLink, XCircle } from "lucide-react"
import { useState } from "react"

interface DeploymentErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  error: {
    message: string
    code?: string
    status?: number
    details?: string
  } | null
}

export function DeploymentErrorDialog({ isOpen, onClose, error }: DeploymentErrorDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!error) return null

  const formatErrorText = (error: { message: string; code?: string; status?: number; details?: string }): string => {
    return [
      `Error: ${error.message}`,
      `Code: ${error.code || "N/A"}`,
      `Status: ${error.status || "N/A"}`,
      `Details: ${error.details || "N/A"}`
    ].join('\n');
  };

  const handleCopyError = async () => {
    try {
      if (!navigator.clipboard) {
        console.error("Clipboard API not available");
        return;
      }
      const errorText = formatErrorText(error);
      await navigator.clipboard.writeText(errorText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  const getErrorSuggestions = () => {
    const suggestions: string[] = []

    if (error.code === "VERCEL_TOKEN_EXPIRED" || error.status === 401) {
      suggestions.push("Your Vercel connection has expired. Go to Settings and reconnect your Vercel account.")
      suggestions.push("Make sure you're using a valid Vercel access token with proper permissions.")
    }

    if (error.code === "VERCEL_PERMISSION_DENIED" || error.status === 403) {
      suggestions.push("Check that your Vercel integration has 'Projects' scope enabled with Read & Write permissions.")
      suggestions.push("Ensure you have access to 'All Projects' in your Vercel integration settings.")
      suggestions.push("For Team accounts, verify you have the correct role and permissions.")
    }

    if (error.message?.includes("network") || error.message?.includes("fetch")) {
      suggestions.push("Check your internet connection and try again.")
      suggestions.push("Vercel services might be temporarily unavailable. Check Vercel status page.")
    }

    if (error.message?.includes("quota") || error.message?.includes("limit")) {
      suggestions.push("You may have reached your Vercel account limits.")
      suggestions.push("Consider upgrading your Vercel plan or removing unused projects.")
    }

    if (suggestions.length === 0) {
      suggestions.push("Try disconnecting and reconnecting your Vercel account in Settings.")
      suggestions.push("Contact support if the issue persists.")
    }

    return suggestions
  }

  const suggestions = getErrorSuggestions()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            <DialogTitle className="text-xl">Deployment Failed</DialogTitle>
          </div>
          <DialogDescription>
            We encountered an issue while deploying your project to Vercel. Please review the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Message */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Message</AlertTitle>
            <AlertDescription>
              <p className="font-mono text-sm break-words">{error.message}</p>
            </AlertDescription>
          </Alert>

          {/* Error Details */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Error Details</h4>
            <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
              {error.code && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error Code:</span>
                  <code className="font-mono font-semibold">{error.code}</code>
                </div>
              )}
              {error.status && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HTTP Status:</span>
                  <code className="font-mono font-semibold">{error.status}</code>
                </div>
              )}
              {error.details && (
                <div className="mt-2">
                  <span className="text-muted-foreground">Additional Details:</span>
                  <p className="font-mono text-xs mt-1 whitespace-pre-wrap break-words">{error.details}</p>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Suggested Solutions</h4>
            <ul className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Helpful Links */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Helpful Resources</h4>
            <div className="flex flex-col gap-2">
              <a
                href="https://vercel.com/docs/rest-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Vercel API Documentation
              </a>
              <a
                href="https://vercel.com/docs/security/deployment-protection"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Vercel Deployment Protection
              </a>
              <a
                href="https://vercel.com/status"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Vercel Status Page
              </a>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyError}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy Error Details"}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
