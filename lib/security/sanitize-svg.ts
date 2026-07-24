import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/**
 * Strip common XSS vectors from Mermaid (or other) SVG output before
 * rendering via dangerouslySetInnerHTML.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg) return ""

  let window;
  if (typeof globalThis.window === 'undefined') {
    window = new JSDOM('').window;
  } else {
    window = globalThis.window;
  }

  const DOMPurify = createDOMPurify(window as any);

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['target']
  });
}
