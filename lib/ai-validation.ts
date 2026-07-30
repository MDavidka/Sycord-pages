import { z } from 'zod'

export const DesignTokenScale = z.enum([
  '12', '14', '16', '20', '24', '28', '32', '36', '40', '48', '56', '64',
])

export const ColorToken = z.string().regex(/^(#(?:[0-9a-fA-F]{3}){1,2}|oklch\([^)]+\))$/, 'Must be a valid hex or oklch color')

export const TypographyScale = z.object({
  h1: z.object({ size: DesignTokenScale, weight: z.number().min(600).max(800), tracking: z.string() }),
  h2: z.object({ size: DesignTokenScale, weight: z.number().min(500).max(700), tracking: z.string() }),
  h3: z.object({ size: DesignTokenScale, weight: z.number().min(500).max(600) }),
  body: z.object({ size: z.number().min(14), lineHeight: z.number().min(1.5), weight: z.number().min(400) }),
})

export const DesignTokens = z.object({
  colors: z.object({
    primary: ColorToken,
    accent: ColorToken.optional(),
    background: ColorToken,
    foreground: ColorToken,
    muted: ColorToken.optional(),
    border: ColorToken.optional(),
  }),
  typography: TypographyScale,
  spacing: z.object({
    sectionGap: z.number().min(32).max(128),
    containerPadding: z.number().min(16).max(64),
  }),
  borderRadius: z.string().regex(/^\d+(\.\d+)?rem$/, 'Must be a rem value like "0.5rem"'),
})

export const AccessibilityCheck = z.object({
  contrastRatio: z.number().min(4.5, 'Must meet WCAG AA contrast'),
  hasSkipLink: z.boolean().default(true),
  hasAriaLabels: z.boolean().default(true),
  allImagesHaveAlt: z.boolean().default(true),
  allFormsHaveLabels: z.boolean().default(true),
})

export const GeneratedPageSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1, 'Generated code cannot be empty'),
  timestamp: z.number().positive(),
  usedFor: z.string().optional(),
})

export const GeneratedPageValidation = z.object({
  hasSemanticHtml: z.boolean().default(true),
  hasViewportMeta: z.boolean().default(true),
  hasCharset: z.boolean().default(true),
  hasOpenGraph: z.boolean().default(true),
  noDeadImports: z.boolean().default(true),
  noEvalOrInlineScript: z.boolean().default(true),
  hasCspCompliantContent: z.boolean().default(true),
  accessibility: AccessibilityCheck,
  designTokens: DesignTokens.optional(),
})

export const GenerationQualityScore = z.object({
  accessibility: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  designAdherence: z.number().min(0).max(100),
  semanticStructure: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
})

export function validateGeneratedPage(page: unknown) {
  return GeneratedPageSchema.safeParse(page)
}

export function validateDesignTokens(tokens: unknown) {
  return DesignTokens.safeParse(tokens)
}

export function validateGeneratedPageQuality(quality: Record<string, unknown>) {
  const checks = GeneratedPageValidation.safeParse(quality)
  if (!checks.success) return checks

  const { accessibility, ...rest } = checks.data

  const score: z.infer<typeof GenerationQualityScore> = {
    accessibility: accessibility.allImagesHaveAlt && accessibility.hasAriaLabels ? 90 : 50,
    performance: rest.noDeadImports && rest.hasCspCompliantContent ? 85 : 50,
    designAdherence: rest.hasSemanticHtml ? 90 : 50,
    semanticStructure: rest.hasSemanticHtml ? 85 : 50,
    overall: 0,
  }
  score.overall = Math.round(
    (score.accessibility + score.performance + score.designAdherence + score.semanticStructure) / 4,
  )

  return { success: true, data: GenerationQualityScore.parse(score) }
}
