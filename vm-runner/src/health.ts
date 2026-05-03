import { appendLog } from "./logs.js"

export async function runHealthCheck(projectId: string, port: number) {
  const start = Date.now()
  let response: Response
  try {
    response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLog(projectId, "health", `fetch-failed: ${message}`)
    return {
      ok: false,
      htmlOk: false,
      statusCode: 0,
      contentType: "",
      latencyMs: Date.now() - start,
      error: `Health request failed: ${message}`,
      detail: `Could not reach http://127.0.0.1:${port}/`,
    }
  }

  const contentType = response.headers.get("content-type") || ""
  let body = ""
  try {
    body = await response.text()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLog(projectId, "health", `body-read-failed: ${message}`)
    return {
      ok: false,
      htmlOk: false,
      statusCode: response.status,
      contentType,
      latencyMs: Date.now() - start,
      error: `Failed to read response body: ${message}`,
      detail: "",
    }
  }

  const latencyMs = Date.now() - start

  const bodyLower = body.toLowerCase().slice(0, 4096)
  const htmlOk = /<!doctype html|<html/i.test(bodyLower)
  const binaryLike = /[\u0000-\u0008\u000b\u000c\u000e-\u0019]/.test(bodyLower)
  const artifactLike = /\.next\//i.test(bodyLower) || /application\/octet-stream/i.test(contentType)
  const gzipOrCompressed = /(?:content-encoding|^gzip|^comp)/i.test(bodyLower)
  const ok = response.status === 200 && /text\/html/i.test(contentType) && htmlOk && !binaryLike && !artifactLike && !gzipOrCompressed

  const detail = [
    `status=${response.status}`,
    `contentType=${contentType}`,
    `htmlOk=${htmlOk}`,
    `binaryLike=${binaryLike}`,
    `artifactLike=${artifactLike}`,
    `gzipOrCompressed=${gzipOrCompressed}`,
    `latencyMs=${latencyMs}`,
    `ok=${ok}`,
  ].join(" ")

  await appendLog(projectId, "health", detail)

  let errorMessage = ""
  if (!ok) {
    if (response.status !== 200) {
      errorMessage = `Health check returned HTTP ${response.status} (expected 200)`
    } else if (binaryLike) {
      errorMessage = "Invalid root response: detected binary/non-printable content"
    } else if (gzipOrCompressed) {
      errorMessage = "Invalid root response: appears to be compressed/gzip data instead of HTML"
    } else if (artifactLike) {
      errorMessage = "Invalid root response: appears to be a build artifact, not HTML"
    } else if (!/text\/html/i.test(contentType)) {
      errorMessage = `Invalid root response: Content-Type is "${contentType}" (expected text/html)`
    } else if (!htmlOk) {
      errorMessage = "Invalid root response: missing <html> or <!doctype html> tag"
    } else {
      errorMessage = "Health check failed: root route did not return valid HTML"
    }
  }

  return {
    ok,
    htmlOk,
    statusCode: response.status,
    contentType,
    latencyMs,
    error: errorMessage || undefined,
    detail,
  }
}
