// Manual test driver for the AI website builder. Runs three representative
// prompts through runAIWebsiteBuilder without any AI provider calls (the
// pipeline falls back to deterministic scaffolding when credentials are
// missing) and asserts the new project-context + Turso behavior.

import { runAIWebsiteBuilder } from "@/lib/ai-website-builder"

type Expectation = {
  label: string
  prompt: string
  project?: Parameters<typeof runAIWebsiteBuilder>[1]
  serverEnv?: Record<string, string>
  expectDatabase: boolean
  expectedDbFiles: string[]
  expectedMissingEnv?: string[]
  expectProjectName: string
  expectUnconnected?: string[]
}

const cases: Expectation[] = [
  {
    label: "1. AI consulting landing page (no DB)",
    prompt: "Build a modern landing page for an AI consulting agency",
    project: {
      project: {
        name: "Relay AI",
        description: "Boutique AI consulting for growth-stage teams",
        category: "agency",
        envVarKeys: [],
      },
    },
    expectDatabase: false,
    expectedDbFiles: [],
    expectProjectName: "Relay AI",
  },
  {
    label: "2. Luxury restaurant bookings (Turso required, real values from project envVars)",
    prompt: "Build a booking app for a luxury restaurant with reservations and admin view",
    project: {
      project: {
        name: "Maison Noir",
        description: "A luxury modern French restaurant",
        category: "restaurant",
        envVarKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
        envVars: [
          { key: "TURSO_DATABASE_URL", value: "libsql://maison-noir-prod.turso.io" },
          { key: "TURSO_AUTH_TOKEN", value: "eyJhbGciOiJFZERTQSJ9.sample-token-value" },
        ],
      },
    },
    expectDatabase: true,
    expectedDbFiles: [
      "lib/db/client.ts",
      "lib/db/schema.ts",
      "lib/db/queries.ts",
    ],
    expectedMissingEnv: [],
    expectProjectName: "Maison Noir",
  },
  {
    label: "3. Handmade candles ecommerce (Turso required, only URL in project)",
    prompt: "Build an ecommerce storefront for handmade candles with cart and orders",
    project: {
      project: {
        name: "Ember Wick",
        description: "Small-batch artisan candles for cozy homes",
        category: "ecommerce",
        envVarKeys: ["TURSO_DATABASE_URL"],
        envVars: [
          { key: "TURSO_DATABASE_URL", value: "libsql://ember-wick-prod.turso.io" },
        ],
      },
    },
    expectDatabase: true,
    expectedDbFiles: [
      "lib/db/client.ts",
      "lib/db/schema.ts",
      "lib/db/queries.ts",
    ],
    expectedMissingEnv: ["TURSO_AUTH_TOKEN"],
    expectProjectName: "Ember Wick",
  },
  {
    label: "4. SaaS with Stripe asked but NOT connected (safe placeholder path)",
    prompt: "Build a SaaS pricing page for a project management tool with Stripe checkout and billing portal",
    project: {
      project: {
        name: "Planly",
        description: "Simple team project management",
        category: "saas",
        envVarKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
        envVars: [
          { key: "TURSO_DATABASE_URL", value: "libsql://planly-prod.turso.io" },
          { key: "TURSO_AUTH_TOKEN", value: "eyJhbGciOiJFZERTQSJ9.sample" },
        ],
        // No stripe in connectedIntegrationIds.
        connectedIntegrationIds: [],
      },
    },
    expectDatabase: true,
    expectedDbFiles: [
      "lib/db/client.ts",
      "lib/db/schema.ts",
      "lib/db/queries.ts",
    ],
    expectedMissingEnv: [],
    expectProjectName: "Planly",
  },
  {
    label: "5. Turso values from server env only (project has no envVars)",
    prompt: "Build a CMS for a magazine with editor dashboard",
    project: {
      project: {
        name: "Signal Weekly",
        description: "An independent magazine",
        category: "cms",
        envVarKeys: [],
      },
    },
    serverEnv: {
      TURSO_DATABASE_URL: "libsql://signal-weekly-server.turso.io",
      TURSO_AUTH_TOKEN: "eyJhbGciOiJFZERTQSJ9.server-env-sample",
    },
    expectDatabase: true,
    expectedDbFiles: [
      "lib/db/client.ts",
      "lib/db/schema.ts",
      "lib/db/queries.ts",
    ],
    expectedMissingEnv: [],
    expectProjectName: "Signal Weekly",
  },
]

