import type { SiteConfig, BlockConfig, ThemeConfig } from "@/lib/builder/types"
import { blockMetadata } from "@/lib/builder/block-metadata"

const VALID_BLOCK_TYPES = new Set<string>(blockMetadata.map((b) => b.type))
const VARIANT_MAP = Object.fromEntries(blockMetadata.map((b) => [b.type, new Set(b.variants)]))
const DEFAULT_PROPS_MAP = Object.fromEntries(blockMetadata.map((b) => [b.type, b.defaultProps]))

export interface GenerationResult {
  config: SiteConfig
  source: "ai" | "template"
}

/**
 * Generate a full SiteConfig from a natural-language prompt. Calls the Sycord
 * server endpoint which runs the agentic Gemini generation, then validates the
 * structured JSON. Falls back to a starter template if AI is unavailable.
 */
export async function generateSiteConfig(prompt: string, signal?: AbortSignal): Promise<GenerationResult> {
  try {
    const res = await fetch("/api/builder/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    })

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json") && res.ok) {
      const raw = await res.json()
      return { config: validateSiteConfig(raw, prompt), source: "ai" }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
  }

  return { config: getStarterTemplate(prompt), source: "template" }
}

function isValidHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s)
}

function validateTheme(raw: Record<string, unknown>): Partial<ThemeConfig> {
  const theme: Partial<ThemeConfig> = {}
  const colorKeys: (keyof ThemeConfig)[] = [
    "bg0", "bg1", "bg2", "bg3", "bg4", "bg5",
    "text0", "text1", "text2", "text3",
    "accent", "accentDim",
    "borderDefault", "borderSubtle", "borderHover",
  ]
  const fontKeys: (keyof ThemeConfig)[] = ["fontSans", "fontDisplay", "fontMono"]

  for (const key of colorKeys) {
    if (isValidHex(raw[key])) {
      ;(theme as Record<string, unknown>)[key] = raw[key]
    }
  }
  for (const key of fontKeys) {
    if (typeof raw[key] === "string" && (raw[key] as string).length > 0) {
      ;(theme as Record<string, unknown>)[key] = raw[key]
    }
  }
  if (typeof raw.radius === "number" && raw.radius >= 0 && raw.radius <= 24) theme.radius = raw.radius
  if (typeof raw.radiusLg === "number" && raw.radiusLg >= 0 && raw.radiusLg <= 32) theme.radiusLg = raw.radiusLg

  return theme
}

function validateBlock(raw: Record<string, unknown>, index: number): BlockConfig | null {
  const type = raw.type as string
  if (!type || !VALID_BLOCK_TYPES.has(type)) return null

  const variants = VARIANT_MAP[type]
  let variant = raw.variant as string
  if (!variant || !variants?.has(variant)) {
    variant = blockMetadata.find((b) => b.type === type)?.variants[0] || "default"
  }

  const defaultProps = DEFAULT_PROPS_MAP[type] || {}
  const props = typeof raw.props === "object" && raw.props ? { ...defaultProps, ...raw.props } : defaultProps

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `block-${type}-${index}-${Date.now()}`,
    type: type as BlockConfig["type"],
    variant,
    props: props as Record<string, unknown>,
  }
}

function validatePageBlocks(rawBlocks: unknown[]): BlockConfig[] {
  const blocks: BlockConfig[] = []
  for (let i = 0; i < rawBlocks.length; i++) {
    const block = validateBlock(rawBlocks[i] as Record<string, unknown>, i)
    if (block) blocks.push(block)
  }
  return blocks
}

export function validateSiteConfig(raw: unknown, prompt?: string): SiteConfig {
  if (!raw || typeof raw !== "object") {
    return getStarterTemplate(prompt || "")
  }

  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === "string" ? obj.name : extractNameFromPrompt(prompt)

  let pages: { id: string; name: string; path: string; blocks: BlockConfig[] }[] | undefined
  if (Array.isArray(obj.pages) && obj.pages.length > 0) {
    pages = []
    for (const rawPage of obj.pages) {
      if (!rawPage || typeof rawPage !== "object") continue
      const p = rawPage as Record<string, unknown>
      const pageBlocks = Array.isArray(p.blocks) ? validatePageBlocks(p.blocks) : []
      if (pageBlocks.length > 0) {
        pages.push({
          id: typeof p.id === "string" ? p.id : `page-${Date.now()}-${pages.length}`,
          name: typeof p.name === "string" ? p.name : `Page ${pages.length + 1}`,
          path: typeof p.path === "string" ? p.path : `/${pages.length === 0 ? "" : `page-${pages.length}`}`,
          blocks: pageBlocks,
        })
      }
    }
    if (pages.length === 0) pages = undefined
  }

  let blocks: BlockConfig[] = []
  if (Array.isArray(obj.blocks)) {
    blocks = validatePageBlocks(obj.blocks)
  }

  if (pages && pages.length > 0 && blocks.length === 0) {
    blocks = pages[0].blocks
  }

  if (!pages && blocks.length === 0) {
    return getStarterTemplate(prompt || "")
  }

  if (!pages && blocks.length > 0) {
    pages = [{ id: "page-home", name: "Home", path: "/", blocks }]
  }

  let theme: Partial<ThemeConfig> | undefined
  if (obj.theme && typeof obj.theme === "object") {
    theme = validateTheme(obj.theme as Record<string, unknown>)
    if (Object.keys(theme).length === 0) theme = undefined
  }

  return { name, pages, blocks, theme }
}

function extractNameFromPrompt(prompt?: string): string {
  if (!prompt) return "My Website"
  const words = prompt.split(/\s+/).slice(0, 4).join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function blockFromMeta(type: BlockConfig["type"], idSuffix: string, overrides?: Record<string, unknown>): BlockConfig {
  const meta = blockMetadata.find((b) => b.type === type)!
  return {
    id: `block-${type}-${idSuffix}`,
    type,
    variant: meta.variants[0],
    props: { ...meta.defaultProps, ...(overrides || {}) },
  }
}

/** Instant fallback when AI generation is unavailable. Produces a working site. */
export function getStarterTemplate(prompt?: string): SiteConfig {
  const name = extractNameFromPrompt(prompt)
  const blocks: BlockConfig[] = [
    blockFromMeta("navbar", "1", { logo: name }),
    blockFromMeta("hero", "1", {
      badge: "New",
      headline: name,
      subheadline: prompt ? `A site about: ${prompt}` : "Describe your idea and let AI build it.",
    }),
    blockFromMeta("features", "1"),
    blockFromMeta("cta", "1"),
    blockFromMeta("footer", "1", { logo: name, copyright: `${new Date().getFullYear()} ${name}. All rights reserved.` }),
  ]
  return {
    name,
    pages: [{ id: "page-home", name: "Home", path: "/", blocks }],
    blocks,
  }
}
