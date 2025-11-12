"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Check, X, Zap, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

interface SubscriptionTier {
  _id: string
  name: string
  price: number
  currency: string
  description: string
  features: string[]
  isPopular?: boolean
}

interface Feature {
  name: string
  tiers: Record<string, boolean | string>
}

export default function SubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const response = await fetch("/api/subscriptions")
      if (response.ok) {
        const data = await response.json()
        setTiers(data)
      }
    } catch (error) {
      console.error("[v0] Error fetching tiers:", error)
    } finally {
      setLoading(false)
    }
  }

  const comparisonFeatures: Feature[] = [
    { name: "Storage", tiers: { Free: "1 GB", Professional: "50 GB", Ultra: "500 GB" } },
    { name: "Websites", tiers: { Free: true, Professional: true, Ultra: true } },
    { name: "AI Builder", tiers: { Free: false, Professional: true, Ultra: true } },
    { name: "Custom Domains", tiers: { Free: false, Professional: "1", Ultra: "Unlimited" } },
    { name: "Email Support", tiers: { Free: false, Professional: true, Ultra: true } },
    { name: "Priority Support", tiers: { Free: false, Professional: false, Ultra: true } },
    { name: "API Access", tiers: { Free: false, Professional: true, Ultra: true } },
    { name: "Advanced Analytics", tiers: { Free: false, Professional: false, Ultra: true } },
    { name: "Team Members", tiers: { Free: "1", Professional: "3", Ultra: "Unlimited" } },
    { name: "Monthly Deployments", tiers: { Free: "10", Professional: "100", Ultra: "Unlimited" } },
  ]

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Subscription Plans</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {session && (
          <div className="mb-12 p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Current Subscription</p>
                <p className="text-lg font-semibold text-foreground">{session?.user?.email}</p>
                <p className="text-sm text-foreground mt-1">
                  Plan: <span className="font-semibold text-primary">Free</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading plans...</p>
          </div>
        ) : tiers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No subscription plans available yet</p>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {tiers.map((tier) => (
                  <Card
                    key={tier._id}
                    className={`relative overflow-hidden transition-all ${
                      tier.isPopular
                        ? "border-primary shadow-lg scale-105 md:scale-100"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    {tier.isPopular && (
                      <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-1">
                        <Zap className="h-3 w-3" />
                        Most Popular
                      </div>
                    )}

                    <CardHeader className={tier.isPopular ? "pt-16 pb-4" : "pb-4"}>
                      <CardTitle className="text-2xl font-bold text-foreground">{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                      <div className="mt-6">
                        <span className="text-4xl font-bold text-foreground">
                          {tier.price === 0 ? "Free" : `${tier.currency}${tier.price}`}
                        </span>
                        {tier.price !== 0 && <span className="text-muted-foreground ml-2">/month</span>}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <Button
                        className="w-full"
                        variant={tier.isPopular ? "default" : "outline"}
                        disabled={status === "unauthenticated"}
                      >
                        {tier.price === 0 ? "Current Plan" : "Upgrade"}
                      </Button>

                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">What's included:</p>
                        <ul className="space-y-3">
                          {tier.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-16">
              <h2 className="text-3xl font-bold text-foreground mb-8">Detailed Comparison</h2>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left px-6 py-4 font-semibold text-foreground">Feature</th>
                      {tiers.map((tier) => (
                        <th
                          key={tier._id}
                          className="text-center px-6 py-4 font-semibold text-foreground min-w-[150px]"
                        >
                          {tier.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((feature, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-muted/50">
                        <td className="text-left px-6 py-4 font-medium text-foreground">{feature.name}</td>
                        {tiers.map((tier) => {
                          const value = feature.tiers[tier.name]
                          return (
                            <td key={tier._id} className="text-center px-6 py-4">
                              {typeof value === "boolean" ? (
                                value ? (
                                  <Check className="h-5 w-5 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-muted-foreground mx-auto" />
                                )
                              ) : (
                                <span className="text-sm text-foreground font-medium">{value}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
