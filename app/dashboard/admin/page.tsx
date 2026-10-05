"use client"

import React from "react"
import { AdminModeratorModelSetup } from "@/components/moderator/admin-moderator-model-setup"

export default function AdminPage() {
  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto text-white space-y-8 bg-zinc-950 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin & Moderator Dashboard</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage system configurations, provision Vercel AI Gateway models, and audit live capabilities.
        </p>
      </div>

      <AdminModeratorModelSetup />
    </div>
  )
}
