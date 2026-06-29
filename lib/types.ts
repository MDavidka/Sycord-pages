export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

export type DeploymentMode = "ssh"

export type DeployFile = {
  path: string
  content: string
}

export type ContainerInfo = {
  projectId: string
  containerName: string
  workspaceName: string
  privateKey: string
  publicKey: string
  host: string
  port: number
  createdAt: Date
}

export type DeployRuntime = {
  mode: DeploymentMode
  domain: string | null
  url: string | null
  status: "deployed" | "failed" | "building"
  health: "healthy" | "unhealthy" | "unknown"
  message?: string
  lastHealthCheckAt: Date
  lastDeployAt: Date
  lastDeployError: string | null
}

export type VpsDebugInfo = {
  host: string
  username: string
  passwordConfigured: boolean
  port: number
}

export type DebugResponse = {
  timestamp: string
  vps: {
    config: VpsDebugInfo
    sshReachable: boolean
    sshError: string | null
    diagnostics: Record<string, unknown>
  }
  containers: {
    total: number
  }
  env: {
    VPS_HOST_set: boolean
    VPS_USERNAME_set: boolean
    VPS_ROOT_PSW_set: boolean
  }
}

export type DeepMemoryEntryKind =
  | "build-failure"
  | "deployment-failure"
  | "import-error"
  | "lesson"
  | "project-state"
  | "decision"
  | "user-preference"
  | "fix"

export type DeepMemoryEntry = {
  id: string
  kind: DeepMemoryEntryKind
  title: string
  content: string
  projectId?: string
  projectName?: string
  tags?: string[]
  createdAt: string
  updatedAt?: string
}

export type DeepMemoryProfile = {
  summary: string
  architectureNotes: string
  recurringIssues: string[]
  trustedPatterns: string[]
  entries: DeepMemoryEntry[]
  lastUpdatedAt: string
}
