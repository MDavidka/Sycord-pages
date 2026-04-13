import React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile Settings | Sycord",
  description: "Manage your profile, email preferences, and integrations.",
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background md:ml-16">
      {children}
    </div>
  )
}
