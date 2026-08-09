import DOMPurify from 'isomorphic-dompurify';

/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    ADD_TAGS: ['foreignObject'], // Mermaid might need foreignObject for text, but DOMPurify strips unsafe nested HTML
    ADD_ATTR: ['xmlns:xlink']
  }) as string;
}
