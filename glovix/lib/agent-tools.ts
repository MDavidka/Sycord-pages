/**
 * Normalize Syte / Glovix tool names and classify actions for the agent feed.
 * Docs may mark many workspace operations as "command" — we map by what actually happened.
 */

export type AgentToolKind =
  | 'thinking'
  | 'read'
  | 'edit'
  | 'patch'
  | 'command'
  | 'search'
  | 'service'
  | 'validate'
  | 'install'
  | 'preview'
  | 'deploy'
  | 'planning'
  | 'other'

export type NormalizedTool = {
  /** Canonical Glovix tool name used by ActionsList. */
  toolName: string
  kind: AgentToolKind
  /** Short label e.r. "Read file", "Run command". */
  label: string
  /** Path(s) extracted when available. */
  paths: string[]
  /** Shell command string when applicable. */
  command?: string
}

function parseArgs(args: unknown): Record<string, unknown> {
  if (!args) return {}
  if (typeof args === 'object' && !Array.isArray(args)) return args as Record<string, unknown>
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      /* bare command strings sometimes arrive */
      if (args.trim()) return { command: args }
    }
  }
  return {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function collectPaths(parsed: Record<string, unknown>): string[] {
  const paths: string[] = []
  const single = asString(parsed.path) || asString(parsed.file) || asString(parsed.filename)
  if (single) paths.push(single)
  if (Array.isArray(parsed.paths)) {
    for (const p of parsed.paths) if (typeof p === 'string' && p) paths.push(p)
  }
  if (Array.isArray(parsed.files)) {
    for (const f of parsed.files) {
      if (typeof f === 'string' && f) paths.push(f)
      else if (f && typeof f === 'object' && typeof (f as { path?: unknown }).path === 'string') {
        paths.push((f as { path: string }).path)
      }
    }
  }
  const oldPath = asString(parsed.oldPath)
  const newPath = asString(parsed.newPath)
  if (oldPath && newPath) paths.push(`${oldPath} → ${newPath}`)
  else if (oldPath) paths.push(oldPath)
  return paths
}

/** Infer kind from a raw shell command string. */
export function classifyCommand(command: string): AgentToolKind {
  const cmd = command.trim().toLowerCase()
  if (!cmd) return 'command'

  // Read-ish
  if (
    /^(cat|head|tail|less|more|bat|nl)\b/.test(cmd) ||
    /\b(cat|head|tail)\s+[^\n|&;]+$/.test(cmd)
  ) {
    return 'read'
  }

  // Write / patch via redirect or editors
  if (
    /\b(tee|sed\s+-i|perl\s+-i|ruby\s+-i)\b/.test(cmd) ||
    /(^|[^\w])(>|>>)\s*\S+/.test(cmd) ||
    /\b(touch|mkdir|cp|mv|rm|rmdir)\b/.test(cmd)
  ) {
    return 'edit'
  }

  // Install / deps
  if (
    /\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci)\b/.test(cmd) ||
    /\bpip(3)?\s+install\b/.test(cmd) ||
    /\b(apt|apt-get|brew)\s+install\b/.test(cmd)
  ) {
    return 'install'
  }

  // Preview / dev server
  if (/\b(npm|pnpm|yarn|bun)\s+run\s+dev\b/.test(cmd) || /\b(next|vite)\s+dev\b/.test(cmd)) {
    return 'preview'
  }

  // Validate
  if (
    /\b(tsc|eslint|prettier|vitest|jest|pytest|cargo\s+test|go\s+test)\b/.test(cmd) ||
    /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(lint|test|typecheck|check)\b/.test(cmd) ||
    /\bnpx\s+tsc\b/.test(cmd)
  ) {
    return 'validate'
  }

  // Deploy-ish
  if (/\b(docker|compose|kubectl|fly|vercel|netlify)\b/.test(cmd) && /\b(build|up|deploy|push)\b/.test(cmd)) {
    return 'deploy'
  }

  // Search
  if (/^(rg|grep|find|fd|ag)\b/.test(cmd)) return 'search'

  return 'command'
}

const SYTE_ALIASES: Record<string, string> = {
  file_created: 'createFile',
  file_modified: 'editFile',
  file_deleted: 'deleteFile',
  command_run: 'executeCommand',
  writeFile: 'write_file',
  Write: 'write_file',
  Read: 'readFile',
  Edit: 'editFile',
  Bash: 'executeCommand',
  Grep: 'grep',
  Glob: 'listFiles',
  LS: 'listFiles',
}

export function canonicalizeToolName(raw: string): string {
  if (!raw) return 'unknown'
  const trimmed = raw.trim()
  if (SYTE_ALIASES[trimmed]) return SYTE_ALIASES[trimmed]
  // snake_case Syte tools
  if (trimmed === 'read_file') return 'readFile'
  if (trimmed === 'edit_file') return 'editFile'
  if (trimmed === 'delete_file') return 'deleteFile'
  if (trimmed === 'list_files') return 'listFiles'
  if (trimmed === 'execute_command' || trimmed === 'execute_commands') return 'executeCommand'
  return trimmed
}

