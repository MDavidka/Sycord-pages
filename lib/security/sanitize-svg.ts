import DOMPurify from "isomorphic-dompurify"

/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject'],
    FORBID_TAGS: ['script'],
    FORBID_ATTR: ['onmouseover', 'onload', 'onerror', 'onclick', 'onmousedown', 'onmouseup', 'onmousemove', 'onmouseout'], // DOMPurify natively strips events
  }) as string
}
