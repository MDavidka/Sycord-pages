'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, Puzzle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BUILTIN_MCP_FALLBACK,
  BUILTIN_SKILL_FALLBACK,
  fetchProjectMcp,
  fetchProjectSkills,
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

export function McpLibrary({
  projectId,
  isDark = true,
  onBack,
  onMcpChange,
}: McpLibraryProps) {
  const [addons, setAddons] = useState<SyraSlashMcpAddon[]>(BUILTIN_MCP_FALLBACK)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    void fetchProjectMcp(projectId).then((res) => {
      if (cancelled) return
      const next = res.addons.length ? res.addons : BUILTIN_MCP_FALLBACK
      setAddons(next)
      setError(res.error || null)
      onMcpChange?.(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, onMcpChange])

  const handleToggle = async (addon: SyraSlashMcpAddon) => {
    if (!projectId || busyId) return
    setBusyId(addon.id)
    setError(null)
    const result = await toggleProjectMcp(projectId, addon, !addon.connected)
    if (result.error) setError(result.error)
    if (result.addons.length > 0) {
      setAddons(result.addons)
      onMcpChange?.(result.addons)
    } else {
      setAddons((prev) =>
        prev.map((a) => (a.id === addon.id ? { ...a, connected: !a.connected } : a)),
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
          <h1 className="text-[15px] font-semibold tracking-tight">MCP library</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Connect MCP addons for this project
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
        {error && <p className="mb-3 text-[12px] text-amber-400">{error}</p>}
        <ul className="space-y-2">
          {addons.map((addon) => {
            const busy = busyId === addon.id
            return (
              <li key={addon.id}>
                <button
                  type="button"
                  disabled={!projectId || busy}
                  onClick={() => void handleToggle(addon)}
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
                      addon.connected
                        ? 'bg-sky-500/15 text-sky-400'
                        : isDark
                          ? 'bg-[#2a2b2e] text-[#9a9b9e]'
                          : 'bg-gray-200 text-gray-500',
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : addon.connected ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Puzzle className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-medium">
                      {addon.name}
                      {addon.connected && (
                        <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                          Connected
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[12px] leading-snug',
                        isDark ? 'text-[#6b6c6f]' : 'text-gray-500',
                      )}
                    >
                      {addon.description ||
                        (addon.connected ? 'Connected — tap to disconnect' : 'Available — tap to connect')}
                      {typeof addon.toolsCount === 'number' && addon.toolsCount > 0
                        ? ` · ${addon.toolsCount} tools`
                        : ''}
                    </span>
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
