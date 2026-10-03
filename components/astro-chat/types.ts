export interface PlanStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  notes?: string
}

export interface Plan {
  title: string
  steps: PlanStep[]
}

export interface ToolCallItem {
  id: string
  name: string
  args: Record<string, any>
  result?: any
  status: 'running' | 'completed' | 'failed'
  durationMs?: number
}

export interface QuestionItem {
  id: string
  question: string
  options?: string[]
  question_type?: 'choice' | 'input'
  allow_custom?: boolean
  answer?: string
  toolCallId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  thinking?: string
  thinkingDuration?: number
  plan?: Plan
  toolCalls?: ToolCallItem[]
  question?: QuestionItem
  previewUrl?: string
  isStreaming?: boolean
}

export interface PreviewState {
  status: 'idle' | 'starting' | 'running' | 'error'
  url: string | null
  directUrl?: string | null
  port?: number | null
  domain?: string | null
  error?: string | null
  lastUpdated?: number
}

export interface AstroChatProps {
  projectId?: string
  projectName?: string | null
  userImage?: string | null
  onBack?: () => void
  initialModel?: string
}
