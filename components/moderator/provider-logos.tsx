"use client"

import React from "react"
import { Cpu } from "lucide-react"

interface ProviderLogoProps {
  provider: string
  className?: string
  size?: number
}

export function ProviderLogo({ provider, className = "w-4 h-4", size = 16 }: ProviderLogoProps) {
  const p = (provider || "").toLowerCase().trim()

  // 1. Vercel brand mark
  if (p.includes("vercel")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d="M12 1L24 22H0L12 1Z" />
      </svg>
    )
  }

  // 2. Google / Vertex AI brand mark
  if (p.includes("google") || p.includes("vertex") || p.includes("gemini")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
      >
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.27A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.98 11.98 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
        />
      </svg>
    )
  }

  // 3. OpenAI brand mark
  if (p.includes("openai") || p.includes("chatgpt")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d="M22.28 9.37a5.99 5.99 0 0 0-.52-4.91 6.08 6.08 0 0 0-6.6-2.9 6.03 6.03 0 0 0-4.66-2.07c-3.15 0-5.77 2.4-6.03 5.48a6.03 6.03 0 0 0-4.06 2.94 6.07 6.07 0 0 0 .73 7.18 5.99 5.99 0 0 0 .52 4.91 6.08 6.08 0 0 0 6.6 2.9 6.04 6.04 0 0 0 4.66 2.07c3.15 0 5.77-2.4 6.03-5.48a6.03 6.03 0 0 0 4.06-2.94 6.07 6.07 0 0 0-.73-7.18zm-8.86 12.35a4.47 4.47 0 0 1-2.95-.79l.15-.09 4.88-2.82a.8.8 0 0 0 .4-.69v-6.9l2.07 1.2v5.7a4.5 4.5 0 0 1-4.55 3.69zm-8.87-4.14a4.47 4.47 0 0 1-.54-3.03l.15.09 4.88 2.82a.8.8 0 0 0 .8 0l5.98-3.45v2.39l-4.94 2.85a4.5 4.5 0 0 1-6.33-1.67zm-1.84-8.86a4.47 4.47 0 0 1 2.4-2.25v.18l4.88 2.82a.8.8 0 0 0 .8 0l5.98-3.45-2.07-1.2-4.94 2.85a4.5 4.5 0 0 1-7.05 1.05zm16.5 3.37l-4.88-2.82a.8.8 0 0 0-.8 0l-5.98 3.45v-2.39l4.94-2.85a4.5 4.5 0 0 1 6.72 4.61zm2.38 5.49a4.47 4.47 0 0 1-2.4 2.25v-.18l-4.88-2.82a.8.8 0 0 0-.8 0l-5.98 3.45 2.07 1.2 4.94-2.85a4.5 4.5 0 0 1 7.05-1.05z" />
      </svg>
    )
  }

  // 4. Anthropic brand mark
  if (p.includes("anthropic") || p.includes("claude")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d="M13.827 3.513h3.585L24 20.487h-3.645l-1.579-3.793h-5.698l-1.58 3.793H7.854L13.827 3.513zm1.884 9.948l-1.92-4.616-1.92 4.616h3.84zM0 20.487L5.973 3.513h3.645L3.645 20.487H0z" />
      </svg>
    )
  }

  // 5. DeepSeek brand mark
  if (p.includes("deepseek")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z" />
      </svg>
    )
  }

  // 6. Vyce AI mark
  if (p.includes("vyce")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d="M12 2L1 21h22L12 2zm0 4.2L19.4 19H4.6L12 6.2z" />
      </svg>
    )
  }

  // Neutral Fallback
  return <Cpu className={className} />
}
