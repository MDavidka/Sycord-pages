// Syra Deployment Guard — validates generated code against the project's
// package.json dependencies, shadcn exports, lucide icons, and Next.js config.
// Rejects hallucinated imports, secret leaks, and integration errors before deployment.

import {
  isImportAllowed,
  isShadcnExport,
  isLucideIcon,
  isGeneratedDepAllowed,
  FORBIDDEN_IMPORT_PATTERNS,
  FORBIDDEN_ENV,
  NEXT_CONFIG_BASE,
  ALLOWED_PATH_PREFIXES,
  SHADCN_EXPORTS,
  LUCIDE_ICONS,
  ALLOWED_GENERATED_DEPS,
} from "./deploy-registry"

export interface GuardCheck {
  ok: boolean
  errors: string[]
  warnings: string[]
}

// ── File-Level Checks ────────────────────────────────────────────

export function validateGeneratedFile(filePath: string, content: string): GuardCheck {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. No .env files
  if (filePath.includes(".env")) {
    errors.push(`${filePath}: env files must never be generated`)
  }

  // 2. Validate all import statements
  const importRegex = /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+(?:\s*,)?\s*)?from\s*['"]([^'"]+)['"]/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const source = match[1]
    if (!isImportAllowed(source)) {
      // Relative imports within generated dirs are OK
      if (!source.startsWith("./") && !source.startsWith("../")) {
        errors.push(`${filePath}: Import not allowed: "${source}"`)
      }
    }
  }

  // 3. Validate shadcn component imports
  const shadcnImportRe = /import\s*\{([^}]+)\}\s*from\s*['"]@\/components\/ui\/(\w+)['"]/g
  while ((match = shadcnImportRe.exec(content)) !== null) {
    const names = match[1].split(",").map((s) => s.trim()).filter(Boolean)
    for (const name of names) {
      if (name.startsWith("type ")) continue
      if (!isShadcnExport(name)) {
        warnings.push(`${filePath}: Unknown shadcn export "${name}" from @/components/ui/${match[2]}`)
      }
    }
  }

  // 4. Validate lucide-react imports
  const lucideRe = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g
  while ((match = lucideRe.exec(content)) !== null) {
    const names = match[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith("type "))
    for (const name of names) {
      if (!isLucideIcon(name)) {
        warnings.push(`${filePath}: Unknown lucide icon "${name}"`)
      }
    }
  }

  // 5. Forbidden patterns
  for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
    if (pattern.test(content)) {
      errors.push(`${filePath}: Contains forbidden pattern: ${pattern.source}`)
    }
  }

  // 6. No hardcoded secrets
  for (const pattern of FORBIDDEN_ENV) {
    if (pattern.test(content)) {
      errors.push(`${filePath}: Contains forbidden env reference: ${pattern.source}`)
    }
  }

  // 7. No raw hex colors (must use Tailwind tokens)
  const hexColors = content.match(/#[0-9a-fA-F]{3,8}/g)
  if (hexColors && hexColors.length > 0) {
    warnings.push(`${filePath}: Contains ${hexColors.length} hex colors — use Tailwind tokens instead`)
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: warnings.slice(0, 10),
  }
}

// ── Package.json Validation ──────────────────────────────────────

export function validateGeneratedPackageJson(content: string): GuardCheck {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const gen = JSON.parse(content)

    // Must have required scripts
    for (const script of ["dev", "build", "start"]) {
      if (!gen.scripts?.[script]) {
        errors.push(`package.json: Missing script "${script}"`)
      }
    }

    // Check dependencies exist in host project
    const deps = { ...(gen.dependencies ?? {}), ...(gen.devDependencies ?? {}) }
    for (const dep of Object.keys(deps)) {
      if (!isGeneratedDepAllowed(dep)) {
        errors.push(`package.json: Dependency "${dep}" not available in host project`)
      }
    }

    // Next.js version must match
    if (gen.dependencies?.next && gen.dependencies.next !== NEXT_CONFIG_BASE.nextVersion) {
      warnings.push(`package.json: next version ${gen.dependencies.next} differs from host (${NEXT_CONFIG_BASE.nextVersion})`)
    }

    // React version must match
    if (gen.dependencies?.react && gen.dependencies.react !== NEXT_CONFIG_BASE.reactVersion) {
      warnings.push(`package.json: react version ${gen.dependencies.react} differs from host (${NEXT_CONFIG_BASE.reactVersion})`)
    }
  } catch {
    errors.push("package.json: Invalid JSON")
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ── Config Validation ────────────────────────────────────────────

export function validateNextConfig(content: string): GuardCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!content.includes("next")) {
    errors.push("next.config: Not a valid Next.js config")
  }

  // Must use ESM module exports
  if (!content.includes("export default")) {
    errors.push("next.config: Must use ESM export default")
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function validateTsConfig(content: string): GuardCheck {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const ts = JSON.parse(content)
    if (ts.compilerOptions?.moduleResolution !== "bundler") {
      errors.push(`tsconfig: moduleResolution must be "bundler", got "${ts.compilerOptions?.moduleResolution}"`)
    }
    if (!ts.compilerOptions?.paths?.["@/*"]) {
      errors.push(`tsconfig: Missing @/* path alias`)
    }
  } catch {
    errors.push("tsconfig: Invalid JSON")
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ── Full Project Validation ──────────────────────────────────────

export function validateAllGeneratedFiles(
  files: Array<{ path: string; content: string }>,
): GuardCheck {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  for (const file of files) {
    if (file.path === "package.json") {
      const r = validateGeneratedPackageJson(file.content)
      allErrors.push(...r.errors)
      allWarnings.push(...r.warnings)
    } else if (file.path.endsWith("next.config.mjs") || file.path.endsWith("next.config.ts")) {
      const r = validateNextConfig(file.content)
      allErrors.push(...r.errors)
      allWarnings.push(...r.warnings)
    } else if (file.path === "tsconfig.json") {
      const r = validateTsConfig(file.content)
      allErrors.push(...r.errors)
      allWarnings.push(...r.warnings)
    } else {
      const r = validateGeneratedFile(file.path, file.content)
      allErrors.push(...r.errors)
      allWarnings.push(...r.warnings)
    }
  }

  return {
    ok: allErrors.length === 0,
    errors: allErrors.slice(0, 20),
    warnings: allWarnings.slice(0, 30),
  }
}
