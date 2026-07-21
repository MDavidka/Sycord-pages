/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  return svg
    // Remove script / foreignObject (HTML-in-SVG XSS)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    // Remove inline event handlers
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    // Neutralize javascript: / data: URLs in href/xlink:href/src
    .replace(/\s(href|xlink:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\s(href|xlink:href|src)\s*=\s*(['"])\s*data:text\/html[\s\S]*?\2/gi, ' $1="#"')
}
