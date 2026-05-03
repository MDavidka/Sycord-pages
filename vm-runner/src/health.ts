import { appendLog } from "./logs.js"

export async function runHealthCheck(projectId: string, port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { Accept: "text/html" },
  })
  const contentType = response.headers.get("content-type") || ""
  const body = await response.text()
  const htmlOk = /<!doctype html|<html/i.test(body)
  const binaryLike = /[\u0000-\u0008]/.test(body)
  const artifactLike = /\.next\//i.test(body) || /application\/octet-stream/i.test(contentType)
  const ok = response.status === 200 && /text\/html/i.test(contentType) && htmlOk && !binaryLike && !artifactLike

  await appendLog(projectId, "health", `status=${response.status} contentType=${contentType} htmlOk=${htmlOk} ok=${ok}`)

  return {
    ok,
    htmlOk,
    status: response.status,
    contentType,
    error: ok ? null : "Health check failed: root route did not return valid HTML",
  }
}
