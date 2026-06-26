"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Database, Key, Lock, Mail, Sparkles, Wallet, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  INTEGRATION_CATALOG,
  type IntegrationDefinition,
  getIntegrationById,
} from "@/lib/integrations"

export type IntegrationRequestPayload = {
  integrations?: string[]
  envKeys?: string[]
  reason?: string
  source?: string
}

type ProjectIntegrationsDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  request: IntegrationRequestPayload | null
  onSaved?: (saved: { integrationIds: string[]; envKeys: string[] }) => void
}

const iconByCategory = {
  Database,
  Auth: Lock,
  Payments: Wallet,
  Email: Mail,
  AI: Sparkles,
  Storage: Database,
  Services: Wrench,
} satisfies Record<IntegrationDefinition["category"], typeof Database>

export function ProjectIntegrationsDialog({
  projectId,
  open,
  onOpenChange,
  request,
  onSaved,
}: ProjectIntegrationsDialogProps) {
  const requestedIntegrationIds = request?.integrations ?? []
  const requestedEnvKeys = request?.envKeys ?? []

  const requestedIntegrations = useMemo(() => {
    if (requestedIntegrationIds.length === 0) return []
    return requestedIntegrationIds
      .map((integrationId) => getIntegrationById(integrationId))
      .filter((integration): integration is IntegrationDefinition => Boolean(integration))
  }, [requestedIntegrationIds])

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("")
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const nextSelected =
      requestedIntegrations[0]?.id ??
      (requestedIntegrationIds.length === 0 && requestedEnvKeys.length === 0 ? INTEGRATION_CATALOG[0]?.id ?? "" : "")
    setSelectedIntegrationId(nextSelected)
    setCustomValues({})
    setSaveError(null)
    setIsSaving(false)
  }, [open, requestedEnvKeys, requestedIntegrationIds, requestedIntegrations])

  const selectedIntegration =
    getIntegrationById(selectedIntegrationId) ??
    requestedIntegrations[0] ??
    null

  const visibleIntegrations =
    requestedIntegrations.length > 0
      ? requestedIntegrations
      : requestedEnvKeys.length > 0
        ? []
        : INTEGRATION_CATALOG

  const visibleEnvKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const envKey of selectedIntegration?.envKeys ?? []) keys.add(envKey)
    for (const envKey of requestedEnvKeys) keys.add(envKey)
    return Array.from(keys)
  }, [requestedEnvKeys, selectedIntegration])

  const handleSave = async () => {
    if (visibleEnvKeys.length === 0) {
      onSaved?.({
        integrationIds: selectedIntegration ? [selectedIntegration.id] : [],
        envKeys: [],
      })
      onOpenChange(false)
      return
    }

    const missingValueKey = visibleEnvKeys.find((envKey) => !(customValues[envKey] || "").trim())
    if (missingValueKey) {
      setSaveError(`Enter a value for ${missingValueKey}.`)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      for (const envKey of visibleEnvKeys) {
        const response = await fetch(`/api/projects/${projectId}/env`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: envKey,
            value: customValues[envKey].trim(),
            integration: selectedIntegration?.id ?? null,
          }),
        })
        if (!response.ok) {
          throw new Error(`Failed to save ${envKey}`)
        }
      }

      onSaved?.({
        integrationIds: selectedIntegration ? [selectedIntegration.id] : [],
        envKeys: visibleEnvKeys,
      })
      onOpenChange(false)
    } catch (error: any) {
      setSaveError(error?.message || "Failed to save integration values.")
    } finally {
      setIsSaving(false)
    }
  }

  const title =
    requestedEnvKeys.length > 0 && requestedIntegrations.length === 0
      ? "Load Required Environment Variables"
      : requestedIntegrations.length > 0 || requestedEnvKeys.length > 0
        ? "Connect Required Integration"
        : "Connect Integration"

  const description =
    request?.reason ||
    "This project needs environment variables before the AI can safely continue."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {visibleIntegrations.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleIntegrations.map((integration) => {
              const CategoryIcon = iconByCategory[integration.category]
              const isActive = integration.id === (selectedIntegration?.id ?? "")
              return (
                <button
                  key={integration.id}
                  type="button"
                  onClick={() => setSelectedIntegrationId(integration.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: integration.iconBg || "#ffffff14" }}
                    >
                      <CategoryIcon
                        className="h-4 w-4"
                        style={{ color: integration.iconColor || "currentColor" }}
                      />
                    </span>
                    <div>
                      <div className="font-medium">{integration.name}</div>
                      <div className="text-xs text-muted-foreground">{integration.category}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </button>
              )
            })}
            </div>
          )}

          {(selectedIntegration || visibleEnvKeys.length > 0) && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4" />
                <span>{selectedIntegration ? `${selectedIntegration.name} environment` : "Environment variables"}</span>
              </div>
              <div className="space-y-3">
                {visibleEnvKeys.map((envKey) => (
                  <div key={envKey} className="space-y-2">
                    <Label htmlFor={envKey}>{envKey}</Label>
                    <Input
                      id={envKey}
                      value={customValues[envKey] || ""}
                      onChange={(event) =>
                        setCustomValues((current) => ({
                          ...current,
                          [envKey]: event.target.value,
                        }))
                      }
                      placeholder={
                        selectedIntegration?.placeholders?.[envKey] ||
                        "Enter environment value"
                      }
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved keys are loaded automatically into deploy environments.</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Later
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Integration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
