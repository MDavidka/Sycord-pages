// HTML proxy that strips X-Frame-Options from Syte preview responses.
//
// Problem: Caddy on sycord.site sends X-Frame-Options: SAMEORIGIN.
// The Sycord app is on sycord.com — a different origin — so the browser
// silently blanks the iframe.
//
// Solution: fetch the preview HTML server-side, follow any server-side
// redirects (e.g. / → /index.html from Vite), strip the blocking headers,
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
const MAX_REDIRECTS = 5

function isAllowedPreviewUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    const hostname = parsed.hostname.toLowerCase()
    if (
      ALLOWED_HOST_SUFFIXES.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    ) {
      if (parsed.protocol === "http:") {
        return hostname === "localhost" || hostname === "127.0.0.1"
      }
      return true
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") return true
    return false
  } catch {
    return false
  }
}

function frameAncestorsForRequest(req: Request): string {
  const ancestors = new Set<string>(["'self'"])
  try {
    const origin = req.headers.get("origin")
    if (origin) {
      const parsed = new URL(origin)
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        ancestors.add(origin)
      }
    }
  } catch { /* ignore */ }
  try {
    const referer = req.headers.get("referer")
    if (referer) {
      const parsed = new URL(referer)
      ancestors.add(parsed.origin)
    }
  } catch { /* ignore */ }
  ancestors.add("https://sycord.com")
  ancestors.add("https://www.sycord.com")
  ancestors.add("https://app.sycord.com")
  ancestors.add("http://localhost:3000")
  ancestors.add("http://127.0.0.1:3000")
  return Array.from(ancestors).join(" ")
}

/**
 * Fetch previewUrl, following redirects server-side (up to MAX_REDIRECTS).
 * Each redirect target is re-checked against the allowlist to prevent SSRF.
 * Returns the final response and the resolved URL (used for <base href>).
 */
async function fetchFollowingRedirects(
  startUrl: string,
): Promise<{ res: Response; finalUrl: string } | { error: string; status: number }> {
  let currentUrl = startUrl
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let res: Response
    try {
      res = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*",
          "User-Agent": "Sycord-Preview-Proxy/1.0",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      })
    } catch (err: any) {
      return { error: `Preview server unreachable: ${err.message}`, status: 502 }
    }

    if (res.status >= 300 && res.status < 400) {
      if (i === MAX_REDIRECTS) {
        return { error: "Too many redirects from preview server", status: 502 }
      }
      const location = res.headers.get("location")
      if (!location) {
        return { error: "Redirect with no Location header", status: 502 }
      }
      const resolved = new URL(location, currentUrl).toString()
      if (!isAllowedPreviewUrl(resolved)) {
        return { error: "Redirect target not allowed", status: 403 }
      }
      currentUrl = resolved
      continue
    }

    return { res, finalUrl: currentUrl }
  }
  return { error: "Too many redirects", status: 502 }
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

  const fetched = await fetchFollowingRedirects(previewUrl)
  if ("error" in fetched) {
    return new Response(fetched.error, {
      status: fetched.status,
      headers: { "Content-Type": "text/plain" },
    })
  }

  const { res, finalUrl } = fetched

  const outHeaders = new Headers()
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === "x-frame-options") return
    if (k === "content-security-policy" || k === "content-security-policy-report-only") {
      const cleaned = value
        .split(";")
        .map((d) => d.trim())
        .filter((d) => {
          const lower = d.toLowerCase()
          return !lower.startsWith("frame-ancestors") && !lower.startsWith("x-frame-options")
        })
        .join("; ")
      if (cleaned) outHeaders.set(key, cleaned)
      return
    }
    if (k === "transfer-encoding" || k === "connection" || k === "keep-alive") return
    outHeaders.set(key, value)
  })

  outHeaders.delete("X-Frame-Options")
  outHeaders.set(
    "Content-Security-Policy",
    `frame-ancestors ${frameAncestorsForRequest(req)}`,
  )
  outHeaders.set("Cross-Origin-Resource-Policy", "cross-origin")
  outHeaders.set("Cache-Control", "no-store")
  outHeaders.set("Content-Type", "text/html; charset=utf-8")

  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("text/html")) {
    return new Response(res.body, { status: res.status, headers: outHeaders })
  }

  let html = await res.text()

  // Use the final (post-redirect) URL for <base href> so relative paths resolve correctly.
  const baseHref = finalUrl.endsWith("/") ? finalUrl : finalUrl + "/"
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
