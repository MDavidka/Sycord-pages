export type IntegrationCategory =
  | "Database"
  | "Auth"
  | "Payments"
  | "Email"
  | "AI"
  | "Storage"
  | "Services"

export type IntegrationDefinition = {
  id: string
  name: string
  category: IntegrationCategory
  description: string
  envKeys: string[]
  placeholders?: Record<string, string>
  free?: boolean
  iconColor?: string
  iconBg?: string
}

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    id: "mongodb",
    name: "MongoDB",
    category: "Database",
    description: "Managed MongoDB connection string for document data.",
    envKeys: ["MONGODB_URI"],
    placeholders: {
      MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/app",
    },
    free: true,
    iconColor: "#00ED64",
    iconBg: "#00684A33",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "Database",
    description: "Postgres, auth, storage, and realtime in one backend.",
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    placeholders: {
      NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOi...",
    },
    free: true,
    iconColor: "#3ECF8E",
    iconBg: "#3ECF8E22",
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "Database",
    description: "Auth and cloud data services from Google.",
    envKeys: [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ],
    placeholders: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSy...",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "your-app.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "your-project-id",
    },
    free: true,
    iconColor: "#FFCA28",
    iconBg: "#FFCA2822",
  },
  {
    id: "neon",
    name: "Neon",
    category: "Database",
    description: "Serverless Postgres for full-stack apps.",
    envKeys: ["DATABASE_URL"],
    placeholders: {
      DATABASE_URL: "postgres://user:pass@ep-xxxx.us-east-1.aws.neon.tech/dbname",
    },
    free: true,
    iconColor: "#00E599",
    iconBg: "#00E59922",
  },
  {
    id: "upstash",
    name: "Upstash Redis",
    category: "Database",
    description: "Serverless Redis cache and queues.",
    envKeys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    placeholders: {
      UPSTASH_REDIS_REST_URL: "https://your-db.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "AXXX...",
    },
    free: true,
    iconColor: "#00E9A3",
    iconBg: "#00E9A322",
  },
  {
    id: "nextauth",
    name: "NextAuth.js",
    category: "Auth",
    description: "Session auth for Next.js apps.",
    envKeys: ["NEXTAUTH_SECRET", "NEXTAUTH_URL"],
    placeholders: {
      NEXTAUTH_SECRET: "generate-a-long-random-secret",
      NEXTAUTH_URL: "https://your-domain.com",
    },
    free: true,
    iconColor: "#8B5CF6",
    iconBg: "#8B5CF622",
  },
  {
    id: "clerk",
    name: "Clerk",
    category: "Auth",
    description: "Managed auth with hosted UI and user management.",
    envKeys: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    placeholders: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_...",
      CLERK_SECRET_KEY: "sk_live_...",
    },
    free: true,
    iconColor: "#6C47FF",
    iconBg: "#6C47FF22",
  },
  {
    id: "authjs-passkeys",
    name: "Passkeys",
    category: "Auth",
    description: "Passwordless auth using passkeys/WebAuthn.",
    envKeys: ["AUTH_SECRET", "AUTH_URL"],
    placeholders: {
      AUTH_SECRET: "generate-a-long-random-secret",
      AUTH_URL: "https://your-domain.com",
    },
    free: true,
    iconColor: "#7DD3FC",
    iconBg: "#7DD3FC22",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    description: "Cards, subscriptions, and checkout flows.",
    envKeys: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY"],
    placeholders: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_...",
      STRIPE_SECRET_KEY: "sk_live_...",
    },
    free: false,
    iconColor: "#635BFF",
    iconBg: "#635BFF22",
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "Payments",
    description: "PayPal checkout and wallet payments.",
    envKeys: ["NEXT_PUBLIC_PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
    placeholders: {
      NEXT_PUBLIC_PAYPAL_CLIENT_ID: "paypal-client-id",
      PAYPAL_CLIENT_SECRET: "paypal-client-secret",
    },
    free: false,
    iconColor: "#009CDE",
    iconBg: "#00308722",
  },
  {
    id: "resend",
    name: "Resend",
    category: "Email",
    description: "Transactional email delivery for auth and notifications.",
    envKeys: ["RESEND_API_KEY", "EMAIL_FROM"],
    placeholders: {
      RESEND_API_KEY: "re_...",
      EMAIL_FROM: "Acme <noreply@yourdomain.com>",
    },
    free: true,
    iconColor: "#FFFFFF",
    iconBg: "#FFFFFF11",
  },
  {
    id: "smtp",
    name: "SMTP",
    category: "Email",
    description: "Generic SMTP provider for email sending.",
    envKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"],
    placeholders: {
      SMTP_HOST: "smtp.yourprovider.com",
      SMTP_PORT: "587",
      SMTP_USER: "apikey",
      SMTP_PASSWORD: "smtp-password",
    },
    free: false,
    iconColor: "#F59E0B",
    iconBg: "#F59E0B22",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "AI",
    description: "LLM and image APIs for AI features.",
    envKeys: ["OPENAI_API_KEY"],
    placeholders: {
      OPENAI_API_KEY: "sk-...",
    },
    free: false,
    iconColor: "#10A37F",
    iconBg: "#10A37F22",
  },
  {
    id: "github",
    name: "GitHub",
    category: "Services",
    description: "GitHub API access for workflows and automation.",
    envKeys: ["GITHUB_TOKEN"],
    placeholders: {
      GITHUB_TOKEN: "ghp_...",
    },
    free: true,
    iconColor: "#FFFFFF",
    iconBg: "#FFFFFF11",
  },
]

export function getIntegrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((integration) => integration.id === id)
}

export function collectEnvKeysForIntegrations(integrationIds: string[]): string[] {
  const keys = new Set<string>()
  for (const integrationId of integrationIds) {
    for (const envKey of getIntegrationById(integrationId)?.envKeys ?? []) {
      keys.add(envKey)
    }
  }
  return Array.from(keys)
}
