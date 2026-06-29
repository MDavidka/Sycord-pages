import type { Preset } from './index'
import { b27GcrRo } from './b27GcrRo'

/**
 * Preset "b0" — the default Sycord builder preset.
 * It shares the same professional shadcn/ui section library as b27GcrRo
 * but is exposed as the canonical default preset (`--preset b0`).
 */
export const b0: Preset = {
  ...b27GcrRo,
  id: 'b0',
  name: 'Sycord Default (b0)',
  description: 'Default Sycord website preset built entirely from shadcn/ui + Radix UI primitives. Uses Card, Button, Badge, Avatar, Separator, Accordion, Tabs, and all shadcn primitives. No custom CSS — only shadcn composition + layout Tailwind.',
}
