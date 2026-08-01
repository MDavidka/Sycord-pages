'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { McpBrandIcon } from './McpBrandIcons'
import {
  BUILTIN_SKILL_FALLBACK,
  fetchProjectMcp,
  fetchProjectSkills,
  mergeMcpCatalog,
  toggleProjectMcp,
  toggleProjectSkill,
  type SyraSlashMcpAddon,
  type SyraSlashSkill,
} from '../lib/syraSlashExtras'

type SkillsLibraryProps = {
  projectId: string | null
  isDark?: boolean
  onBack: () => void
  onSkillsChange?: (skills: SyraSlashSkill[]) => void
}

export function SkillsLibrary({
  projectId,
  isDark = true,
  onBack,
  onSkillsChange,
}: SkillsLibraryProps) {
  const [skills, setSkills] = useState<SyraSlashSkill[]>(BUILTIN_SKILL_FALLBACK)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    void fetchProjectSkills(projectId).then((res) => {
      if (cancelled) return
      setSkills(res.skills)
      setError(res.error || null)
      onSkillsChange?.(res.skills)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, onSkillsChange])

  const handleToggle = async (skill: SyraSlashSkill) => {
    if (!projectId || busyId) return
    setBusyId(skill.id)
    setError(null)
    const result = await toggleProjectSkill(projectId, skill.id, !skill.active)
    if (result.error) setError(result.error)
    if (result.skills.length > 0) {
      setSkills(result.skills)
      onSkillsChange?.(result.skills)
    } else {
      setSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, active: !s.active } : s)),
      )
    }
    setBusyId(null)
  }

  return (
    <div className={cn('flex h-full flex-col', isDark ? 'bg-[#18191B] text-white' : 'bg-white text-gray-900')}>
      <header
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3',
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200',
        )}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="h-9 w-9 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight">Skills library</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Enable skills for this project agent
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!projectId && (
          <p className={cn('text-[13px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Open a project chat to manage Syte skills.
          </p>
        )}
        {error && <p className="mb-3 text-[12px] text-amber-400">{error}</p>}
        <ul className="space-y-2">
          {skills.map((skill) => {
            const busy = busyId === skill.id
            return (
              <li key={skill.id}>
                <button
                  type="button"
                  disabled={!projectId || busy}
                  onClick={() => void handleToggle(skill)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors',
                    isDark
                      ? 'border-[#2a2b2e] bg-[#1c1d1f] hover:bg-[#222326]'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
                    (!projectId || busy) && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl',
                      skill.active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isDark
                          ? 'bg-[#2a2b2e] text-[#9a9b9e]'
                          : 'bg-gray-200 text-gray-500',
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : skill.active ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-medium">
                      {skill.name}
                      {skill.active && (
                        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                          Active
                        </span>
                      )}
                    </span>
                    {skill.description && (
                      <span
                        className={cn(
                          'mt-0.5 block text-[12px] leading-snug',
                          isDark ? 'text-[#6b6c6f]' : 'text-gray-500',
                        )}
                      >
                        {skill.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

type McpLibraryProps = {
  projectId: string | null
  isDark?: boolean
  onBack: () => void
  onMcpChange?: (addons: SyraSlashMcpAddon[]) => void
}

function openMcpOAuthPopup(projectId: string, addonId: string): Window | null {
  const url = `/api/mcp/oauth/start?projectId=${encodeURIComponent(projectId)}&addon=${encodeURIComponent(addonId)}`
  const width = 520
  const height = 720
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
  // Use unique window name to prevent conflicts with other popups
  const windowName = `sycord-mcp-oauth-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return window.open(
    url,
    windowName,
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  )
}

export function McpLibrary({
  projectId,
  isDark = true,
  onBack,
  onMcpChange,
}: McpLibraryProps) {
  const [addons, setAddons] = useState<SyraSlashMcpAddon[]>(() => mergeMcpCatalog([]))
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKeyAddon, setApiKeyAddon] = useState<SyraSlashMcpAddon | null>(null)
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({})
  const [apiKeySaving, setApiKeySaving] = useState(false)

  const refresh = async () => {
    if (!projectId) {
      setAddons(mergeMcpCatalog([]))
      return
    }
    setLoading(true)
    const res = await fetchProjectMcp(projectId)
    setAddons(res.addons.length ? res.addons : mergeMcpCatalog([]))
    setError(res.error || null)
    onMcpChange?.(res.addons.length ? res.addons : mergeMcpCatalog([]))
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; ok?: boolean; addon?: string; error?: string; connectError?: string } | null
      if (!data || data.type !== 'sycord-mcp-oauth') return

      // Send ack back to popup so it knows to close
      try {
        ;(event.source as Window | null)?.postMessage({ type: 'sycord-mcp-oauth-ack' }, event.origin || '*')
      } catch {
        // ack is best-effort
      }

      if (!data.ok) {
        const errorMsg = data.connectError || data.error || 'OAuth connection failed'
        setError(errorMsg)
        setBusyId(null)
        return
      }
      setBusyId(null)
      void refresh()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const markConnected = (addonId: string, connected: boolean) => {
    setAddons((prev) => {
      const next = mergeMcpCatalog(
        prev.map((a) => (a.id === addonId ? { ...a, connected } : a)),
      )
      onMcpChange?.(next)
      return next
    })
  }

  const handleDisconnect = async (addon: SyraSlashMcpAddon) => {
    if (!projectId || busyId) return
    setBusyId(addon.id)
    setError(null)
    const result = await toggleProjectMcp(projectId, addon, false)
    if (result.error) setError(result.error)
    if (!result.error && result.hasRemoteState) {
      setAddons(result.addons)
      onMcpChange?.(result.addons)
    } else if (!result.error) {
      markConnected(addon.id, false)
    }
    setBusyId(null)
  }

  const handleConnect = async (addon: SyraSlashMcpAddon) => {
    if (!projectId || busyId) return
    setError(null)

    if (addon.connected) {
      await handleDisconnect(addon)
      return
    }

    const authType = addon.authType || 'builtin'

    if (authType === 'oauth') {
      setBusyId(addon.id)
      const popup = openMcpOAuthPopup(projectId, addon.id)
      if (!popup) {
        setError('Popup blocked — allow popups to complete OAuth.')
        setBusyId(null)
        return
      }
      // Poll until popup closes; if postMessage already arrived the timer is cleared by ack handler
      let messageReceived = false
      const markReceived = () => { messageReceived = true }
      window.addEventListener('message', function onceMsg(e) {
        if (e.data?.type === 'sycord-mcp-oauth') {
          markReceived()
          window.removeEventListener('message', onceMsg)
        }
      })
      const timer = window.setInterval(() => {
        if (!popup.closed) return
        window.clearInterval(timer)
        if (!messageReceived) {
          // Popup closed without a postMessage — refresh to detect if connection actually succeeded
          void refresh()
          setBusyId(null)
        }
      }, 400)
      return
    }

    if (authType === 'api_key') {
      const keys = addon.envKeys?.length ? addon.envKeys : ['API_KEY']
      setApiKeyAddon(addon)
      setApiKeyValues(Object.fromEntries(keys.map((k) => [k, ''])))
      return
    }

    // builtin (Syte web search) — direct connect
    setBusyId(addon.id)
    const result = await toggleProjectMcp(projectId, addon, true)
    if (result.error) setError(result.error)
    if (result.error) {
      setBusyId(null)
      return
    }
    if (result.hasRemoteState) {
      setAddons(result.addons)
      onMcpChange?.(result.addons)
    } else {
      markConnected(addon.id, true)
    }
    setBusyId(null)
  }

  const saveApiKeysAndConnect = async () => {
    if (!projectId || !apiKeyAddon) return
    const keys = apiKeyAddon.envKeys || []
    const missing = keys.find((k) => !(apiKeyValues[k] || '').trim())
    if (missing) {
      setError(`Enter a value for ${missing}.`)
      return
    }
    setApiKeySaving(true)
    setError(null)
    try {
      for (const key of keys) {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/env`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            value: apiKeyValues[key].trim(),
            integration: apiKeyAddon.id,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.message || `Failed to save ${key}`)
        }
      }
      const result = await toggleProjectMcp(projectId, apiKeyAddon, true)
      if (result.error) throw new Error(result.error)
      if (result.hasRemoteState) {
        setAddons(result.addons)
        onMcpChange?.(result.addons)
      } else {
        markConnected(apiKeyAddon.id, true)
      }
      setApiKeyAddon(null)
      setApiKeyValues({})
    } catch (err: any) {
      setError(err?.message || 'Failed to save credentials')
    } finally {
      setApiKeySaving(false)
    }
  }

  const authHint = (addon: SyraSlashMcpAddon) => {
    if (addon.connected) return 'Connected — tap to disconnect'
    if (addon.authType === 'oauth') return 'Connect with OAuth'
    if (addon.authType === 'api_key') return 'Connect with API key'
    if (addon.id === 'syte') return 'Enable Syte web search'
    return 'Available — tap to connect'
  }

  return (
    <div className={cn('relative flex h-full flex-col', isDark ? 'bg-[#18191B] text-white' : 'bg-white text-gray-900')}>
      <header
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3',
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200',
        )}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="h-9 w-9 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight">MCP library</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Connect with real OAuth or API keys
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!projectId && (
          <p className={cn('text-[13px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Open a project chat to manage MCP addons.
          </p>
        )}
        {error && (
          <div className={cn('mb-4 rounded-lg border p-3', isDark ? 'border-red-900/40 bg-red-950/20' : 'border-red-200 bg-red-50')}>
            <div className={cn('text-[12px] font-medium', isDark ? 'text-red-400' : 'text-red-700')}>
              MCP Connection Error
            </div>
            <p className={cn('mt-1 text-[12px] leading-relaxed', isDark ? 'text-red-300/90' : 'text-red-600')}>
              {error}
            </p>
            <details className={cn('mt-2 text-[11px]', isDark ? 'text-red-400/70' : 'text-red-600/70')}>
              <summary className="cursor-pointer hover:underline">Debug Info</summary>
              <div className={cn('mt-2 rounded border p-2 font-mono', isDark ? 'border-red-900/50 bg-black/30' : 'border-red-200 bg-white/50')}>
                <div>Check browser console for detailed logs</div>
                <div className={cn('mt-1', isDark ? 'text-red-500/60' : 'text-red-500/40')}>
                  Press F12 → Console to see request ID and error details
                </div>
              </div>
            </details>
            <button
              type="button"
              onClick={() => setError(null)}
              className={cn('mt-2 text-[11px] underline', isDark ? 'text-red-400/70 hover:text-red-300' : 'text-red-600/70 hover:text-red-700')}
            >
              Dismiss
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {addons.map((addon) => {
            const busy = busyId === addon.id
            return (
              <li key={addon.id}>
                <button
                  type="button"
                  disabled={!projectId || busy}
                  onClick={() => void handleConnect(addon)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors',
                    isDark
                      ? 'border-[#2a2b2e] bg-[#1c1d1f] hover:bg-[#222326]'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
                    (!projectId || busy) && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                      isDark ? 'bg-[#2a2b2e]' : 'bg-gray-200',
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                    ) : (
                      <McpBrandIcon
                        id={addon.id}
                        name={addon.name}
                        className="h-5 w-5"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                      {addon.name}
                      {addon.connected && (
                        <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                          Connected
                        </span>
                      )}
                      {!addon.connected && addon.authType === 'oauth' && (
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', isDark ? 'bg-[#2a2b2e] text-[#9a9b9e]' : 'bg-gray-200 text-gray-600')}>
                          OAuth
                        </span>
                      )}
                      {!addon.connected && addon.authType === 'api_key' && (
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', isDark ? 'bg-[#2a2b2e] text-[#9a9b9e]' : 'bg-gray-200 text-gray-600')}>
                          API key
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[12px] leading-snug',
                        isDark ? 'text-[#6b6c6f]' : 'text-gray-500',
                      )}
                    >
                      {addon.description || authHint(addon)}
                      {typeof addon.toolsCount === 'number' && addon.toolsCount > 0
                        ? ` · ${addon.toolsCount} tools`
                        : ''}
                    </span>
                    <span className={cn('mt-1 block text-[11px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
                      {authHint(addon)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {apiKeyAddon && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className={cn(
              'w-full max-w-md rounded-2xl border p-4 shadow-xl',
              isDark ? 'border-[#2a2b2e] bg-[#1c1d1f] text-white' : 'border-gray-200 bg-white text-gray-900',
            )}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', isDark ? 'bg-[#2a2b2e]' : 'bg-gray-100')}>
                <McpBrandIcon id={apiKeyAddon.id} name={apiKeyAddon.name} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold">Connect {apiKeyAddon.name}</p>
                <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
                  Enter API credentials to authorize this MCP
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {(apiKeyAddon.envKeys || []).map((key) => (
                <label key={key} className="block space-y-1.5">
                  <span className={cn('text-[12px] font-medium', isDark ? 'text-[#c5c6c9]' : 'text-gray-700')}>
                    {key}
                  </span>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={apiKeyValues[key] || ''}
                    onChange={(e) =>
                      setApiKeyValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className={cn(
                      'h-10',
                      isDark ? 'border-[#2a2b2e] bg-[#141516] text-white' : undefined,
                    )}
                    placeholder={key}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={apiKeySaving}
                onClick={() => {
                  setApiKeyAddon(null)
                  setApiKeyValues({})
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={apiKeySaving} onClick={() => void saveApiKeysAndConnect()}>
                {apiKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type CreditsPanelProps = {
  isDark?: boolean
  onBack: () => void
}

export function CreditsPanel({ isDark = true, onBack }: CreditsPanelProps) {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch('/api/user/credits', { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setError(data?.message || `Failed to load credits (${res.status})`)
          setCredits(null)
        } else {
          setCredits(typeof data?.credits === 'number' ? data.credits : 0)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load credits')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={cn('flex h-full flex-col', isDark ? 'bg-[#18191B] text-white' : 'bg-white text-gray-900')}>
      <header
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3',
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200',
        )}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="h-9 w-9 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight">Credits</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Your AI generation balance
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin opacity-50" />
        ) : error ? (
          <p className="text-[13px] text-amber-400">{error}</p>
        ) : (
          <>
            <p className="text-4xl font-semibold tabular-nums tracking-tight">{credits ?? 0}</p>
            <p className={cn('text-[13px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>credits remaining</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 rounded-xl"
              onClick={() => {
                window.open('/subscriptions', '_blank', 'noopener,noreferrer')
              }}
            >
              View plans
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

type HelpPanelProps = {
  isDark?: boolean
  onBack: () => void
}

export function HelpSupportPanel({ isDark = true, onBack }: HelpPanelProps) {
  return (
    <div className={cn('flex h-full flex-col', isDark ? 'bg-[#18191B] text-white' : 'bg-white text-gray-900')}>
      <header
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3',
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200',
        )}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="h-9 w-9 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight">Help & support</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Get help with Syra and Sycord
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 px-4 py-6">
        <button
          type="button"
          onClick={() => window.open('/contact', '_blank', 'noopener,noreferrer')}
          className={cn(
            'rounded-2xl border px-4 py-3.5 text-left transition-colors',
            isDark
              ? 'border-[#2a2b2e] bg-[#1c1d1f] hover:bg-[#222326]'
              : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
          )}
        >
          <p className="text-[14px] font-medium">Contact support</p>
          <p className={cn('mt-0.5 text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Reach the Sycord team
          </p>
        </button>
        <button
          type="button"
          onClick={() => window.open('/tos', '_blank', 'noopener,noreferrer')}
          className={cn(
            'rounded-2xl border px-4 py-3.5 text-left transition-colors',
            isDark
              ? 'border-[#2a2b2e] bg-[#1c1d1f] hover:bg-[#222326]'
              : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
          )}
        >
          <p className="text-[14px] font-medium">Terms of service</p>
          <p className={cn('mt-0.5 text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Review product terms
          </p>
        </button>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3.5',
            isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-gray-50',
          )}
        >
          <p className="text-[14px] font-medium">Slash shortcuts</p>
          <p className={cn('mt-1 text-[12px] leading-relaxed', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Type <code className="rounded bg-black/20 px-1">/</code> for image &amp; file upload, skills,
            MCP, help, and credits.
          </p>
        </div>
      </div>
    </div>
  )
}
