"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

interface DeploymentsStatusProps {
  projectId: string
  projectName: string
}

export function DeploymentsStatus({ projectId, projectName }: DeploymentsStatusProps) {
  const [deployment, setDeployment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [testingDomain, setTestingDomain] = useState(false)
  const [domainWorks, setDomainWorks] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkDeployment() {
      try {
        const response = await fetch(`/api/projects/${projectId}/deployments`)
        if (response.ok) {
          const data = await response.json()
          setDeployment(data.deployment)
          console.log("[v0] Deployment found:", data.deployment)
        }
      } catch (error) {
        console.error("[v0] Error checking deployment:", error)
      } finally {
        setLoading(false)
      }
    }

    checkDeployment()
  }, [projectId])

  const testDomain = async () => {
    if (!deployment) return

    setTestingDomain(true)
    try {
      const response = await fetch(`https://${deployment.domain}`, {
        method: "HEAD",
        mode: "no-cors",
      })
      console.log("[v0] Domain test response:", response.status)
      setDomainWorks(true)
    } catch (error) {
      console.error("[v0] Domain test failed:", error)
      setDomainWorks(false)
    } finally {
      setTestingDomain(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 border border-border rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm text-muted-foreground ml-2">Loading deployment status...</p>
      </div>
    )
  }

  if (!deployment) {
    return (
      <div className="p-4 border border-border rounded-lg bg-yellow-50 border-yellow-200">
        <p className="text-sm text-muted-foreground">No deployment found for this project.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border border-border rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">Deployment Active</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Your site is deployed to: <code className="bg-muted px-2 py-1 rounded text-xs">{deployment.domain}</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-mono text-green-700">{deployment.status}</span> | Created:{" "}
              {new Date(deployment.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border border-border rounded-lg bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-2">Test Your Deployment</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Make sure DNS is configured with a wildcard record for *.ltpd.xyz pointing to your hosting provider.
            </p>
            <Button size="sm" onClick={testDomain} disabled={testingDomain} className="mb-2">
              {testingDomain ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Domain"
              )}
            </Button>
            {domainWorks === true && (
              <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">✓ Domain is working!</p>
            )}
            {domainWorks === false && (
              <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                ⚠ Domain test failed. Check DNS configuration.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border border-border rounded-lg">
        <h4 className="font-semibold text-sm mb-3">Deployment Debug Info</h4>
        <code className="text-xs bg-muted p-3 rounded block overflow-auto max-h-40">
          <pre>{JSON.stringify(deployment, null, 2)}</pre>
        </code>
      </div>

      <div className="p-4 border border-dashed border-border rounded-lg bg-gray-50">
        <h4 className="font-semibold text-sm mb-2">DNS Configuration</h4>
        <p className="text-xs text-muted-foreground mb-2">For subdomain {deployment.domain} to work, ensure:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>DNS record: *.ltpd.xyz → CNAME → your-hosting-provider.com</li>
          <li>Domain configured in hosting settings</li>
          <li>Wait 5-15 minutes for DNS propagation</li>
          <li>Check deployment logs for debug messages</li>
        </ul>
      </div>
    </div>
  )
}
