'use client'

import { useMemo, useState } from 'react'

import { EditMessage } from '@/components/elements/edit-message'
import { FeedbackDialog } from '@/components/elements/feedback-dialog'
import { MessageActions, type Reaction } from '@/components/elements/message-actions'
import { MessageBranches } from '@/components/elements/message-branches'
import { MessagePair } from '@/components/elements/message-pair'
import { cn } from '@/lib/utils'

interface AssistantMessageElementsProps {
  role: 'user' | 'assistant'
  text: string
  discardedReplies?: number
  variants?: string[]
  onEdit?: (value: string) => void
  onRegenerate?: () => void
  className?: string
}

const FEEDBACK_REASONS = [
  'Incorrect',
  'Incomplete',
  'Unsafe',
  'Not relevant',
]

export function AssistantMessageElements({
  role,
  text,
  discardedReplies = 0,
  variants = [],
  onEdit,
  onRegenerate,
  className,
}: AssistantMessageElementsProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [copied, setCopied] = useState(false)
  const [reaction, setReaction] = useState<Reaction>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [branchIndex, setBranchIndex] = useState(0)

  const normalizedVariants = useMemo(() => variants.length > 0 ? variants : [text], [text, variants])

  if (!text.trim()) return null

  if (role === 'user') {
    if (!editing) {
      return (
        <MessagePair
          userMessage={text}
          words={[]}
          visibleWords={0}
          streaming={false}
          showAssistant={false}
          onUserClick={() => {
            setDraft(text)
            setEditing(true)
          }}
          className={cn('ml-auto max-w-[85%]', className)}
        />
      )
    }

    return (
      <EditMessage
        value={draft}
        discardedReplies={discardedReplies}
        editing
        onValueChange={setDraft}
        onCancel={() => {
          setDraft(text)
          setEditing(false)
        }}
        onSave={() => {
          const next = draft.trim()
          if (next && next !== text) onEdit?.(next)
          setEditing(false)
        }}
        className={cn('ml-auto max-w-[85%]', className)}
      />
    )
  }

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cn('group/message-elements mt-2 flex max-w-full flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <MessageActions
          copied={copied}
          reaction={reaction}
          regenerating={false}
          onCopy={() => void copyResponse()}
          onReactionChange={(next) => {
            setReaction(next)
            if (next === 'down') setShowFeedback(true)
          }}
          onRegenerate={onRegenerate || (() => undefined)}
          onMore={() => setShowFeedback((current) => !current)}
        />
        <MessageBranches
          variants={normalizedVariants}
          index={branchIndex}
          onIndexChange={setBranchIndex}
          className="[&>p]:sr-only"
        />
      </div>


      {showFeedback && (
        <FeedbackDialog
          reasons={FEEDBACK_REASONS}
          selected={selectedReasons}
          note={note}
          sent={feedbackSent}
          onToggleReason={(reason) => setSelectedReasons((current) => current.includes(reason)
            ? current.filter((item) => item !== reason)
            : [...current, reason])}
          onNoteChange={setNote}
          onSubmit={() => setFeedbackSent(true)}
        />
      )}
    </div>
  )
}
