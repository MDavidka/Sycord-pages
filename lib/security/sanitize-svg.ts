import DOMPurify from 'dompurify';

/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  // When running on the server, we need jsdom for DOMPurify
  if (typeof window === 'undefined') {
    // Dynamic import to avoid client-side bundling issues
    let windowObj: any = null;
    try {
        const { JSDOM } = eval("require('jsdom')");
        windowObj = new JSDOM('').window;
    } catch (e) {} // Fallback for edge runtime or environments without jsdom

    if (windowObj) {
        const purify = DOMPurify(windowObj as any);
        return purify.sanitize(svg, { USE_PROFILES: { svg: true } });
    } else {
        // Fallback to strict regex if no DOM is available server-side
        return svg
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, "")
          .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "")
          .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(/\s(href|xlink:href|src)\s*=\s*(['"])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi, ' $1="#"');
    }
  }

  // Client-side execution
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } });
}
