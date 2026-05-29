export interface SafeErrorDetails {
  stage: string
  statusCode: number
  userMessage: string
  diagnostics?: string[]
}

export class AiPipelineError extends Error {
  public readonly stage: string
  public readonly statusCode: number
  public readonly userMessage: string
  public readonly safeDetails: SafeErrorDetails
  public readonly diagnostics: string[]

  constructor(opts: {
    message: string
    stage: string
    userMessage: string
    statusCode?: number
    safeDetails?: Partial<SafeErrorDetails>
    diagnostics?: string[]
  }) {
    super(opts.message)
    this.name = "AiPipelineError"
    this.stage = opts.stage
    this.statusCode = opts.statusCode ?? 500
    this.userMessage = opts.userMessage
    this.diagnostics = opts.diagnostics ?? []
    this.safeDetails = {
      stage: opts.stage,
      statusCode: this.statusCode,
      userMessage: opts.userMessage,
      diagnostics: this.diagnostics,
      ...opts.safeDetails,
    }
  }
}

export class ProviderError extends AiPipelineError {
  public readonly retryable: boolean

  constructor(opts: {
    message: string
    stage: string
    userMessage: string
    statusCode?: number
    retryable?: boolean
    diagnostics?: string[]
  }) {
    super({ ...opts, stage: opts.stage || "provider" })
    this.name = "ProviderError"
    this.retryable = opts.retryable ?? false
  }
}

export class ValidationError extends AiPipelineError {
  public readonly fileErrors: Array<{ file: string; type: string; message: string }>

  constructor(opts: {
    message: string
    stage: string
    userMessage: string
    fileErrors?: Array<{ file: string; type: string; message: string }>
    diagnostics?: string[]
  }) {
    super({ ...opts, stage: opts.stage || "validation", statusCode: 422 })
    this.name = "ValidationError"
    this.fileErrors = opts.fileErrors ?? []
  }
}

export class SaveError extends AiPipelineError {
  constructor(opts: {
    message: string
    stage: string
    userMessage: string
    diagnostics?: string[]
  }) {
    super({ ...opts, stage: opts.stage || "save", statusCode: 500 })
    this.name = "SaveError"
  }
}

export class AuthError extends AiPipelineError {
  constructor(opts: {
    message: string
    userMessage?: string
  }) {
    super({
      message: opts.message,
      stage: "auth",
      userMessage: opts.userMessage ?? "Authentication required",
      statusCode: 401,
    })
    this.name = "AuthError"
  }
}
