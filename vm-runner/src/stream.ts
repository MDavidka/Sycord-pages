import type { FastifyReply } from "fastify"

export type StreamStage =
  | "queued"
  | "preparing"
  | "writing-files"
  | "installing"
  | "building"
  | "starting-server"
  | "configuring-proxy"
  | "health-check"
  | "complete"
  | "failed"

export type DeployStreamWriter = {
  stage: (stage: StreamStage, status: "running" | "success" | "error", message: string) => void
  log: (source: string, line: string) => void
  result: (data: Record<string, unknown>) => void
  error: (data: Record<string, unknown>) => void
}

function write(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\n`)
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function createSseReply(reply: FastifyReply): DeployStreamWriter {
  reply.raw.setHeader("Content-Type", "text/event-stream")
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform")
  reply.raw.setHeader("Connection", "keep-alive")

  return {
    stage(stage, status, message) {
      write(reply, "stage", { stage, status, message })
    },
    log(source, line) {
      write(reply, "log", { source, line })
    },
    result(data) {
      write(reply, "result", data)
    },
    error(data) {
      write(reply, "error", data)
    },
  }
}
