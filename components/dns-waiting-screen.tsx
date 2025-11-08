"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DNSWaitingScreenProps {
  subdomain: string
  domain: string
  onReady?: (isReady: boolean) => void
}

export function DNSWaitingScreen({ subdomain, domain, onReady }: DNSWaitingScreenProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [checkAttempts, setCheckAttempts] = useState(0)
  const MAX_WAIT_TIME = 600 // 10 minutes in seconds
  const CHECK_INTERVAL = 5000 // Check every 5 seconds

  useEffect(() => {
    const checkDNS = async () => {
      try {
        const response = await fetch(`/api/deployments/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        })

        const result = await response.json()
        if (result.isLive) {
          setIsReady(true)
          onReady?.(true)
          return true
        }
      } catch (error) {
        console.log("[v0] DNS check attempt", checkAttempts + 1)
      }
      return false
    }

    // Check immediately
    checkDNS()

    // Set up interval
    const interval = setInterval(async () => {
      setCheckAttempts((prev) => prev + 1)
      const ready = await checkDNS()
      if (ready) {
        clearInterval(interval)
      }
    }, CHECK_INTERVAL)

    const timer = setInterval(() => {
      setTimeElapsed((prev) => {
        if (prev >= MAX_WAIT_TIME) {
          clearInterval(interval)
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(timer)
    }
  }, [domain, onReady])

  const progressPercent = (timeElapsed / MAX_WAIT_TIME) * 100
  const minutes = Math.floor(timeElapsed / 60)
  const seconds = timeElapsed % 60

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white shadow-lg mb-4">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Setting up your website</h1>
          <p className="text-muted-foreground">We're configuring DNS and SSL certificates...</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                </div>
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">DNS Propagation</p>
                <p className="text-sm text-muted-foreground">Spreading across global DNS servers</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                </div>
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">SSL Certificate</p>
                <p className="text-sm text-muted-foreground">Issuing secure connection</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100">
                  <span className="text-xs font-semibold text-muted-foreground">3</span>
                </div>
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Website Live</p>
                <p className="text-sm text-muted-foreground">Almost ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 95)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {minutes}:{seconds.toString().padStart(2, "0")} elapsed
          </p>
        </div>

        {/* Domain Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-medium text-blue-900">Your website domain:</p>
          <p className="text-lg font-mono font-bold text-blue-600 break-all">{domain}</p>
        </div>

        {/* Timeout Message */}
        {timeElapsed > MAX_WAIT_TIME - 60 && !isReady && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Taking longer than expected?</p>
                <p className="text-sm text-yellow-800 mt-1">
                  DNS propagation can take up to 48 hours. Try refreshing in a moment, or check your DNS settings in
                  Hostinger.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 bg-transparent"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Don't close this page while we're setting up</p>
      </div>
    </div>
  )
}
