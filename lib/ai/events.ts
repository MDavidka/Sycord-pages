import type { SSEEvent, SyraMode } from "./types"

export function createStageEvent(
  stage: string,
  status: "running" | "done" | "error" | "warning",
  title: string,
  message: string,
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return { stage, status, title, message, ...extra }
}

export function createMemoryEvent(
  status: "running" | "done",
  title: string,
  message: string,
  revision?: string,
  cacheHit?: boolean,
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return { stage: "memory", status, title, message, revision, cacheHit, ...extra }
}

export function createCacheEvent(
  memoryHit?: boolean,
  fileSummaryHits?: number,
  fileSummaryMisses?: number,
  planHit?: boolean,
): SSEEvent {
  return {
    stage: "cache",
    title: memoryHit ? "Using cached project memory" : "Building project memory",
    memoryHit,
    fileSummaryHits,
    fileSummaryMisses,
    planHit,
  }
}

export function createPlanEvent(
  mode: SyraMode,
  summary: string,
  filesToCreate?: Array<{ name: string; usedFor: string }>,
  filesToModify?: Array<{ name: string; usedFor: string }>,
  filesToDelete?: string[],
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage: "planning",
    status: "done",
    title: "Plan ready",
    message: summary,
    mode,
    filesToCreate,
    filesToModify,
    filesToDelete,
    ...extra,
  }
}

export function createFileEvent(
  status: "running" | "done",
  file: string,
  action: string,
  chars?: number,
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage: "writing",
    status,
    title: status === "done" ? `Updated ${file}` : `Writing ${file}`,
    message: status === "done" ? `${file}` : `Generating ${file}...`,
    file,
    action,
    chars,
    ...extra,
  }
}

export function createDiagnosticEvent(
  severity: "error" | "warning",
  file?: string,
  code?: string,
  message?: string,
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage: "validating",
    severity,
    file,
    code,
    message,
    ...extra,
  }
}

export function createRepairEvent(
  status: "running" | "done",
  passNumber: number,
  errorCount: number,
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage: "repair",
    status,
    title: status === "running" ? `Auto-repair pass ${passNumber}` : `Repair pass ${passNumber} complete`,
    message: status === "running" ? `Fixing ${errorCount} validation errors.` : "Rechecking project...",
    errors: errorCount,
    ...extra,
  }
}

export function createSavedEvent(
  changedFiles: string[],
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage: "saving",
    status: "done",
    title: "Saved project",
    message: `${changedFiles.length} files updated and project memory refreshed.`,
    changedFiles,
    ...extra,
  }
}

export function createErrorEvent(
  stage: string,
  message: string,
  retryable?: boolean,
  diagnostics?: unknown[],
  extra?: Partial<SSEEvent>,
): SSEEvent {
  return {
    stage,
    title: message,
    message,
    retryable,
    status: "error",
    ...extra,
  }
}

export function createDoneEvent(): SSEEvent {
  return {}
}
