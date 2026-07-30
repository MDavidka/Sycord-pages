import type { FastifyReply, FastifyRequest } from "fastify"
import { config } from "./config.js"

export async function requireBearerToken(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  if (!config.token || token !== config.token) {
    await reply.code(401).send({ success: false, error: "Unauthorized" })
  }
}
