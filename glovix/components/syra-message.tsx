'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SyraMessage } from '../../types/syra'

interface SyraMessageBubbleProps {
  message: SyraMessage
  isDark?: boolean
  markdownComponents?: Record<string, unknown>
  showCursor?: boolean
}

export const SyraMessageBubble = memo(function SyraMessageBubble({
  message,
  isDark = true,
  markdownComponents,
  showCursor = false,
}: SyraMessageBubbleProps) {
  if (!message.content && !showCursor) return null

  const prose = `prose prose-sm max-w-none w-full break-words overflow-hidden ${
    isDark
      ? 'prose-invert prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-[#2a2a2a] prose-pre:rounded-lg'
      : 'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg'
  }`

  return (
    <div className={prose}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as any}>
        {message.content.replace(/^\[SYSTEM\] .*/gm, '')}
      </ReactMarkdown>
      {showCursor && (
        <span className={`inline-block w-[0.55em] h-[1em] align-[-0.1em] ml-0.5 animate-pulse ${isDark ? 'bg-[#e5e5e5]' : 'bg-gray-900'}`} />
      )}
    </div>
  )
})
