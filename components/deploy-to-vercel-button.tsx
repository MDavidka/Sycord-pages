"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface DeployToVercelButtonProps {
  businessName: string
}

export function DeployToVercelButton({ businessName }: DeployToVercelButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDeploy = async () => {
    setIsGenerating(true)
    
    try {
      // Generate a Deploy to Vercel URL with project configuration
      const repositoryUrl = "https://github.com/Edev-s/Sycord-pages"
      const projectName = encodeURIComponent(businessName || "my-site")
      
      // Build the Deploy to Vercel URL
      const deployUrl = new URL("https://vercel.com/new/clone")
      deployUrl.searchParams.set("repository-url", repositoryUrl)
      deployUrl.searchParams.set("project-name", projectName)
      
      // Open the Deploy to Vercel page in a new tab
      window.open(deployUrl.toString(), "_blank")
    } catch (error) {
      console.error("[DeployToVercelButton] Error generating deploy URL:", error)
      toast.error("Failed to generate deploy URL. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 22.525H0l12-21.05 12 21.05z" />
          </svg>
          Deploy to Vercel
        </CardTitle>
        <CardDescription>
          Deploy your site directly to your Vercel account with one click
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will open Vercel's deployment page where you can deploy this site template to your own Vercel account.
            No API connection required!
          </p>
          <Button
            onClick={handleDeploy}
            disabled={isGenerating}
            className="w-full bg-black text-white hover:bg-zinc-800 gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Deploy with Vercel
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
