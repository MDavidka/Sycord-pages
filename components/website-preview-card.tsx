"use client"

import { useState } from "react"
import { Loader2, AlertCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebsitePreviewCardProps {
  domain: string
  isLive: boolean
  deploymentId?: string
  projectId?: string
  onDelete?: (deploymentId: string) => void
}

export function WebsitePreviewCard({ domain, isLive, deploymentId, projectId, onDelete }: WebsitePreviewCardProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deploymentId) return
    if (!confirm("Are you sure you want to delete this website?")) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/deployments?id=${deploymentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        console.log("[v0] Website deleted successfully")
        onDelete?.(deploymentId)
      } else {
        alert("Failed to delete website")
      }
    } catch (error) {
      console.error("[v0] Error deleting website:", error)
      alert("Error deleting website")
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isLive) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300 relative group">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Website pending</p>
        </div>
        {deploymentId && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-border relative group">
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}

      {imageError ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Preview unavailable</p>
          </div>
        </div>
      ) : (
        <iframe
          src={`https://${domain}`}
          className="w-full h-full border-none"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true)
            setImageLoading(false)
          }}
          title={`Preview of ${domain}`}
          sandbox="allow-same-origin"
        />
      )}

      <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors pointer-events-none" />

      {deploymentId && (
        <Button
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
