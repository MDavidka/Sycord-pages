import type { ModelType } from '@/glovix/lib/ai'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000'
const DEFAULT_INTERNAL_KEY = 'local-syra-continue'

export function resolveModelApiBase(): string {
  return (
    process.env.CONTINUE_MODEL_API_BASE?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
}

export function resolveContinueInternalKey(): string {
  return process.env.CONTINUE_INTERNAL_API_KEY?.trim() || DEFAULT_INTERNAL_KEY
}

export function toContinueProviderModel(model: ModelType): string {
  switch (model) {
    case 'deepseek-v4-flash':
      return 'deepseek-v4-flash'
    case 'deepseek-v4-pro':
      return 'deepseek-v4-pro'
    case 'gemini-3.1-pro':
      return 'gemini-2.5-pro'
    case 'mimo-v2-flash':
    default:
      return 'gemini-2.5-flash'
  }
}

export function buildContinueConfig(params: {
  model: ModelType
  apiBase?: string
  internalKey?: string
}): string {
  const apiBase = (params.apiBase || resolveModelApiBase()).replace(/\/+$/, '')
  const internalKey = params.internalKey || resolveContinueInternalKey()
  const model = toContinueProviderModel(params.model)

  return `name: Syra\nversion: 1.0.0\nschema: v1\n\nmodels:\n  - name: Syra Existing Backend\n    provider: openai\n    model: ${model}\n    apiBase: ${apiBase}/api/continue/v1\n    apiKey: dummy\n    capabilities:\n      - tool_use\n      - image_input\n    roles:\n      - chat\n      - edit\n      - apply\n    defaultCompletionOptions:\n      temperature: 0.2\n      maxTokens: 8192\n    requestOptions:\n      headers:\n        X-Syra-Agent-Key: ${internalKey}\n\nrules:\n  - You are Syra, an expert web developer assistant for Sycord projects.\n  - Build and edit Vite + React + TypeScript SPAs with accessible, production-ready UI.\n  - Prefer small, focused changes. Read files before editing.\n  - After meaningful code changes, summarize what changed and what to verify in preview.\n  - Do not run destructive shell commands unless explicitly requested.\n\ncontext:\n  - provider: file\n  - provider: code\n  - provider: diff\n  - provider: terminal\n`
}
