'use client'

// SyraAgentChat — the rebuilt Syra chat surface.
//
// This is a thin, resumable client over the Syte agent activity stream. It
// keeps the original composer UI (rounded card, textarea, model selector,
// send/stop) and the premade PlanChecklist, and renders the new activity feed
// (starting → thinking → tools/commands/files → reply) above it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, AudioLines, ChevronDown, Mic, Slash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyraAgent } from '../../lib/useSyraAgent'
import {
  DEFAULT_SYRA_PROFILE,
  SYRA_MODEL_CHOICES,
  type SyraModelProfile,
} from '../../lib/syra-model-profiles'
import type { GenerationPlan } from '../../lib/generation-plan'
import { PlanChecklist } from '../PlanChecklist'
import { SyraActivityFeed } from './SyraActivityFeed'

interface SyraAgentChatProps {
  projectId?: string
  uuid?: string
  isDark?: boolean
  /** Newly created project → fresh start, load no history. */
  freshStart?: boolean
}

function SyraModelSelector({
  selected,
  onSelect,
  isDark,
}: {
  selected: SyraModelProfile
  onSelect: (p: SyraModelProfile) => void
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = SYRA_MODEL_CHOICES.find((c) => c.id === selected) ?? SYRA_MODEL_CHOICES[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors active:scale-95',
          isDark
            ? 'border-[#3a3b3e] text-[#9a9b9e] hover:text-white hover:bg-white/5'
            : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50',
        )}
      >
        <span className="font-medium">{current.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute bottom-full left-0 z-20 mb-2 min-w-[190px] overflow-hidden rounded-xl',
              isDark ? 'border border-[#2a2b2e] bg-[#1c1d1f] shadow-xl' : 'border border-gray-200 bg-white shadow-lg',
            )}
          >
            <div className="p-1.5">
              {SYRA_MODEL_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    onSelect(choice.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left',
                    isDark ? 'hover:bg-[#26272a]' : 'hover:bg-gray-50',
                    choice.id === selected && (isDark ? 'bg-[#26272a]' : 'bg-gray-50'),
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn('text-[13px] font-medium', isDark ? 'text-[#e5e5e5]' : 'text-gray-900')}>
                      {choice.label}
                    </p>
                    <p className={cn('text-[11px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
                      {choice.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function SyraAgentChat({
  projectId: propProjectId,
  uuid,
  isDark = true,
  freshStart = false,
}: SyraAgentChatProps) {
  const projectId = useMemo(() => {
    if (propProjectId) return propProjectId
    if (typeof window !== 'undefined') return (window as any).__glovixProjectId || ''
    return ''
  }, [propProjectId])

  const { turns, isBusy, loadingHistory, error, submit, stop } = useSyraAgent({
    projectId,
    uuid,
    freshStart,
  })

  const [input, setInput] = useState('')
  const [profile, setProfile] = useState<SyraModelProfile>(DEFAULT_SYRA_PROFILE)
  // The premade plan UI is data-driven; the stream can populate this later.
  const [plan] = useState<GenerationPlan | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest activity as the turn streams in.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const text = input.trim()
      if (!text || isBusy) return
      void submit(text, profile)
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    [input, isBusy, submit, profile],
  )

  const hasTurns = turns.length > 0

  return (
    <div className={cn('flex h-full w-full flex-col', isDark ? 'bg-[#18191B]' : 'bg-white')}>
      {/* Feed / empty state */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {loadingHistory && !hasTurns ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center">
              <span
                className={cn(
                  'text-[14px] font-medium text-shimmer',
                  isDark ? 'text-shimmer-dark' : 'text-shimmer-light',
                )}
              >
                Restoring conversation
              </span>
            </div>
          ) : !hasTurns ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center">
              <h1 className={cn('text-[22px] font-semibold', isDark ? 'text-[#e5e5e5]' : 'text-gray-900')}>
                Syra
              </h1>
              <p className={cn('mt-1.5 text-[14px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
                Describe a change and Syra will plan, edit files, and run commands.
              </p>
            </div>
          ) : (
            <SyraActivityFeed turns={turns} isDark={isDark} />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer — same UI as the original Syra input */}
      <div className="w-full px-3 pb-4 pt-1">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
          {error && !isBusy && (
            <p className="mb-2 px-2 text-[12px] text-red-400">{error}</p>
          )}
          <div
            className={cn(
              'rounded-[28px] border px-2 pb-2 pt-1.5 transition-colors',
              isDark
                ? 'border-[#2a2b2e] bg-[#1c1d1f] focus-within:border-[#3a3b3e]'
                : 'border-gray-200 bg-white shadow-sm focus-within:border-gray-300',
            )}
          >
            <PlanChecklist plan={plan} isDark={isDark} embedded />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                const maxH = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 200
                t.style.height = `${Math.min(t.scrollHeight, maxH)}px`
              }}
              placeholder="Help you write code, debug and ship production-ready work."
              className={cn(
                'max-h-[120px] w-full resize-none overflow-y-auto bg-transparent px-3 pb-2 pt-2.5 text-[16px] leading-relaxed focus:outline-none md:max-h-[200px]',
                isDark ? 'text-[#e5e5e5] placeholder:text-[#6b6c6f]' : 'text-gray-900 placeholder:text-gray-400',
              )}
              style={{ height: 'auto', minHeight: plan ? '44px' : '76px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                aria-label="Attach"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors active:scale-95',
                  isDark
                    ? 'border-[#3a3b3e] text-[#9a9b9e] hover:bg-white/5 hover:text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <Slash className="h-3.5 w-3.5" />
              </button>

              <SyraModelSelector selected={profile} onSelect={setProfile} isDark={isDark} />

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Voice input"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors active:scale-95',
                    isDark ? 'text-[#9a9b9e] hover:bg-white/5 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Voice mode"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors active:scale-95',
                    isDark ? 'text-[#9a9b9e] hover:bg-white/5 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <AudioLines className="h-5 w-5" />
                </button>

                {isBusy ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-gray-200 active:scale-95"
                  >
                    <div className="h-3 w-3 rounded-sm bg-black" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className={cn(
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed',
                      input.trim()
                        ? 'bg-white text-black hover:bg-gray-200'
                        : isDark
                          ? 'bg-white/15 text-white/40'
                          : 'bg-gray-200 text-gray-400',
                    )}
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
