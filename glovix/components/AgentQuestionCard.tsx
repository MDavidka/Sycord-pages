'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { AgentQuestion, AgentQuestionOption } from '../lib/project-agent'

export type AgentQuestionAnswerValue = string | number | string[]

type AgentQuestionCardProps = {
  question: AgentQuestion
  isDark?: boolean
  submitting?: boolean
  error?: string | null
  onSubmit: (answer: AgentQuestionAnswerValue) => void
  onDismiss?: () => void
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function sliderBounds(question: AgentQuestion): { min: number; max: number; step: number } {
  const min = Number.isFinite(question.min) ? Number(question.min) : 0
  const max = Number.isFinite(question.max) ? Number(question.max) : Math.max(min + 9, 9)
  const step = Number.isFinite(question.step) && Number(question.step) > 0 ? Number(question.step) : 1
  return { min, max: max >= min ? max : min + step, step }
}

function defaultSliderValue(question: AgentQuestion, min: number, max: number): number {
  if (typeof question.defaultValue === 'number' && Number.isFinite(question.defaultValue)) {
    return clamp(question.defaultValue, min, max)
  }
  if (typeof question.defaultValue === 'string' && question.defaultValue.trim()) {
    const n = Number(question.defaultValue)
    if (Number.isFinite(n)) return clamp(n, min, max)
  }
  return min
}

function optionList(question: AgentQuestion): AgentQuestionOption[] {
  return question.options?.length ? question.options : []
}

export function AgentQuestionCard({
  question,
  isDark = true,
  submitting = false,
  error = null,
  onSubmit,
}: AgentQuestionCardProps) {
  const { min, max, step } = useMemo(() => sliderBounds(question), [question])
  const options = useMemo(() => optionList(question), [question])

  const [inputValue, setInputValue] = useState(() =>
    typeof question.defaultValue === 'string' ? question.defaultValue : '',
  )
  const [sliderValue, setSliderValue] = useState(() => defaultSliderValue(question, min, max))
  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof question.defaultValue === 'string') return question.defaultValue
    return null
  })
  const [multiSelected, setMultiSelected] = useState<string[]>(() =>
    Array.isArray(question.defaultValue) ? question.defaultValue.map(String) : [],
  )

  useEffect(() => {
    setInputValue(typeof question.defaultValue === 'string' ? question.defaultValue : '')
    setSliderValue(defaultSliderValue(question, min, max))
    setSelected(typeof question.defaultValue === 'string' ? question.defaultValue : null)
    setMultiSelected(Array.isArray(question.defaultValue) ? question.defaultValue.map(String) : [])
  }, [question.id, question.defaultValue, min, max, question])

  const cardClass = isDark
    ? 'bg-[#1c1d1f] border-[#2a2b2e] text-white'
    : 'bg-white border-gray-200 text-gray-900 shadow-sm'
  const muted = isDark ? 'text-[#9a9b9e]' : 'text-gray-500'
  const inset = isDark
    ? 'bg-[#141516] border-[#2a2b2e] text-white placeholder:text-[#6b6c6f]'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
  const optionIdle = isDark
    ? 'bg-[#2a2b2e]/70 text-[#e5e5e5] hover:bg-[#343538]'
    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  const optionActive = isDark
    ? 'bg-[#4A90E2] text-white'
    : 'bg-blue-500 text-white'

  const submitDisabled = submitting

  const handleChoice = (value: string) => {
    if (submitDisabled) return
    setSelected(value)
    onSubmit(value)
  }

  const toggleMulti = (value: string) => {
    if (submitDisabled) return
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  const confirmButton = (enabled: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      disabled={!enabled || submitDisabled}
      onClick={onClick}
      className={`mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        isDark
          ? 'bg-white text-black hover:bg-gray-200'
          : 'bg-gray-900 text-white hover:bg-gray-800'
      }`}
    >
      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      {label}
    </button>
  )

  return (
    <div
      className={`animate-fade-in-up w-full rounded-[22px] border px-4 py-4 ${cardClass}`}
      role="group"
      aria-label={question.prompt}
    >
      <p className="text-[15px] font-semibold leading-snug tracking-tight">{question.prompt}</p>

      {question.questionType === 'answer' && (
        <div className="mt-3">
          {confirmButton(true, 'Continue', () => onSubmit('ok'))}
        </div>
      )}

      {question.questionType === 'input' && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={inputValue}
            disabled={submitDisabled}
            placeholder={question.placeholder || 'Type your answer…'}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim() && !submitDisabled) {
                e.preventDefault()
                onSubmit(inputValue.trim())
              }
            }}
            className={`h-11 w-full rounded-[10px] border px-3 text-[14px] outline-none focus:border-[#4A90E2]/60 ${inset}`}
          />
          {confirmButton(Boolean(inputValue.trim()), 'Submit', () => onSubmit(inputValue.trim()))}
        </div>
      )}

      {question.questionType === 'slider' && (
        <div className="mt-4">
          <div className={`mb-2 flex items-center justify-between text-[12px] tabular-nums ${muted}`}>
            <span>{min}</span>
            <span className={isDark ? 'text-white font-medium' : 'text-gray-900 font-medium'}>
              {sliderValue}
            </span>
            <span>{max}</span>
          </div>
          <div className="relative px-0.5">
            {/* Tick marks */}
            <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 flex justify-between">
              {Array.from({ length: Math.min(10, Math.floor((max - min) / step) + 1) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-px ${isDark ? 'bg-white/15' : 'bg-black/15'}`}
                />
              ))}
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={sliderValue}
              disabled={submitDisabled}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="agent-question-slider relative z-10 w-full"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={sliderValue}
            />
          </div>
          {confirmButton(true, 'Confirm', () => onSubmit(sliderValue))}
        </div>
      )}

      {(question.questionType === 'choice' || question.questionType === 'multi_choice') && (
        <div className="mt-3">
          {options.length === 0 ? (
            <p className={`text-[13px] ${muted}`}>No options provided.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const isMulti = question.questionType === 'multi_choice'
                const active = isMulti ? multiSelected.includes(opt.value) : selected === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={submitDisabled}
                    onClick={() => (isMulti ? toggleMulti(opt.value) : handleChoice(opt.value))}
                    className={`min-h-[44px] min-w-[44px] max-w-full rounded-[14px] px-3.5 py-2.5 text-left text-[13px] font-medium leading-snug transition-all active:scale-[0.97] disabled:opacity-50 ${
                      active ? optionActive : optionIdle
                    }`}
                  >
                    <span className="line-clamp-3 break-words">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}
          {question.questionType === 'multi_choice' &&
            confirmButton(multiSelected.length > 0, 'Confirm', () => onSubmit(multiSelected))}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12px] text-red-400" role="alert">
          {error}
        </p>
      )}

      <style>{`
        .agent-question-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 28px;
          background: transparent;
          cursor: pointer;
        }
        .agent-question-slider:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .agent-question-slider::-webkit-slider-runnable-track {
          height: 10px;
          border-radius: 999px;
          background: ${isDark ? '#2a2b2e' : '#e5e7eb'};
        }
        .agent-question-slider::-moz-range-track {
          height: 10px;
          border-radius: 999px;
          background: ${isDark ? '#2a2b2e' : '#e5e7eb'};
        }
        .agent-question-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          margin-top: -7px;
          width: 36px;
          height: 24px;
          border-radius: 999px;
          border: none;
          background: #4A90E2;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
        .agent-question-slider::-moz-range-thumb {
          width: 36px;
          height: 24px;
          border-radius: 999px;
          border: none;
          background: #4A90E2;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
      `}</style>
    </div>
  )
}

export async function answerProjectAgentQuestion(
  projectId: string,
  questionId: string,
  answer: AgentQuestionAnswerValue,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/agent/questions/${encodeURIComponent(questionId)}/answer`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ answer }),
      },
    )
    const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
    if (!res.ok) {
      return { ok: false, message: body?.message || body?.error || `Failed to answer (HTTP ${res.status}).` }
    }
    return { ok: true }
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Network error answering question.' }
  }
}
