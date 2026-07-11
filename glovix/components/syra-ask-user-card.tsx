'use client'

import { useState } from 'react'

interface SyraAskUserCardProps {
  question: string
  isDark?: boolean
  disabled?: boolean
  onSubmit: (answer: string) => void
}

export function SyraAskUserCard({ question, isDark = true, disabled, onSubmit }: SyraAskUserCardProps) {
  const [answer, setAnswer] = useState('')

  return (
    <div
      className={`my-3 rounded-2xl border p-4 ${
        isDark ? 'border-amber-500/25 bg-amber-500/10' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <p className={`text-[13px] font-medium mb-2 ${isDark ? 'text-amber-100' : 'text-amber-900'}`}>
        Syra needs your input
      </p>
      <p className={`text-[14px] mb-3 ${isDark ? 'text-[#e5e5e5]' : 'text-gray-800'}`}>{question}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={disabled}
          placeholder="Your answer…"
          className={`flex-1 rounded-lg border px-3 py-2 text-[14px] ${
            isDark
              ? 'border-[#2a2b2e] bg-[#1c1d1f] text-[#e5e5e5] placeholder:text-[#6b6c6f]'
              : 'border-gray-200 bg-white text-gray-900'
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim() && !disabled) {
              onSubmit(answer.trim())
              setAnswer('')
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || !answer.trim()}
          onClick={() => {
            onSubmit(answer.trim())
            setAnswer('')
          }}
          className={`rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-40 ${
            isDark ? 'bg-white text-[#18191B]' : 'bg-gray-900 text-white'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  )
}