export function kindForTool(toolName: string, parsed: Record<string, unknown>): AgentToolKind {
  switch (toolName) {
    case 'readFile':
    case 'readMultipleFiles':
    case 'listFiles':
      return 'read'
    case 'createFile':
    case 'editFile':
    case 'deleteFile':
    case 'renameFile':
    case 'batchCreateFiles':
      return 'edit'
    case 'write_file': {
      const start = parsed.startLine
      const end = parsed.endLine
      if (start != null || end != null) return 'patch'
      return 'edit'
    }
    case 'grep':
    case 'searchInFiles':
      return 'search'
    case 'typeCheck':
    case 'lintCheck':
    case 'getErrors':
      return 'validate'
    case 'executeCommand': {
      const command =
        asString(parsed.command) ||
        (Array.isArray(parsed.commands)
          ? parsed.commands.map(c => (typeof c === 'string' ? c : asString((c as { command?: unknown }).command))).join(' && ')
          : '')
      return classifyCommand(command)
    }
    case 'startPreview':
      return 'preview'
    case 'deploy':
      return 'deploy'
    case 'setDomain':
    case 'save':
    case 'createWorkspace':
    case 'integration':
    case 'manageContainer':
    case 'generateDomain':
      return 'service'
    case 'planning':
      return 'planning'
    default:
      return 'other'
  }
}

export function labelForKind(kind: AgentToolKind, toolName: string): string {
  switch (kind) {
    case 'thinking':
      return 'thinking'
    case 'read':
      return 'Read file'
    case 'edit':
      return toolName === 'createFile' ? 'Create file' : toolName === 'deleteFile' ? 'Delete file' : 'Edit file'
    case 'patch':
      return 'Patch file'
    case 'command':
      return 'Run command'
    case 'search':
      return 'Search code'
    case 'service':
      return 'Service'
    case 'validate':
      return 'Validate'
    case 'install':
      return 'Install'
    case 'preview':
      return 'Preview'
    case 'deploy':
      return 'Deploy'
    case 'planning':
      return 'Planning'
    default:
      return toolName || 'Action'
  }
}

/** Stacking group key — consecutive same group stacks in the feed. */
export function stackGroupForKind(kind: AgentToolKind): 'file-read' | 'file-edit' | 'command' | 'search' | 'service' | 'solo' {
  switch (kind) {
    case 'read':
      return 'file-read'
    case 'edit':
    case 'patch':
      return 'file-edit'
    case 'command':
    case 'validate':
    case 'install':
      return 'command'
    case 'search':
      return 'search'
    case 'service':
    case 'preview':
    case 'deploy':
      return 'service'
    default:
      return 'solo'
  }
}

export function normalizeAgentTool(
  rawTool: string,
  args?: unknown,
  detail?: string,
): NormalizedTool {
  let toolName = canonicalizeToolName(rawTool)
  let parsed = parseArgs(args)

  // Syte file_* / command_run often put path/command in detail or payload fields
  if (!parsed.path && detail) {
    const pathMatch = detail.match(/(?:^|\s)([\w./@"' -]+\.[a-zA-Z0-9]{1,12})\b/)
    if (pathMatch && (toolName.startsWith('create') || toolName.startsWith('edit') || toolName.startsWith('read') || toolName.startsWith('delete') || toolName === 'write_file')) {
      parsed = { ...parsed, path: pathMatch[1].replace(/^['"]|['"]$/g, '') }
    }
  }
  if (toolName === 'executeCommand' && !parsed.command) {
    if (detail) parsed = { ...parsed, command: detail }
  }

  // If the agent labeled a read/write as executeCommand but the args clearly are file ops
  if (toolName === 'executeCommand') {
    const paths = collectPaths(parsed)
    const command = asString(parsed.command)
    const kindGuess = classifyCommand(command)
    if (kindGuess === 'read' && paths.length === 0) {
      const m = command.match(/\b(?:cat|head|tail|bat)\s+['"]?([^\s'"]+)/i)
      if (m?.[1]) parsed = { ...parsed, path: m[1] }
    }
  }

  const kind = kindForTool(toolName, parsed)
  // Remap display tool for stacking when a "command" is really a file op
  if (toolName === 'executeCommand') {
    if (kind === 'read') toolName = 'readFile'
    else if (kind === 'edit') toolName = 'editFile'
    else if (kind === 'search') toolName = 'grep'
  }

  const paths = collectPaths(parsed)
  const command = asString(parsed.command) || undefined

  return {
    toolName,
    kind: kindForTool(toolName, parsed),
    label: labelForKind(kindForTool(toolName, parsed), toolName),
    paths,
    command,
  }
}

export function shortFilePath(path: string): string {
  if (!path) return ''
  const NEXT_ROUTE_FILES = new Set([
    'page.tsx', 'page.ts', 'layout.tsx', 'layout.ts', 'route.ts', 'route.tsx',
    'loading.tsx', 'error.tsx', 'not-found.tsx', 'template.tsx', 'default.tsx',
    'globals.css', 'index.tsx', 'index.ts',
  ])
  const parts = path.replace(/\\/g, '/').replace(/\/+$/, '').split('/')
  const base = parts[parts.length - 1] || path
  if (NEXT_ROUTE_FILES.has(base) && parts.length > 1) {
    return `${parts[parts.length - 2]}/${base}`
  }
  return base
}

export function getActionDisplayName(toolName: string, args: string): string {
  const normalized = normalizeAgentTool(toolName, args)
  if (normalized.paths.length === 1) return shortFilePath(normalized.paths[0].split(' → ')[0] || normalized.paths[0])
  if (normalized.paths.length > 1) return `${normalized.paths.length} files`
  if (normalized.command) {
    const cmd = normalized.command.replace(/\s+/g, ' ').trim()
    return cmd.length > 64 ? `${cmd.slice(0, 61)}…` : cmd
  }
  if (normalized.kind === 'search') {
    try {
      const parsed = parseArgs(args)
      return asString(parsed.pattern) || asString(parsed.query) || ''
    } catch {
      return ''
    }
  }
  return ''
}
