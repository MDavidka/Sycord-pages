// HTML proxy that strips X-Frame-Options from Syte preview responses.
//
// Problem: Caddy on sycord.site sends X-Frame-Options: SAMEORIGIN.
// The Sycord app is on sycord.com — a different origin — so the browser
// silently blanks the iframe.
//
// Solution: fetch the preview HTML server-side, strip the blocking headers,
// inject <base href="https://preview*.sycord.site/"> so every relative asset
// URL (scripts, CSS, imports) resolves to the Syte dev server.
// Vite dev server already sends Access-Control-Allow-Origin: * for all assets,
// so they load fine cross-origin from the now-sycord.com-origin iframe.
//
// GET /api/workspace/preview-frame?url=<encoded-syte-preview-url>

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

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

  const fetchStarted = Date.now()
  let res: Response
  try {
    res = await fetch(previewUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": "Sycord-Preview-Proxy/1.0",
      },
      signal: AbortSignal.timeout(12000),
    })
  } catch (err: any) {
    logPreviewFrame("upstream_unreachable", {
      previewUrl,
      error: err?.message || String(err),
      elapsedMs: Date.now() - fetchStarted,
    })
    return new Response(`Preview server unreachable: ${err.message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    })
  }

  const upstreamStatus = res.status
  const contentType = res.headers.get("content-type") ?? ""
  const elapsedMs = Date.now() - fetchStarted
  let strippedXFrameOptions = false
  let strippedFrameAncestors = false

  // Forward most headers but strip the embedding blockers
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
      // Remove frame-ancestors directive only; keep the rest
      const cleaned = directives
        .filter((d) => !d.toLowerCase().startsWith("frame-ancestors"))
        .join("; ")
      if (cleaned) outHeaders.set(key, cleaned)
      return
    }
    // Don't forward hop-by-hop headers
    if (k === "transfer-encoding" || k === "connection" || k === "keep-alive") return
    outHeaders.set(key, value)
  })

  // Allow framing from any origin (we're now the proxy)
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
      strippedXFrameOptions,
      strippedFrameAncestors,
    })
    // Non-HTML response (e.g. redirect target) — stream through unchanged
    return new Response(res.body, { status: res.status, headers: outHeaders })
  }

  let html = await res.text()
  const htmlBytes = Buffer.byteLength(html, "utf8")

  // Inject <base href> at the top of <head> so all relative asset URLs
  // (scripts, CSS, ES module imports) resolve to the Syte preview server.
  // Vite dev server sends Access-Control-Allow-Origin: * for every asset,
  // so they load fine even though the iframe origin is now sycord.com.
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

  if (htmlBytes < 200) {
    logPreviewFrame("tiny_html_body", {
      previewUrl,
      upstreamStatus,
      contentType,
      htmlBytes,
      elapsedMs,
      injectedBaseHref: baseHref,
      strippedXFrameOptions,
      strippedFrameAncestors,
    })
  } else {
    logPreviewFrame("success", {
      previewUrl,
      upstreamStatus,
      contentType,
      htmlBytes,
      elapsedMs,
      injectedBaseHref: baseHref,
      strippedXFrameOptions,
      strippedFrameAncestors,
    })
  }

  return new Response(html, { status: 200, headers: outHeaders })
}
