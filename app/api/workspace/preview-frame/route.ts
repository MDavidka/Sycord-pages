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

const ALLOWED_HOST_SUFFIXES = ["sycord.site", "sycord.com"]

function isAllowedPreviewUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:") return false
    const hostname = parsed.hostname.toLowerCase()
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  } catch {
    return false
  }
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawUrl = searchParams.get("url")
  if (!rawUrl) return new Response("Missing url param", { status: 400 })

  let previewUrl: string
  try {
    previewUrl = decodeURIComponent(rawUrl)
  } catch {
    return new Response("Bad url encoding", { status: 400 })
  }

  if (!isAllowedPreviewUrl(previewUrl)) {
    return new Response("URL not allowed", { status: 403 })
  }

  let res: Response
  try {
    res = await fetch(previewUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": "Sycord-Preview-Proxy/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    })
  } catch (err: any) {
    return new Response(`Preview server unreachable: ${err.message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    })
  }

  // Do not follow redirects blindly (SSRF escape hatch)
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location")
    if (!location || !isAllowedPreviewUrl(new URL(location, previewUrl).toString())) {
      return new Response("Redirect target not allowed", { status: 403 })
    }
  }

  // Forward most headers but strip the embedding blockers
  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === "x-frame-options") return
    if (k === "content-security-policy") {
      // Remove frame-ancestors directive only; keep the rest
      const cleaned = value
        .split(";")
        .map((d) => d.trim())
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

  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("text/html")) {
    // Non-HTML response (e.g. redirect target) — stream through unchanged
    return new Response(res.body, { status: res.status, headers: outHeaders })
  }

  let html = await res.text()

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
    html = baseTag + "\n" + html
  }

  return new Response(html, { status: res.status, headers: outHeaders })
}
