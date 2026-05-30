export class AiPipelineError extends Error {
  public stage: string;
  public userMessage: string;
  public safeDetails: any;
  public statusCode: number;
  public diagnostics: any[];
  public retryable: boolean;

  constructor(opts: {
    stage: string;
    message: string;
    userMessage?: string;
    safeDetails?: any;
    statusCode?: number;
    diagnostics?: any[];
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = "AiPipelineError";
    this.stage = opts.stage;
    this.userMessage = opts.userMessage || opts.message;
    this.safeDetails = opts.safeDetails || {};
    this.statusCode = opts.statusCode || 500;
    this.diagnostics = opts.diagnostics || [];
    this.retryable = opts.retryable ?? false;
  }
}

export class ProviderError extends AiPipelineError {
  constructor(opts: any) {
    super({ ...opts, stage: "provider" });
    this.name = "ProviderError";
  }
}

export class ValidationError extends AiPipelineError {
  constructor(opts: any) {
    super({ ...opts, stage: "validating" });
    this.name = "ValidationError";
  }
}

export class SaveError extends AiPipelineError {
  constructor(opts: any) {
    super({ ...opts, stage: "saving" });
    this.name = "SaveError";
  }
}

export class AuthError extends AiPipelineError {
  constructor(opts: any) {
    super({ ...opts, stage: "auth", statusCode: 401 });
    this.name = "AuthError";
  }
}
