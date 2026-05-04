import type { FastifyReply } from "fastify"

export type StreamStage =
  | "queued"
  | "git-sync"
  | "installing"
  | "building"
  | "allocating-port"
  | "starting-server"
  | "configuring-proxy"
  | "health-check"
  | "complete"
  | "failed"

export type DeployStreamWriter = {
  stage: (stage: StreamStage, status: "pending" | "running" | "success" | "error", message: string) => void
  log: (source: string, line: string) => void
  result: (data: Record<string, unknown>) => void
  error: (data: Record<string, unknown>) => void
}

function now() {
  return new Date().toISOString()
}

function write(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\n`)
  reply.raw.write(`data: ${JSON.stringify({ ...(data as Record<string, unknown>), timestamp: now() })}\n\n`)
}

export function createSseReply(reply: FastifyReply): DeployStreamWriter {
  reply.raw.setHeader("Content-Type", "text/event-stream")
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform")
  reply.raw.setHeader("Connection", "keep-alive")

  return {
    stage(stage, status, message) {
      write(reply, "stage", { type: "stage", stage, status, message, timestamp: now() })
    },
    log(source, line) {
      write(reply, "log", { type: "log", source, line, timestamp: now() })
    },
    result(data) {
      write(reply, "result", { type: "result", success: true, ...data, timestamp: now() })
    },
    error(data) {
      write(reply, "error", { type: "error", ...data, timestamp: now() })
    },
  }
}
