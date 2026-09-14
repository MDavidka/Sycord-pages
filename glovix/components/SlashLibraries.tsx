'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { McpBrandIcon } from './McpBrandIcons'
import {
  deleteProjectSkill,
  fetchProjectMcp,
  fetchProjectSkills,
  mergeMcpCatalog,
  toggleProjectMcp,
  toggleProjectSkill,
  uploadProjectSkill,
  type SkillResponsibility,
  type SyraSlashMcpAddon,
  type SyraSlashSkill,
} from '../lib/syraSlashExtras'

type SkillsLibraryProps = {
  projectId: string | null
  isDark?: boolean
  onBack: () => void
  onSkillsChange?: (skills: SyraSlashSkill[]) => void
}

const RESPONSIBILITIES: { id: SkillResponsibility | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'designing', label: 'Designing', icon: '🎨' },
  { id: 'integrating', label: 'Integrating', icon: '🔌' },
  { id: 'building', label: 'Building', icon: '🏗️' },
  { id: 'testing', label: 'Testing', icon: '🧪' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'general', label: 'General', icon: '📋' },
]

function responsibilityBadgeClass(resp?: string, isDark = true) {
  switch (resp) {
    case 'designing':
      return isDark
        ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
        : 'bg-purple-100 text-purple-700 border-purple-200'
    case 'integrating':
      return isDark
        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
        : 'bg-blue-100 text-blue-700 border-blue-200'
    case 'building':
      return isDark
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-amber-100 text-amber-700 border-amber-200'
    case 'testing':
      return isDark
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'security':
      return isDark
        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
        : 'bg-rose-100 text-rose-700 border-rose-200'
    default:
      return isDark
        ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
        : 'bg-zinc-100 text-zinc-700 border-zinc-200'
  }
}

