/**
 * Converts an external Vite preview URL into a same-origin proxy path.
 * e.g. https://previewg-tsst76.sycord.com  →  /api/preview-proxy/?target=https%3A%2F%2F...
 *
 * All asset requests (/@vite/client, /src/main.tsx, etc.) are then made as:
 * /api/preview-proxy/@vite/client?target=...
 */
export function toProxyUrl(previewUrl: string, path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  const encoded = encodeURIComponent(previewUrl)
  // Strip leading slash for the [...path] catch-all segment
  const segment = normalizedPath === '/' ? '' : normalizedPath
  return `/api/preview-proxy${segment}?target=${encoded}`
}

export function isProxiedPreviewUrl(url: string): boolean {
  return url.startsWith('/api/preview-proxy')
}
