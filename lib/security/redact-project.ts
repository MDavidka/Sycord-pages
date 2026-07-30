/** Fields that must never be returned to the browser in plaintext. */
const SECRET_KEY_RE =
  /(secret|token|password|passwd|api[_-]?key|private[_-]?key|access[_-]?key|credential|mongoApiKey|github_tokens|coolify|deployToken|sshPrivateKey)/i

const SECRET_PROJECT_KEYS = [
  "mongoApiKey",
  "github_tokens",
  "githubToken",
  "githubAccessToken",
  "coolifyApiKey",
  "coolifyToken",
  "deployToken",
  "sshPrivateKey",
  "privateKey",
] as const

function maskSecret(value: unknown): string | null {
  if (value == null || value === "") return null
  return "••••••••"
}

function redactEnvVars(envVars: unknown): unknown {
  if (!Array.isArray(envVars)) return envVars
  return envVars.map((entry) => {
    if (!entry || typeof entry !== "object") return entry
    const v = entry as Record<string, unknown>
    return {
      ...v,
      value: v.value ? "••••••••" : "",
      hasValue: Boolean(v.value),
    }
  })
}

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value == null) return value
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1))
  }
  if (typeof value !== "object") return value

  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(key) && typeof inner === "string" && inner) {
      out[key] = maskSecret(inner)
      continue
    }
    if (key === "envVars") {
      out[key] = redactEnvVars(inner)
      continue
    }
    out[key] = redactDeep(inner, depth + 1)
  }
  return out
}

/**
 * Strip or mask secrets from a project document before sending it to the client.
 */
export function redactProjectForClient<T extends Record<string, any>>(project: T): T {
  const safe = { ...project } as Record<string, any>

  for (const key of SECRET_PROJECT_KEYS) {
    if (key in safe && safe[key]) {
      safe[key] = maskSecret(safe[key])
    }
  }

  if ("envVars" in safe) {
    safe.envVars = redactEnvVars(safe.envVars)
  }

  // Recursively redact nested deployment / integration blobs and unknown secret keys.
  if (safe.deployment && typeof safe.deployment === "object") {
    safe.deployment = redactDeep(safe.deployment)
  }
  if (safe.integrations && typeof safe.integrations === "object") {
    safe.integrations = redactDeep(safe.integrations)
  }

  // Catch any remaining secret-looking top-level string fields.
  for (const [key, value] of Object.entries(safe)) {
    if (SECRET_KEY_RE.test(key) && typeof value === "string" && value) {
      safe[key] = maskSecret(value)
    }
  }

  return safe as T
}
