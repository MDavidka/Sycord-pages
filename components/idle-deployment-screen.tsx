"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Rocket,
  Sparkles,
  CheckCircle2,
  Zap,
  Globe,
  Clock,
  ArrowRight,
} from "lucide-react"

export interface IdleDeploymentScreenProps {
  projectName?: string
  hasPages: boolean
  onDeploy: () => void
  onGeneratePages: () => void
  isDeploying?: boolean
  recentDeploys?: Array<{
    timestamp: string
    status: "success" | "failed"
    message?: string
  }>
}

export function IdleDeploymentScreen({
  projectName,
  hasPages,
  onDeploy,
  onGeneratePages,
  isDeploying = false,
  recentDeploys = [],
}: IdleDeploymentScreenProps) {
  const lastDeploy = recentDeploys[0]
  const isSuccessful = lastDeploy?.status === "success"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
          {/* Hero Section */}
          <div className="text-center space-y-4 pt-8">
            <div className="flex justify-center mb-6">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-xl" />
                <div className="relative h-full w-full rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Rocket className="h-8 w-8 text-blue-400" />
                </div>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
              Ready to Deploy
            </h1>

            <p className="text-lg text-zinc-300 max-w-md mx-auto">
              {hasPages
                ? "Your pages are prepared and waiting for deployment. Click the button below to launch your website."
                : "Start by generating pages with AI, then deploy them directly to your live server."}
            </p>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deploy Card */}
            <Card
              className={cn(
                "border-white/10 bg-gradient-to-br from-emerald-500/10 to-green-600/5 backdrop-blur-sm overflow-hidden transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20",
                !hasPages && "opacity-50 pointer-events-none"
              )}
            >
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Rocket className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-white text-lg">Deploy Pages</h3>
                  <p className="text-sm text-zinc-400">
                    {hasPages
                      ? "Launch your site to production now"
                      : "Generate pages first to deploy"}
                  </p>
                </div>
                <Button
                  onClick={onDeploy}
                  disabled={!hasPages || isDeploying}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 font-medium"
                >
                  {isDeploying ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-emerald-200 border-t-emerald-50 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Deploy Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generate Card */}
            <Card className="border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-600/5 backdrop-blur-sm overflow-hidden transition-all hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/20">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold text-white text-lg">Generate Pages</h3>
                  <p className="text-sm text-zinc-400">
                    {hasPages ? "Create more pages" : "Build your first pages"}
                  </p>
                </div>
                <Button
                  onClick={onGeneratePages}
                  variant="outline"
                  className="w-full gap-2 border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 font-medium"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features List */}
          <Card className="border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
                Deployment Features
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Instant Deployment</p>
                    <p className="text-xs text-zinc-500">One-click deployment to live servers</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe className="h-3 w-3 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Custom Domain</p>
                    <p className="text-xs text-zinc-500">Point your own domain in settings</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="h-3 w-3 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Auto Scaling</p>
                    <p className="text-xs text-zinc-500">Handles traffic spikes automatically</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-3 w-3 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Deployment History</p>
                    <p className="text-xs text-zinc-500">Track all deployment updates</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Deploys */}
          {recentDeploys.length > 0 && (
            <Card className="border-white/10 bg-white/[0.02] backdrop-blur-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-200">Recent Deployments</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {recentDeploys.slice(0, 3).map((deploy, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full flex-shrink-0",
                            deploy.status === "success"
                              ? "bg-emerald-400"
                              : "bg-red-400"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200 truncate">
                            {deploy.status === "success"
                              ? "Deployed successfully"
                              : "Deployment failed"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(deploy.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-600 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-zinc-600 pt-8 mt-auto">
        <p>
          {projectName && (
            <>
              Project: <span className="text-zinc-400 font-medium">{projectName}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
