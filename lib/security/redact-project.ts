/** Fields that must never be returned to the browser in plaintext. */
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

  // Nested deployment / integration blobs may also carry tokens
  if (safe.deployment && typeof safe.deployment === "object") {
    const dep = { ...safe.deployment }
    for (const key of SECRET_PROJECT_KEYS) {
      if (key in dep && dep[key]) dep[key] = maskSecret(dep[key])
    }
    safe.deployment = dep
  }

  return safe as T
}
