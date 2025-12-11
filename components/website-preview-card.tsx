"use client"

import { useState } from "react"
import { AlertCircle, Trash2, Edit2, CheckCircle2, Package, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface WebsitePreviewCardProps {
  domain: string
  isLive: boolean
  deploymentId?: string
  projectId?: string
  businessName?: string
  createdAt?: string
  onDelete?: (deploymentId: string) => void
  style?: string
}

export function WebsitePreviewCard({
  domain,
  isLive,
  deploymentId,
  projectId,
  businessName = "Website",
  createdAt = new Date().toISOString(),
  onDelete,
  style = "default",
}: WebsitePreviewCardProps) {
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

  const formattedDate = new Date(createdAt).toLocaleDateString("hu-HU")

  const getWebsiteIcon = () => {
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

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      {!isLive ? (
        <div className="w-full h-40 sm:h-56 md:h-72 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex flex-col items-center justify-center border-b border-border relative group">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-400 rounded-full blur-lg opacity-30 animate-pulse" />
                <AlertCircle className="h-12 w-12 text-yellow-600 relative z-10" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Weboldal mögött létrehozva</p>
            <p className="text-xs text-gray-500">Az üzembe helyezésre vár...</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-48 sm:h-72 md:h-[28rem] bg-gray-100 overflow-hidden group">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
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
            <div className="w-full h-full overflow-hidden flex items-start justify-start">
              <iframe
                src={domain.startsWith("http") ? domain : `https://${domain}`}
                className="w-[1440px] h-[1440px] border-none origin-top-left scale-[0.85] sm:scale-[0.95] md:scale-[1.05] lg:scale-[1.1]"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true)
                  setImageLoading(false)
                }}
                title={`Preview of ${domain}`}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation"
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none" />

          {/* Domain and Live Badge */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-20">
            <div className="flex items-center gap-2">
              <WebsiteIcon className="h-4 w-4 text-white" />
              <p className="text-white text-sm font-medium truncate">{domain}</p>
            </div>
            {isLive && (
              <div className="flex items-center gap-1 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30 backdrop-blur-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-300">Live</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 flex flex-col justify-between flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-base md:text-lg mb-2">{businessName}</h3>
          <p className="text-xs text-muted-foreground">Létrehozva: {formattedDate}</p>
        </div>
        <div className="flex gap-2 mt-4 justify-between">
          <Link href={`/dashboard/sites/${projectId}`} className="flex-1">
            <Button variant="outline" className="w-full bg-transparent" size="sm">
              <Edit2 className="h-4 w-4 mr-2" />
              Szerkesztés
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 border-none"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
