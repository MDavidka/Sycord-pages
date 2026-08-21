'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  FileCode,
  FileUp,
  HelpCircle,
  Image as ImageIcon,
  Puzzle,
  Sparkles,
  X,
} from 'lucide-react'

import {
  applyMention,
  Composer,
  ComposerActions,
  ComposerAttachmentChip,
  ComposerAttachments,
  ComposerAttachButton,
  ComposerBar,
  ComposerCommandItem,
  ComposerInput,
  ComposerMenu,
  ComposerMenuItem,
  ComposerModelItem,
  ComposerModelTrigger,
  ComposerPersonItem,
  ComposerSend,
  ComposerToolbar,
  ComposerVoiceButton,
  type ComposerAttachment,
  type ComposerCommand,
  type ComposerPerson,
  useMentionMatches,
  useSlashMatches,
} from '@/components/elements/composer'
import { cn } from '@/lib/utils'

import type { ModelChoice, ModelType } from '../lib/ai'
import { ModelProviderIcon } from './ModelProviderIcon'

interface SelectedContext {
  label: string
  text?: string
}

interface AgentComposerProps {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isRunning: boolean
  isListening: boolean
  onToggleVoice: () => void
  isDark: boolean
  disabled?: boolean
  selectedImages: string[]
  selectedDocuments: Array<{ name: string; size: number }>
  onRemoveImage: (index: number) => void
  onRemoveDocument: (index: number) => void
  onPickImage: () => void
  onPickDocument: () => void
  selectedContext?: SelectedContext | null
  onClearSelectedContext: () => void
  models: ModelChoice[]
  selectedModel: ModelType
  modelsLoading: boolean
  modelsError: string | null
  onRetryModels: () => void
  onSelectModel: (model: ModelChoice) => void
  connectedIntegrationCount: number
  onOpenIntegrations: () => void
  onOpenSkills: () => void
  onOpenHelp: () => void
  onOpenCredits: () => void
  draftKey: string
}

const MENTION_PEOPLE: ComposerPerson[] = [
  { name: 'syra', role: 'agent' },
  { name: 'review', role: 'agent' },
  { name: 'deploy', role: 'agent' },
]

