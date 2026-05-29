import type { Diagnostic } from "./types"

export type ErrorStage =
  | "auth"
  | "project_load"
  | "intent"
  | "context"
  | "planning"
  | "generation"
  | "parsing"
  | "validation"
  | "repair"
  | "saving"
  | "provider"
  | "streaming"

export class AiPipelineError extends Error {
  public stage: ErrorStage
  public userMessage: string
  public safeDetails: string
  public statusCode: number
  public diagnostics: Diagnostic[]
  public retryable: boolean
  public cause?: unknown

  constructor(opts: {
    stage: ErrorStage
    userMessage: string
    safeDetails?: string
    statusCode?: number
    diagnostics?: Diagnostic[]
    retryable?: boolean
    cause?: unknown
  }) {
    super(opts.userMessage)
    this.name = "AiPipelineError"
    this.stage = opts.stage
    this.userMessage = opts.userMessage
    this.safeDetails = opts.safeDetails ?? ""
    this.statusCode = opts.statusCode ?? 500
    this.diagnostics = opts.diagnostics ?? []
    this.retryable = opts.retryable ?? false
    this.cause = opts.cause
  }

  toSSE() {
    return {
      stage: this.stage,
      title: this.userMessage,
      message: this.safeDetails || this.userMessage,
      retryable: this.retryable,
      diagnostics: this.diagnostics,
    }
  }
}

export class ProviderError extends AiPipelineError {
  public providerStatus: number

  constructor(opts: {
    message: string
    details?: string
    status?: number
    retryable?: boolean
    cause?: unknown
  }) {
    super({
      stage: "provider",
      userMessage: opts.message,
      safeDetails: opts.details,
      statusCode: opts.status ?? 502,
      retryable: opts.retryable ?? false,
      cause: opts.cause,
    })
    this.name = "ProviderError"
    this.providerStatus = opts.status ?? 502
  }
}

export class ValidationError extends AiPipelineError {
  constructor(opts: {
    message: string
    diagnostics?: Diagnostic[]
    retryable?: boolean
  }) {
    super({
      stage: "validation",
      userMessage: opts.message,
      safeDetails: opts.diagnostics?.map((d) => `${d.file}: ${d.message}`).join("\n"),
      diagnostics: opts.diagnostics,
      retryable: opts.retryable ?? false,
    })
    this.name = "ValidationError"
  }
}

export class SaveError extends AiPipelineError {
  constructor(opts: {
    message: string
    details?: string
    retryable?: boolean
    cause?: unknown
  }) {
    super({
      stage: "saving",
      userMessage: opts.message,
      safeDetails: opts.details,
      statusCode: 500,
      retryable: opts.retryable ?? true,
      cause: opts.cause,
    })
    this.name = "SaveError"
  }
}

export class AuthError extends AiPipelineError {
  constructor(message = "Authentication required") {
    super({
      stage: "auth",
      userMessage: message,
      statusCode: 401,
      retryable: false,
    })
    this.name = "AuthError"
  }
}

export function redactSecrets(text: string): string {
  return text
    .replace(/([A-Za-z0-9+/]{40,}=*)/g, "***REDACTED***")
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer ***REDACTED***")
    .replace(/api[_-]?key[=:]\s*['"]?[A-Za-z0-9_\-]+['"]?/gi, "api_key=***REDACTED***")
    .replace(/mongodb(\+srv)?:\/\/[^:\s]+:[^@\s]+@/gi, "mongodb://***REDACTED***@")
    .replace(/sk-[A-Za-z0-9]{20,}/g, "sk-***REDACTED***")
    .replace(/XAI_API_KEY[=:]\s*['"]?[^'"\s]+/gi, "XAI_API_KEY=***REDACTED***")
}
