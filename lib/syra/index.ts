// Syra Foundation — deployment guard and dependency registry.
// This is the foundational layer the AI uses to know what's available.
// Generated code is validated against these allowlists before any deployment.

export {
  isImportAllowed,
  isShadcnExport,
  isLucideIcon,
  isGeneratedDepAllowed,
  SHADCN_EXPORTS,
  LUCIDE_ICONS,
  ALLOWED_GENERATED_DEPS,
  ALLOWED_PATH_PREFIXES,
  IMPORTABLE_PACKAGES,
  FORBIDDEN_IMPORT_PATTERNS,
  FORBIDDEN_ENV,
  NEXT_CONFIG_BASE,
  INSTALLED_SHADCN,
} from "./deploy-registry"

export {
  validateGeneratedFile,
  validateGeneratedPackageJson,
  validateNextConfig,
  validateTsConfig,
  validateAllGeneratedFiles,
} from "./deploy-guard"

export type { GuardCheck } from "./deploy-guard"