async function main() {
  let failures = 0
  for (const c of cases) {
    process.stdout.write(`\n=== ${c.label} ===\n`)

    const priorEnv: Record<string, string | undefined> = {}
    if (c.serverEnv) {
      for (const [k, v] of Object.entries(c.serverEnv)) {
        priorEnv[k] = process.env[k]
        process.env[k] = v
      }
    }
    let result
    try {
      result = await runAIWebsiteBuilder(c.prompt, c.project)
    } finally {
      if (c.serverEnv) {
        for (const [k] of Object.entries(c.serverEnv)) {
          if (priorEnv[k] === undefined) delete process.env[k]
          else process.env[k] = priorEnv[k]
        }
      }
    }

    const filePaths = new Set(result.files.map((f) => f.path))
    const nextConfig = result.files.find((f) => f.path === "next.config.mjs")?.content ?? ""

    const nameOk = result.manifest.brief.projectName === c.expectProjectName
    const dbOk = result.needsDatabase === c.expectDatabase
    const filesOk = c.expectedDbFiles.every((p) => filePaths.has(p))
    const runtimeApiOk = c.expectDatabase ? filePaths.has("app/api/health/db/route.ts") : !Array.from(filePaths).some((p) => p.startsWith("app/api/"))
    const nextServerConfigOk = result.deploymentMode === "next-server" && !nextConfig.includes('output: "export"')
    const missingOk = (() => {
      const exp = c.expectedMissingEnv ?? []
      const got = new Set(result.missingEnvVars.map((e) => e.key))
      if (got.size !== exp.length) return false
      return exp.every((k) => got.has(k))
    })()
    const noExtraDbFiles = c.expectDatabase
      ? true
      : !filePaths.has("lib/db/client.ts") && !filePaths.has(".env")
    const buildOk = result.build.ok
    const noEnvFile = !filePaths.has(".env")
    const logsHaveNoSecret = !result.logs.some((l) => /eyJhbGciOi/.test(l.detail) || /libsql:\/\/[a-z0-9-]+\.turso\.io/.test(l.detail))

    const unconnectedOk = c.expectUnconnected
      ? c.expectUnconnected.every((name) => result.unconnectedIntegrations.includes(name))
      : true

    const summary = {
      projectName: result.manifest.brief.projectName,
      needsDatabase: result.needsDatabase,
      databaseProvider: result.databaseProvider,
      integrations: result.integrations.map((i) => `${i.name}(${i.kind})`),
      unconnected: result.unconnectedIntegrations,
      required: result.requiredEnvVars.map((e) => e.key),
      missing: result.missingEnvVars.map((e) => e.key),
      files: result.files.length,
      buildOk,
      buildErrors: result.build.errors,
      theme: result.manifest.theme.preset,
      deploymentMode: result.deploymentMode,
    }
    console.log(summary)

    const checks: Array<[string, boolean]> = [
      ["project name threaded", nameOk],
      ["needsDatabase", dbOk],
      ["expected DB files emitted", filesOk],
      ["next server config emitted", nextServerConfigOk],
      ["runtime API routes only when needed", runtimeApiOk],
      ["expected missing env vars", missingOk],
      ["no DB files when not needed", noExtraDbFiles],
      ["build validation ok", buildOk],
      ["no .env file generated", noEnvFile],
      ["logs contain no secret values", logsHaveNoSecret],
      ["unconnected integrations surfaced", unconnectedOk],
    ]
    for (const [label, ok] of checks) {
      console.log(`  [${ok ? "OK" : "FAIL"}] ${label}`)
      if (!ok) failures += 1
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed`)
    process.exit(1)
  } else {
    console.log("\nAll assertions passed.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
