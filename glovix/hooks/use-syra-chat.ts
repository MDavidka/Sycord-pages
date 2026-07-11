import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message, ModelType } from '../lib/ai'
import { agentActivityToToolCall } from '../lib/agentActivity'
import { loadAgentSession } from '../lib/agentSession'
import { probeBackgroundAgent } from '../lib/resumeAgentActivity'
import { getHostProjectId, getEmbeddedChatId } from '../lib/api'
import { useStore } from '../store'
import { triggerAgentResponse, resumePendingAgentResponse } from '../lib/triggerAgentResponse'
import type { SyraToolCallUI } from '../../types/syra'

type UseSyraChatOptions = {
  model: ModelType
  activeSkillIds?: string[]
  chatId?: string | null
  user?: { uid: string } | null
  onAiComplete?: () => void
}

function messageFromStore(msg: Message, status: 'idle' | 'streaming' | 'done' | 'error' = 'done') {
  const content =
    typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('\n')
        : ''

  return {
    id: crypto.randomUUID(),
    role: msg.role as 'user' | 'assistant',
    content,
    thinking: msg.thinking,
    thinkingDuration: msg.thinkingDuration,
    toolCalls: (msg.agentActivities || []).map(agentActivityToToolCall),
    status,
    createdAt: Date.now(),
  }
}

export function useSyraChat(options: UseSyraChatOptions) {
  const messages = useStore((s) => s.messages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [agentBackground, setAgentBackground] = useState(false)
  const [agentResuming, setAgentResuming] = useState(false)
  const [workspaceReady, setWorkspaceReady] = useState<boolean | null>(null)
  const [pendingAskUser, setPendingAskUser] = useState<{ question: string; messageId: string } | null>(
    null,
  )

  const abortRef = useRef<AbortController | null>(null)
  const resumeAbortRef = useRef<AbortController | null>(null)
  const detachOnExitRef = useRef(false)
  const resumeCheckedRef = useRef(false)

  const projectId = getHostProjectId()

  const syraMessages = messages.map((m, i) =>
    messageFromStore(
      m,
      isStreaming && i === messages.length - 1 && m.role === 'assistant' ? 'streaming' : 'done',
    ),
  )

  const ensureWorkspace = useCallback(async () => {
    if (!projectId) {
      setWorkspaceReady(true)
      return true
    }
    setWorkspaceReady(null)
    try {
      const res = await fetch('/api/workspace/syte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'create_project' }),
      })
      const data = await res.json()
      const ok = Boolean(data?.ok || data?.uuid || data?.status === 'created')
      setWorkspaceReady(ok)
      return ok
    } catch {
      setWorkspaceReady(false)
      return false
    }
  }, [projectId])

  useEffect(() => {
    void ensureWorkspace()
  }, [ensureWorkspace])

  // Resume background agent when Syra reopens
  useEffect(() => {
    if (!projectId || resumeCheckedRef.current) return
    resumeCheckedRef.current = true

    const session = loadAgentSession(projectId)
    void (async () => {
      const probe = await probeBackgroundAgent(projectId)
      if (!session?.pending && !probe.processing) return

      setAgentResuming(true)
      setIsStreaming(true)
      resumeAbortRef.current = new AbortController()

      await resumePendingAgentResponse({
        projectId,
        chatId: options.chatId || getEmbeddedChatId() || undefined,
        user: options.user,
        signal: resumeAbortRef.current.signal,
        onAiComplete: options.onAiComplete,
      })

      setAgentResuming(false)
      setAgentBackground(false)
      setIsStreaming(false)
      resumeAbortRef.current = null
    })()

    return () => {
      resumeAbortRef.current?.abort()
      resumeAbortRef.current = null
    }
  }, [projectId, options.chatId, options.user, options.onAiComplete])

  useEffect(() => {
    return () => {
      if (isStreaming && detachOnExitRef.current) {
        abortRef.current?.abort()
      }
    }
  }, [isStreaming])

  const cancel = useCallback(() => {
    detachOnExitRef.current = false
    abortRef.current?.abort()
    abortRef.current = null
    resumeAbortRef.current?.abort()
    resumeAbortRef.current = null
    setIsStreaming(false)
    setAgentBackground(false)
    setAgentResuming(false)
  }, [])

  const sendMessage = useCallback(
    async (userMessage: Message) => {
      if (isStreaming) return

      if (projectId && workspaceReady === false) {
        const ready = await ensureWorkspace()
        if (!ready) throw new Error('Syte workspace is not ready. Try again in a moment.')
      }

      setIsStreaming(true)
      setAgentBackground(false)
      setAgentResuming(false)
      detachOnExitRef.current = true
      abortRef.current = new AbortController()

      const chatId = options.chatId || getEmbeddedChatId() || undefined

      try {
        const result = await triggerAgentResponse({
          userMessage,
          chatId,
          user: options.user,
          model: options.model,
          activeSkillIds: options.activeSkillIds,
          abortSignal: abortRef.current.signal,
          detachOnAbort: true,
          onBackground: () => setAgentBackground(true),
          onAiComplete: options.onAiComplete,
        })

        if (result === 'detached') {
          setAgentBackground(true)
        }

        const last = useStore.getState().messages.at(-1)
        const askItem = last?.agentActivities?.find((a) => a.eventType === 'asking_user')
        if (askItem) {
          setPendingAskUser({
            question: askItem.detail || askItem.title || 'The agent needs your input.',
            messageId: String(last?.agentActivities?.length ?? ''),
          })
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
        detachOnExitRef.current = false
      }
    },
    [
      isStreaming,
      projectId,
      workspaceReady,
      ensureWorkspace,
      options.chatId,
      options.user,
      options.model,
      options.activeSkillIds,
      options.onAiComplete,
    ],
  )

  const answerAskUser = useCallback(
    async (answer: string) => {
      if (!answer.trim() || isStreaming) return
      setPendingAskUser(null)
      useStore.getState().addMessage({ role: 'user', content: answer.trim() })
      await sendMessage({ role: 'user', content: answer.trim() })
    },
    [isStreaming, sendMessage],
  )

  return {
    messages: syraMessages,
    isStreaming,
    agentBackground,
    agentResuming,
    workspaceReady,
    pendingAskUser,
    sendMessage,
    cancel,
    answerAskUser,
    ensureWorkspace,
  }
}
