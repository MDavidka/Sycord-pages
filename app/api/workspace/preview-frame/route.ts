// HTML proxy that strips X-Frame-Options from Syte preview responses.
//
// GET /api/workspace/preview-frame?url=<encoded-syte-preview-url>

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchPreviewUpstream } from "@/lib/deploy/preview-upstream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const ALLOWED_HOSTS = [".sycord.site", ".sycord.com"]
const DEBUG_PREFIX = "[PreviewDebug]"

function isAllowedPreviewUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw)
    return ALLOWED_HOSTS.some((h) => hostname.endsWith(h))
  } catch {
    return false
  }
}

function logPreviewFrame(phase: string, data: Record<string, unknown>) {
  console.warn(DEBUG_PREFIX, { scope: "preview-frame", phase, ...data })
}

function previewUnavailableHtml(message: string, previewUrl: string): string {
  const safeMsg = message.replace(/</g, "&lt;")
  const safeUrl = previewUrl.replace(/</g, "&lt;")
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview starting</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#444;text-align:center;padding:24px}main{max-width:320px}h1{font-size:16px;font-weight:600;margin:0 0 8px}p{font-size:13px;line-height:1.5;margin:0 0 12px;color:#666}code{font-size:11px;word-break:break-all;color:#888}</style></head><body><main><h1>Dev server starting…</h1><p>${safeMsg}</p><p>The preview reloads automatically when the server is ready.</p><code>${safeUrl}</code></main><script>setTimeout(()=>location.reload(),4000)</script></body></html>`
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.id) {
    logPreviewFrame("unauthorized", {})
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawUrl = searchParams.get("url")
  if (!rawUrl) {
    logPreviewFrame("missing_url", {})
    return new Response("Missing url param", { status: 400 })
  }

  let previewUrl: string
  try {
    previewUrl = decodeURIComponent(rawUrl)
  } catch {
    logPreviewFrame("bad_url_encoding", { rawUrl: rawUrl.slice(0, 200) })
    return new Response("Bad url encoding", { status: 400 })
  }

  if (!isAllowedPreviewUrl(previewUrl)) {
    let hostname = "unknown"
    try {
      hostname = new URL(previewUrl).hostname
    } catch {
      /* ignore */
    }
    logPreviewFrame("url_not_allowed", { previewUrl, hostname })
    return new Response("URL not allowed", { status: 403 })
  }

  logPreviewFrame("request", { previewUrl })

  const upstream = await fetchPreviewUpstream(previewUrl, {
    retries: 4,
    retryMs: 2000,
    timeoutMs: 12_000,
  })

  if (!upstream.ok) {
    logPreviewFrame("upstream_unreachable", {
      previewUrl,
      error: upstream.error,
      attempts: upstream.attempts,
      elapsedMs: upstream.elapsedMs,
    })
    const html = previewUnavailableHtml(
      `Preview server unreachable: ${upstream.error}`,
      previewUrl,
    )
    return new Response(html, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Frame-Options": "ALLOWALL",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    })
  }

  const res = upstream.response
  const upstreamStatus = res.status
  const contentType = res.headers.get("content-type") ?? ""
  const elapsedMs = upstream.elapsedMs
  let strippedXFrameOptions = false
  let strippedFrameAncestors = false

  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === "x-frame-options") {
      strippedXFrameOptions = true
      return
    }
    if (k === "content-security-policy") {
      const directives = value.split(";").map((d) => d.trim())
      const hadFrameAncestors = directives.some((d) =>
        d.toLowerCase().startsWith("frame-ancestors"),
      )
      if (hadFrameAncestors) strippedFrameAncestors = true
      const cleaned = directives
        .filter((d) => !d.toLowerCase().startsWith("frame-ancestors"))
        .join("; ")
      if (cleaned) outHeaders.set(key, cleaned)
      return
    }
    if (k === "transfer-encoding" || k === "connection" || k === "keep-alive") return
    outHeaders.set(key, value)
  })

  outHeaders.set("X-Frame-Options", "ALLOWALL")
  outHeaders.set("Content-Type", "text/html; charset=utf-8")
  outHeaders.set("Cross-Origin-Resource-Policy", "cross-origin")
  outHeaders.set("Cache-Control", "private, no-store, no-cache, must-revalidate")
  outHeaders.delete("etag")
  outHeaders.delete("last-modified")

  if (!contentType.includes("text/html")) {
    logPreviewFrame("non_html_passthrough", {
      previewUrl,
      upstreamStatus,
      contentType,
      elapsedMs,
      attempts: upstream.attempts,
      strippedXFrameOptions,
      strippedFrameAncestors,
    })
    return new Response(res.body, { status: res.status, headers: outHeaders })
  }

  let html = await res.text()
  const htmlBytes = Buffer.byteLength(html, "utf8")

  const baseHref = previewUrl.endsWith("/") ? previewUrl : previewUrl + "/"
  const baseTag = `<base href="${baseHref}">`

  if (html.includes("<head>")) {
    html = html.replace("<head>", `<head>\n  ${baseTag}`)
  } else if (html.includes("<head ")) {
    html = html.replace(/<head[^>]*>/, (m) => `${m}\n  ${baseTag}`)
  } else if (html.includes("<html")) {
    html = html.replace(/<html[^>]*>/, (m) => `${m}<head>${baseTag}</head>`)
  } else {
    html = html.replace(/^/, `${baseTag}\n`)
  }

  const phase = htmlBytes < 200 ? "tiny_html_body" : "success"
  logPreviewFrame(phase, {
    previewUrl,
    upstreamStatus,
    contentType,
    htmlBytes,
    elapsedMs,
    attempts: upstream.attempts,
    injectedBaseHref: baseHref,
    strippedXFrameOptions,
    strippedFrameAncestors,
  })

  return new Response(html, { status: 200, headers: outHeaders })
}
