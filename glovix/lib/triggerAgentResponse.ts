import type { Message, ModelType } from './ai'
import {
  applyAgentStreamEvent,
  createAgentMessageState,
  finalizeAgentMessageState,
} from './applyAgentEvents'
import { useStore } from '../store'
import { saveChatMessages, saveProject, getHostProjectId } from './api'
import { generateAndSaveTitle } from './titleGenerator'
import { streamContinueAgent } from './continueAgent'
import {
  completeAgentSession,
  markAgentSessionPending,
  updateAgentSessionSinceId,
} from './agentSession'
import { resumeAgentActivity } from './resumeAgentActivity'

type TriggerOptions = {
  userMessage: Message
  chatId?: string
  user?: { uid: string } | null
  model: ModelType
  activeSkillIds?: string[]
  abortSignal?: AbortSignal
  detachOnAbort?: boolean
  onAiComplete?: () => void
  onBackground?: () => void
}

function messageText(msg: Message): string {
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
  }
  return ''
}

function syncFromState(
  updateLastMessage: ReturnType<typeof useStore.getState>['updateLastMessage'],
  state: ReturnType<typeof createAgentMessageState>,
) {
  updateLastMessage({
    content: state.assistantText,
    agentActivities: [...state.activities],
    thinking: state.thinkingText || undefined,
    thinkingDuration: state.thinkingDuration,
  })
}

export async function triggerAgentResponse(options: TriggerOptions): Promise<'completed' | 'detached' | 'stopped'> {
  const {
    userMessage,
    chatId,
    user,
    model,
    activeSkillIds = [],
    abortSignal,
    detachOnAbort = false,
    onAiComplete,
    onBackground,
  } = options

  const projectId = getHostProjectId()
  const addMessage = useStore.getState().addMessage
  const updateLastMessage = useStore.getState().updateLastMessage
  const messagesBefore = useStore.getState().messages

  if (messagesBefore.length === 1 && user && chatId) {
    const text = messageText(userMessage)
    if (text) generateAndSaveTitle(text, chatId).catch(() => {})
  }

  addMessage({ role: 'assistant', content: '', agentActivities: [] })
  let state = createAgentMessageState()
  const thinkingStart = Date.now()

  try {
    const outcome = await streamContinueAgent({
      projectId: projectId || undefined,
      message: messageText(userMessage),
      model,
      activeSkillIds,
      signal: abortSignal,
      onEvent: (event) => {
        state = applyAgentStreamEvent(state, event, thinkingStart)
        syncFromState(updateLastMessage, state)

        if (projectId && event.type === 'meta') {
          markAgentSessionPending(projectId, state.sinceId, state.requestId)
        }
        if (projectId && event.type === 'detached') {
          updateAgentSessionSinceId(projectId, event.sinceId, state.requestId)
        }
        if (event.type === 'error') {
          throw new Error(event.message)
        }
      },
    })

    if (outcome === 'detached' && projectId) {
      updateAgentSessionSinceId(projectId, state.sinceId, state.requestId)
      onBackground?.()
      await resumeAgentActivity({
        projectId,
        signal: abortSignal,
        onUpdate: (next) => {
          state = next
          syncFromState(updateLastMessage, state)
        },
        onComplete: () => {
          if (!abortSignal?.aborted) onAiComplete?.()
        },
      })
      return 'completed'
    }

    state = finalizeAgentMessageState(state)
    if (!state.assistantText.trim()) {
      state.assistantText = 'The agent finished without a visible response.'
    }
    syncFromState(updateLastMessage, state)
    if (projectId) completeAgentSession(projectId)
    if (!abortSignal?.aborted) onAiComplete?.()
    return 'completed'
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError' && detachOnAbort && projectId) {
      updateAgentSessionSinceId(projectId, state.sinceId, state.requestId)
      onBackground?.()
      void resumeAgentActivity({
        projectId,
        onUpdate: (next) => {
          state = next
          syncFromState(updateLastMessage, state)
        },
        onComplete: () => {
          onAiComplete?.()
        },
      })
      return 'detached'
    }

    const msg =
      (err as { name?: string })?.name === 'AbortError'
        ? 'Stopped by user.'
        : err instanceof Error
          ? err.message
          : 'Agent failed'

    state = {
      ...state,
      assistantText: msg.startsWith('Error') ? msg : `Error: ${msg}`,
      activities: state.activities.map((a) =>
        a.status === 'running' ? { ...a, status: 'error' as const } : a,
      ),
    }
    syncFromState(updateLastMessage, state)
    if (projectId) completeAgentSession(projectId)
    return (err as { name?: string })?.name === 'AbortError' ? 'stopped' : 'completed'
  } finally {
    if (chatId && user) {
      try {
        const latest = useStore.getState()
        await saveChatMessages(chatId, latest.messages, {
          keepalive: true,
          projectId: getHostProjectId(),
        })
        if (Object.keys(latest.files).length > 0) {
          await saveProject(chatId, user.uid, latest.files)
        }
      } catch {}
    }
  }
}

export async function resumePendingAgentResponse(options: {
  projectId?: string
  chatId?: string
  user?: { uid: string } | null
  onAiComplete?: () => void
  signal?: AbortSignal
}): Promise<boolean> {
  const projectId = options.projectId || getHostProjectId()
  if (!projectId) return false

  const updateLastMessage = useStore.getState().updateLastMessage
  const messages = useStore.getState().messages
  const last = messages[messages.length - 1]

  if (!last || last.role !== 'assistant') {
    useStore.getState().addMessage({ role: 'assistant', content: '', agentActivities: [] })
  }

  let state = createAgentMessageState()

  const resumed = await resumeAgentActivity({
    projectId,
    signal: options.signal,
    onUpdate: (next) => {
      state = next
      syncFromState(updateLastMessage, state)
    },
    onComplete: () => {
      state = finalizeAgentMessageState(state)
      syncFromState(updateLastMessage, state)
      options.onAiComplete?.()
    },
  })

  if (resumed && options.chatId && options.user) {
    try {
      const latest = useStore.getState()
      await saveChatMessages(options.chatId, latest.messages, {
        keepalive: true,
        projectId,
      })
    } catch {}
  }

  return resumed
}
