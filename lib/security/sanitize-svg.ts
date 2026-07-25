import DOMPurify from "isomorphic-dompurify"

/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['target'],
  })
}