export function AgentComposer({
  value,
  onValueChange,
  onSend,
  onStop,
  isRunning,
  isListening,
  onToggleVoice,
  isDark,
  disabled = false,
  selectedImages,
  selectedDocuments,
  onRemoveImage,
  onRemoveDocument,
  onPickImage,
  onPickDocument,
  selectedContext,
  onClearSelectedContext,
  models,
  selectedModel,
  modelsLoading,
  modelsError,
  onRetryModels,
  onSelectModel,
  connectedIntegrationCount,
  onOpenIntegrations,
  onOpenSkills,
  onOpenHelp,
  onOpenCredits,
  draftKey,
}: AgentComposerProps) {
  const [menu, setMenu] = useState<'attachments' | 'commands' | 'models' | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedDraft = window.sessionStorage.getItem(`syra-composer-draft:${draftKey}`)
    if (savedDraft && !value) {
      onValueChange(savedDraft)
      setDraftRestored(true)
      return
    }
    setDraftRestored(false)
    // Restore only when switching threads; the input remains otherwise controlled by the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `syra-composer-draft:${draftKey}`
    if (value.trim()) {
      window.sessionStorage.setItem(storageKey, value)
    } else {
      window.sessionStorage.removeItem(storageKey)
    }
  }, [draftKey, value])
  const commands = useMemo<ComposerCommand[]>(() => [
    { name: 'image', description: 'Attach an image', icon: ImageIcon },
    { name: 'file', description: 'Attach a file', icon: FileUp },
    { name: 'skills', description: 'Browse available skills', icon: Sparkles },
    { name: 'integrations', description: 'Manage connected integrations', icon: Puzzle },
    { name: 'help', description: 'Open help and support', icon: HelpCircle },
    { name: 'credits', description: 'View credit information', icon: CreditCard },
  ], [])
  const slashMatches = useSlashMatches(value, commands)
  const mentionMatches = useMentionMatches(value, MENTION_PEOPLE)
  const attachmentEntries = useMemo<ComposerAttachment[]>(() => [
    ...selectedImages.map((_, index) => ({
      name: `Image ${index + 1}`,
      meta: 'Ready to send',
      state: 'done' as const,
      kind: 'image' as const,
    })),
    ...selectedDocuments.map((document) => ({
      name: document.name,
      meta: document.size > 0 ? `${Math.max(1, Math.ceil(document.size / 1024))} KB` : 'Ready to send',
      state: 'done' as const,
      kind: 'text' as const,
    })),
  ], [selectedDocuments, selectedImages])

  const commandMenuOpen = menu === 'commands' || slashMatches.length > 0 || mentionMatches.length > 0
  const selectedModelEntry = models.find((entry) => entry.modelType === selectedModel)
  const modelLabel = modelsLoading
    ? 'Loading models…'
    : modelsError
      ? 'Models unavailable'
      : selectedModelEntry?.apiModel || 'Select model'
  const canSend = !disabled && (value.trim().length > 0 || attachmentEntries.length > 0)

  const closeMenu = () => setMenu(null)
  const runCommand = (command: string) => {
    closeMenu()
    if (value.startsWith('/')) onValueChange('')
    switch (command) {
      case 'image':
        onPickImage()
        break
      case 'file':
        onPickDocument()
        break
      case 'skills':
        onOpenSkills()
        break
      case 'integrations':
        onOpenIntegrations()
        break
      case 'help':
        onOpenHelp()
        break
      case 'credits':
        onOpenCredits()
        break
    }
  }

  const elementChrome = isDark
    ? 'border-[#2a2b2e] bg-[#1c1d1f] text-[#e5e5e5] shadow-black/20'
    : 'border-gray-200 bg-white text-gray-900 shadow-black/5'
  const subdued = isDark ? 'text-[#9a9b9e]' : 'text-gray-500'

  return (
    <Composer className="max-w-none">
      <ComposerMenu
        open={menu === 'attachments'}
        className={isDark ? 'border-[#2a2b2e] bg-[#202124] text-[#e5e5e5]' : undefined}
      >
        <ComposerMenuItem onClick={() => runCommand('image')}>
          <ImageIcon className="size-4 opacity-60" />
          <span className="flex-1 text-left">Image upload</span>
          <span className={cn('text-[11px]', subdued)}>/image</span>
        </ComposerMenuItem>
        <ComposerMenuItem onClick={() => runCommand('file')}>
          <FileUp className="size-4 opacity-60" />
          <span className="flex-1 text-left">File upload</span>
          <span className={cn('text-[11px]', subdued)}>/file</span>
        </ComposerMenuItem>
      </ComposerMenu>

      <ComposerMenu
        open={commandMenuOpen}
        className={isDark ? 'border-[#2a2b2e] bg-[#202124] text-[#e5e5e5]' : undefined}
      >
        {mentionMatches.length > 0 ? (
          mentionMatches.map((person, index) => (
            <ComposerPersonItem
              key={person.name}
              person={person}
              active={index === 0}
              onClick={() => {
                onValueChange(applyMention(value, person.name))
                closeMenu()
              }}
            />
          ))
        ) : (
          (slashMatches.length > 0 ? slashMatches : commands).map((command, index) => (
            <ComposerCommandItem
              key={command.name}
              command={command}
              active={index === 0}
              onClick={() => runCommand(command.name)}
            />
          ))
        )}
      </ComposerMenu>

      <ComposerMenu
        open={menu === 'models'}
        align="end"
        className={isDark ? 'border-[#2a2b2e] bg-[#202124] text-[#e5e5e5]' : undefined}
      >
        {modelsLoading ? (
          <div className={cn('px-2.5 py-2 text-[13px]', subdued)}>Loading models…</div>
        ) : modelsError ? (
          <ComposerMenuItem onClick={onRetryModels}>
            <span className="flex-1 text-left">{modelsError}</span>
            <span className="text-xs font-medium">Retry</span>
          </ComposerMenuItem>
        ) : models.length > 0 ? (
          models.map((model) => (
            <ComposerModelItem
              key={model.id}
              entry={{
                name: model.apiModel,
                meta: model.subtitle || model.modelType,
                icon: <ModelProviderIcon model={`${model.apiModel} ${model.modelType} ${model.label || ''}`} isDark={isDark} />,
              }}
              selected={model.modelType === selectedModel}
              onClick={() => {
                onSelectModel(model)
                closeMenu()
              }}
            />
          ))
        ) : (
          <div className={cn('px-2.5 py-2 text-[13px]', subdued)}>No models are currently available.</div>
        )}
      </ComposerMenu>

      <ComposerBar
        dragActive={false}
        className={cn('gap-2 rounded-[24px] border p-2.5 shadow-lg', elementChrome)}
      >
        {attachmentEntries.length > 0 && (
          <ComposerAttachments>
            {attachmentEntries.map((attachment, index) => {
              const isImage = index < selectedImages.length
              return (
                <ComposerAttachmentChip
                  key={`${attachment.name}-${index}`}
                  attachment={attachment}
                  onRemove={() => isImage ? onRemoveImage(index) : onRemoveDocument(index - selectedImages.length)}
                  className={isDark ? 'bg-white/[0.055]' : undefined}
                />
              )
            })}
          </ComposerAttachments>
        )}

        {selectedContext && (
          <div className={cn(
            'flex items-center gap-2 rounded-[14px] px-2.5 py-1.5 text-xs',
            isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700',
          )}>
            <FileCode className="size-3.5 shrink-0" />
            <span className="font-medium">{selectedContext.label}</span>
            {selectedContext.text ? <span className="truncate opacity-75">{selectedContext.text}</span> : null}
            <button
              type="button"
              aria-label="Remove selected context"
              onClick={onClearSelectedContext}
              className="ml-auto rounded p-0.5 opacity-70 transition hover:bg-blue-500/15 hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <ComposerInput
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (canSend && !isRunning) onSend()
              return
            }
            if (event.key === 'Escape') closeMenu()
          }}
          placeholder="Ask Syra to build, debug, or ship. Use / for actions and @ for agent mentions."
          className={cn(
            'min-h-12 px-3 py-2 text-[15px]',
            isDark ? 'text-[#e5e5e5] placeholder:text-[#6b6c6f]' : 'text-gray-900 placeholder:text-gray-400',
          )}
        />

        <ComposerToolbar>
          <ComposerActions>
            <ComposerAttachButton onClick={() => setMenu(menu === 'attachments' ? null : 'attachments')} />
            <button
              type="button"
              aria-label="Slash commands"
              onClick={() => setMenu(menu === 'commands' ? null : 'commands')}
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-[14px] transition-colors',
                isDark ? 'text-white/55 hover:bg-white/[0.08] hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              /
            </button>
            <ComposerModelTrigger
              model={modelLabel}
              icon={<ModelProviderIcon model={`${selectedModelEntry?.apiModel || modelLabel} ${selectedModelEntry?.modelType || selectedModel}`} isDark={isDark} />}
              open={menu === 'models'}
              onClick={() => setMenu(menu === 'models' ? null : 'models')}
              className={isDark ? 'text-white/65 hover:bg-white/[0.08] hover:text-white' : undefined}
            />
          </ComposerActions>

          <ComposerActions>
            {connectedIntegrationCount > 0 && (
              <button
                type="button"
                onClick={onOpenIntegrations}
                className={cn(
                  'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex',
                  isDark ? 'bg-white/[0.055] text-white/65 hover:bg-white/[0.09]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                <Puzzle className="size-3" />
                {connectedIntegrationCount}
              </button>
            )}
            {draftRestored && !value ? (
              <span className={cn('hidden text-[11px] sm:inline', subdued)}>Draft restored</span>
            ) : null}
            <ComposerVoiceButton active={isListening} onClick={onToggleVoice} />
            <ComposerSend
              streaming={isRunning}
              idle={!canSend}
              disabled={disabled && !isRunning}
              onClick={isRunning ? onStop : onSend}
              className={isDark && !isRunning && !canSend ? 'bg-white/[0.09] text-white/35' : undefined}
            />
          </ComposerActions>
        </ComposerToolbar>
      </ComposerBar>
    </Composer>
  )
}