export function SkillsLibrary({
  projectId,
  isDark = true,
  onBack,
  onSkillsChange,
}: SkillsLibraryProps) {
  const [skills, setSkills] = useState<SyraSlashSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<SkillResponsibility | 'all'>('all')
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)

  // Upload & Add modal state
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillResp, setNewSkillResp] = useState<SkillResponsibility>('building')
  const [newSkillDesc, setNewSkillDesc] = useState('')
  const [newSkillContent, setNewSkillContent] = useState('')
  const [savingSkill, setSavingSkill] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleDelete = async (skillId: string) => {
    if (!projectId || busyId) return
    setBusyId(skillId)
    setError(null)
    const result = await deleteProjectSkill(projectId, skillId)
    if (result.error) {
      setError(result.error)
    } else {
      setSkills(result.skills)
      onSkillsChange?.(result.skills)
    }
    setBusyId(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !projectId) return
    setUploading(true)
    setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const text = await file.text()
        if (!text.trim()) continue

        let name = file.name.replace(/\.[^/.]+$/, '')
        let responsibility: SkillResponsibility = 'general'
        let description = `Uploaded from ${file.name}`
        let content = text

        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text)
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (item?.name && item?.content) {
                    await uploadProjectSkill(projectId, {
                      name: String(item.name).trim(),
                      responsibility: item.responsibility || 'general',
                      description: item.description || '',
                      content: String(item.content).trim(),
                      active: item.active !== false,
                    })
                  }
                }
                continue
              } else {
                name = String(parsed.name || name).trim()
                responsibility = (parsed.responsibility || 'general').toLowerCase() as SkillResponsibility
                description = String(parsed.description || description).trim()
                content = String(parsed.content || text).trim()
              }
            }
          } catch {}
        } else {
          const titleMatch = text.match(/^#\s+(.+)$/m)
          if (titleMatch) name = titleMatch[1].trim()
          const lower = text.toLowerCase()
          if (
            lower.includes('designing') ||
            lower.includes('ui/ux') ||
            lower.includes('styling') ||
            lower.includes('tailwind')
          ) {
            responsibility = 'designing'
          } else if (
            lower.includes('integrat') ||
            lower.includes('api') ||
            lower.includes('webhook') ||
            lower.includes('route')
          ) {
            responsibility = 'integrating'
          } else if (
            lower.includes('testing') ||
            lower.includes('test') ||
            lower.includes('spec') ||
            lower.includes('jest') ||
            lower.includes('pytest')
          ) {
            responsibility = 'testing'
          } else if (
            lower.includes('security') ||
            lower.includes('auth') ||
            lower.includes('jwt') ||
            lower.includes('permission')
          ) {
            responsibility = 'security'
          } else if (
            lower.includes('build') ||
            lower.includes('scaffold') ||
            lower.includes('architecture')
          ) {
            responsibility = 'building'
          }
        }

        await uploadProjectSkill(projectId, {
          name,
          responsibility,
          description,
          content,
          active: true,
        })
      }
      const fresh = await fetchProjectSkills(projectId)
      setSkills(fresh.skills)
      onSkillsChange?.(fresh.skills)
    } catch (err: any) {
      setError(err?.message || 'Failed to upload skill file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveNewSkill = async () => {
    if (!projectId || !newSkillName.trim() || !newSkillContent.trim()) return
    setSavingSkill(true)
    setError(null)
    try {
      const res = await uploadProjectSkill(projectId, {
        name: newSkillName.trim(),
        responsibility: newSkillResp,
        description: newSkillDesc.trim(),
        content: newSkillContent.trim(),
        active: true,
      })
      if (res.ok) {
        setSkills(res.skills)
        onSkillsChange?.(res.skills)
        setShowAddForm(false)
        setNewSkillName('')
        setNewSkillDesc('')
        setNewSkillContent('')
      } else {
        setError(res.error || 'Failed to create skill.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create skill.')
    } finally {
      setSavingSkill(false)
    }
  }

  const filteredSkills = skills.filter((s) => {
    if (activeFilter === 'all') return true
    return (s.responsibility || 'general').toLowerCase() === activeFilter
  })

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
          <h1 className="text-[15px] font-semibold tracking-tight">Skills by Responsibility</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Uploaded skills followed by AI during design, build, &amp; integration
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.json,.txt"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!projectId || uploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'h-8 gap-1.5 rounded-xl border px-2.5 text-[12px] font-medium shadow-none transition-colors',
              isDark
                ? 'border-[#2a2b2e] bg-[#1c1d1f] text-[#c0c1c4] hover:bg-[#252629] hover:text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
            )}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span>Upload</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!projectId}
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-8 gap-1.5 rounded-xl bg-purple-600 px-2.5 text-[12px] font-medium text-white hover:bg-purple-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </Button>
        </div>
      </header>

      {/* Responsibility filter rail */}
      <div
        className={cn(
          'flex gap-1.5 overflow-x-auto border-b px-4 py-2 text-xs scrollbar-none',
          isDark ? 'border-[#2a2b2e] bg-[#141517]' : 'border-gray-100 bg-gray-50',
        )}
      >
        {RESPONSIBILITIES.map((r) => {
          const count =
            r.id === 'all'
              ? skills.length
              : skills.filter((s) => (s.responsibility || 'general').toLowerCase() === r.id).length
          const isSelected = activeFilter === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveFilter(r.id)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors',
                isSelected
                  ? isDark
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40'
                    : 'bg-purple-100 text-purple-800 ring-1 ring-purple-300'
                  : isDark
                    ? 'text-[#8b8c90] hover:bg-[#202124] hover:text-white'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
              )}
            >
              <span>{r.icon}</span>
              <span>{r.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px]',
                  isSelected
                    ? isDark
                      ? 'bg-purple-500/30 text-purple-200'
                      : 'bg-purple-200 text-purple-900'
                    : isDark
                      ? 'bg-[#26272b] text-[#707175]'
                      : 'bg-gray-200 text-gray-500',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Inline Create Skill Form */}
      {showAddForm && (
        <div
          className={cn(
            'border-b p-4 animate-in fade-in slide-in-from-top-2 duration-200',
            isDark ? 'border-[#2a2b2e] bg-[#1a1b1e]' : 'border-gray-200 bg-purple-50/40',
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Add Custom Skill
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={cn('rounded p-1 text-xs', isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-black')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                placeholder="Skill name (e.g. Clean UI Design, Auth Integration)"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className={cn(
                  'h-8 text-xs',
                  isDark ? 'border-[#2a2b2e] bg-[#141517] text-white' : 'border-gray-300 bg-white text-gray-900',
                )}
              />
              <select
                value={newSkillResp}
                onChange={(e) => setNewSkillResp(e.target.value as SkillResponsibility)}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-xs outline-none',
                  isDark
                    ? 'border-[#2a2b2e] bg-[#141517] text-white'
                    : 'border-gray-300 bg-white text-gray-900',
                )}
              >
                <option value="designing">🎨 Designing</option>
                <option value="integrating">🔌 Integrating</option>
                <option value="building">🏗️ Building</option>
                <option value="testing">🧪 Testing</option>
                <option value="security">🔒 Security</option>
                <option value="general">📋 General</option>
              </select>
            </div>
            <Input
              placeholder="Short description (optional)"
              value={newSkillDesc}
              onChange={(e) => setNewSkillDesc(e.target.value)}
              className={cn(
                'h-8 text-xs',
                isDark ? 'border-[#2a2b2e] bg-[#141517] text-white' : 'border-gray-300 bg-white text-gray-900',
              )}
            />
            <textarea
              rows={4}
              placeholder="Skill instructions and rules for the AI (e.g., Always use Tailwind v4 CSS variables, strict TypeScript types, handle edge cases, etc.)..."
              value={newSkillContent}
              onChange={(e) => setNewSkillContent(e.target.value)}
              className={cn(
                'w-full rounded-md border p-2 text-xs font-mono outline-none',
                isDark
                  ? 'border-[#2a2b2e] bg-[#141517] text-zinc-200 placeholder:text-zinc-600'
                  : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingSkill || !newSkillName.trim() || !newSkillContent.trim()}
                onClick={handleSaveNewSkill}
                className="h-7 gap-1.5 bg-purple-600 text-xs text-white hover:bg-purple-700"
              >
                {savingSkill && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Save Skill</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main skills listing */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!projectId && (
          <p className={cn('text-[13px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Open a project chat to manage Syte skills.
          </p>
        )}
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading project skills...
          </div>
        )}

        {!loading && skills.length === 0 && (
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 px-6 text-center',
              isDark ? 'border-[#2a2b2e] bg-[#141517]/50' : 'border-gray-200 bg-gray-50',
            )}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">Fresh Skills Workspace</h3>
            <p className={cn('mt-1 max-w-sm text-xs leading-relaxed', isDark ? 'text-zinc-400' : 'text-gray-500')}>
              No skills uploaded yet. Upload your custom guidelines or markdown instructions (.md, .json)
              for designing, integrating, building, and testing.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'h-8 gap-1.5 text-xs',
                  isDark ? 'border-[#2a2b2e] bg-[#1c1d1f] hover:bg-[#252629]' : 'border-gray-200 bg-white hover:bg-gray-100',
                )}
              >
                <Upload className="h-3.5 w-3.5 text-purple-400" />
                <span>Upload Skill File</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="h-8 gap-1.5 bg-purple-600 text-xs text-white hover:bg-purple-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Skill</span>
              </Button>
            </div>
          </div>
        )}

        {!loading && skills.length > 0 && filteredSkills.length === 0 && (
          <p className={cn('py-8 text-center text-xs', isDark ? 'text-zinc-500' : 'text-gray-400')}>
            No skills found in the &ldquo;{activeFilter}&rdquo; category.
          </p>
        )}

        {!loading && filteredSkills.length > 0 && (
          <ul className="space-y-2">
            {filteredSkills.map((skill) => {
              const busy = busyId === skill.id
              const resp = (skill.responsibility || 'general').toLowerCase()
              const isExpanded = expandedSkillId === skill.id
              return (
                <li
                  key={skill.id}
                  className={cn(
                    'rounded-2xl border transition-colors overflow-hidden',
                    isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-gray-50',
                  )}
                >
                  <div className="flex items-start gap-3 p-3.5">
                    {/* Active toggle button */}
                    <button
                      type="button"
                      disabled={!projectId || busy}
                      onClick={() => void handleToggle(skill)}
                      aria-label={skill.active ? 'Disable skill' : 'Enable skill'}
                      className={cn(
                        'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                        skill.active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isDark
                            ? 'bg-[#2a2b2e] text-[#9a9b9e] hover:text-white'
                            : 'bg-gray-200 text-gray-500 hover:text-gray-900',
                        busy && 'opacity-50',
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : skill.active ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </button>

                    {/* Skill Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14px] font-medium tracking-tight">{skill.name}</span>
                        <span
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            responsibilityBadgeClass(resp, isDark),
                          )}
                        >
                          {resp}
                        </span>
                        {skill.active && (
                          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className={cn('mt-1 text-[12px] leading-snug', isDark ? 'text-[#8b8c90]' : 'text-gray-500')}>
                          {skill.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons: Expand & Delete */}
                    <div className="flex items-center gap-1">
                      {skill.content && (
                        <button
                          type="button"
                          onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                          className={cn(
                            'rounded-lg p-1.5 text-xs transition-colors',
                            isDark ? 'text-zinc-400 hover:bg-[#252629] hover:text-white' : 'text-gray-500 hover:bg-gray-200',
                          )}
                          aria-label={isExpanded ? 'Collapse instructions' : 'View instructions'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(skill.id)}
                        className={cn(
                          'rounded-lg p-1.5 text-xs text-rose-400/80 transition-colors hover:bg-rose-500/10 hover:text-rose-400',
                          busy && 'opacity-50',
                        )}
                        aria-label="Delete skill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded instructions */}
                  {isExpanded && skill.content && (
                    <div
                      className={cn(
                        'border-t px-3.5 py-2.5 text-xs font-mono leading-relaxed',
                        isDark ? 'border-[#26272b] bg-[#141517] text-zinc-300' : 'border-gray-200 bg-white text-gray-800',
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-purple-400">
                        <FileCode className="h-3.5 w-3.5" />
                        <span>Skill Instructions</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">
                        {skill.content}
                      </pre>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
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
  return window.open(
    url,
    'sycord-mcp-oauth',
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
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; ok?: boolean; addon?: string; error?: string; connectError?: string } | null
      if (!data || data.type !== 'sycord-mcp-oauth') return
      if (!data.ok) {
        setError(data.connectError || data.error || 'OAuth connection failed')
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
      // Keep busy until postMessage / timeout
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer)
          setBusyId(null)
          void refresh()
        }
      }, 700)
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
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          addon: apiKeyAddon.id,
          credentials: Object.fromEntries(keys.map((key) => [key, apiKeyValues[key].trim()])),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || 'Failed to connect MCP')
      setAddons((current) => {
        const next = mergeMcpCatalog(current.map((item) =>
          item.id === apiKeyAddon.id ? { ...item, connected: true, status: 'connected' } : item,
        ))
        onMcpChange?.(next)
        return next
      })
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
          <h1 className="text-[15px] font-semibold tracking-tight">Integrations</h1>
          <p className={cn('text-[12px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Connect with real OAuth or API keys
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!projectId && (
          <p className={cn('text-[13px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
            Open a project chat to manage integrations.
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
                  Enter API credentials to authorize this integration
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
            integrations, help, and credits.
          </p>
        </div>
      </div>
    </div>
  )
}
