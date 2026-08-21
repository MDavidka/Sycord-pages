'use client'

import { cn } from '@/lib/utils'

type ProviderIcon = {
  light: string
  dark?: string
  label: string
}

const SVGL_PROVIDER_RULES: ReadonlyArray<{ pattern: RegExp; icon: ProviderIcon }> = [
  {
    pattern: /(?:gpt|\bo[1-4]\b|codex|openai)/i,
    icon: { light: '/model-icons/openai-light.svg', dark: '/model-icons/openai-dark.svg', label: 'OpenAI' },
  },
  {
    pattern: /(?:claude|anthropic)/i,
    icon: { light: '/model-icons/anthropic-light.svg', dark: '/model-icons/anthropic-dark.svg', label: 'Anthropic' },
  },
  {
    pattern: /(?:gemini|google|palm)/i,
    icon: { light: '/model-icons/gemini.svg', label: 'Google Gemini' },
  },
  {
    pattern: /(?:grok|xai)/i,
    icon: { light: '/model-icons/grok-light.svg', dark: '/model-icons/grok-dark.svg', label: 'xAI Grok' },
  },
  {
    pattern: /mistral|mixtral/i,
    icon: { light: '/model-icons/mistral.svg', label: 'Mistral AI' },
  },
  {
    pattern: /deepseek/i,
    icon: { light: '/model-icons/deepseek.svg', label: 'DeepSeek' },
  },
  {
    pattern: /(?:qwen|alibaba)/i,
    icon: { light: '/model-icons/qwen-light.svg', dark: '/model-icons/qwen-dark.svg', label: 'Qwen' },
  },
  {
    pattern: /perplexity/i,
    icon: { light: '/model-icons/perplexity.svg', label: 'Perplexity' },
  },
  {
    pattern: /cohere|command-r/i,
    icon: { light: '/model-icons/cohere.svg', label: 'Cohere' },
  },
]

function providerFor(model: string): ProviderIcon | null {
  return SVGL_PROVIDER_RULES.find((rule) => rule.pattern.test(model))?.icon || null
}

function GenericModelMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('size-4', className)}>
      <path d="M12 2.75 14.16 9.84 21.25 12l-7.09 2.16L12 21.25l-2.16-7.09L2.75 12l7.09-2.16L12 2.75Z" fill="currentColor" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" className="text-current/30" />
    </svg>
  )
}

export function ModelProviderIcon({
  model,
  isDark = false,
  className,
}: {
  model: string
  isDark?: boolean
  className?: string
}) {
  const provider = providerFor(model)
  if (!provider) {
    return (
      <span className={cn('inline-flex size-5 shrink-0 items-center justify-center text-foreground/75', className)} aria-label="AI model">
        <GenericModelMark />
      </span>
    )
  }

  const src = isDark && provider.dark ? provider.dark : provider.light
  return (
    <span className={cn('inline-flex size-5 shrink-0 items-center justify-center', className)} aria-label={provider.label}>
      <img src={src} alt="" draggable={false} className="size-full object-contain" />
    </span>
  )
}
