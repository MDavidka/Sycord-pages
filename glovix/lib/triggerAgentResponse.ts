import type { Message, ModelType } from './ai'
import type { AgentActivityItem } from './agentActivity'
import { mergeAgentActivity } from './agentActivity'
import { useStore } from '../store'
import { saveChatMessages, saveProject, getHostProjectId } from './api'
import { generateAndSaveTitle } from './titleGenerator'
import { streamContinueAgent } from './continueAgent'

type TriggerOptions = {
  userMessage: Message
  chatId?: string
  user?: { uid: string } | null
  model: ModelType
  activeSkillIds?: string[]
  abortSignal?: AbortSignal
  onAiComplete?: () => void
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

function syncAssistantMessage(
  updateLastMessage: ReturnType<typeof useStore.getState>['updateLastMessage'],
  assistantText: string,
  activities: AgentActivityItem[],
  thinking?: string,
  thinkingDuration?: number,
) {
  updateLastMessage({
    content: assistantText,
    agentActivities: [...activities],
    thinking,
    thinkingDuration,
  })
}

export async function triggerAgentResponse(options: TriggerOptions): Promise<void> {
  const { userMessage, chatId, user, model, activeSkillIds = [], abortSignal, onAiComplete } = options
  const addMessage = useStore.getState().addMessage
  const updateLastMessage = useStore.getState().updateLastMessage
  const messagesBefore = useStore.getState().messages

  if (messagesBefore.length === 1 && user && chatId) {
    const text = messageText(userMessage)
    if (text) generateAndSaveTitle(text, chatId).catch(() => {})
  }

  addMessage({ role: 'assistant', content: '', agentActivities: [] })
  let assistantText = ''
  let activities: AgentActivityItem[] = []
  let thinkingText = ''
  const thinkingStart = Date.now()

  try {
    await streamContinueAgent({
      projectId: getHostProjectId() || undefined,
      message: messageText(userMessage),
      model,
      activeSkillIds,
      signal: abortSignal,
      onEvent: (event) => {
        if (event.type === 'delta') {
          assistantText += event.text
          syncAssistantMessage(updateLastMessage, assistantText, activities, thinkingText || undefined)
        } else if (event.type === 'activity') {
          activities = mergeAgentActivity(activities, {
            id: event.id,
            eventType: event.eventType,
            title: event.title,
            detail: event.detail,
            payload: event.payload,
          })

          if (event.eventType === 'thinking' || event.eventType === 'plan') {
            thinkingText = event.detail || event.title || thinkingText
          }

          if (event.eventType === 'request_completed') {
            const duration = Math.max(1, Math.round((Date.now() - thinkingStart) / 1000))
            syncAssistantMessage(
              updateLastMessage,
              assistantText,
              activities,
              thinkingText || undefined,
              thinkingText ? duration : undefined,
            )
            return
          }

          if (event.eventType === 'request_failed') {
            syncAssistantMessage(updateLastMessage, assistantText, activities, thinkingText || undefined)
            return
          }

          syncAssistantMessage(updateLastMessage, assistantText, activities, thinkingText || undefined)
        } else if (event.type === 'status') {
          if (event.status === 'running') {
            activities = mergeAgentActivity(activities, {
              eventType: 'processing',
              title: 'Working',
              detail: 'Agent is processing…',
            })
            syncAssistantMessage(updateLastMessage, assistantText, activities, thinkingText || undefined)
          }
        } else if (event.type === 'permission') {
          activities = mergeAgentActivity(activities, {
            eventType: 'tool_call',
            title: 'Tool',
            detail: event.toolName,
          })
          syncAssistantMessage(updateLastMessage, assistantText, activities, thinkingText || undefined)
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      },
    })

    if (!assistantText.trim()) {
      const lastActivity = [...activities].reverse().find((a) => a.eventType === 'request_completed')
      if (lastActivity?.detail) {
        assistantText = lastActivity.detail
      }
    }

    if (!assistantText.trim()) {
      syncAssistantMessage(
        updateLastMessage,
        'The agent finished without a visible response.',
        activities.map((a) => (a.status === 'running' ? { ...a, status: 'done' as const } : a)),
        thinkingText || undefined,
      )
    } else {
      const duration = thinkingText ? Math.max(1, Math.round((Date.now() - thinkingStart) / 1000)) : undefined
      syncAssistantMessage(
        updateLastMessage,
        assistantText,
        activities.map((a) => (a.status === 'running' ? { ...a, status: 'done' as const } : a)),
        thinkingText || undefined,
        duration,
      )
    }

    if (!abortSignal?.aborted) onAiComplete?.()
  } catch (err: unknown) {
    const msg =
      (err as { name?: string })?.name === 'AbortError'
        ? 'Stopped by user.'
        : err instanceof Error
          ? err.message
          : 'Agent failed'
    syncAssistantMessage(
      updateLastMessage,
      msg.startsWith('Error') ? msg : `Error: ${msg}`,
      activities.map((a) => (a.status === 'running' ? { ...a, status: 'error' as const } : a)),
      thinkingText || undefined,
    )
  } finally {
    if (chatId && user) {
      try {
        const state = useStore.getState()
        await saveChatMessages(chatId, state.messages, {
          keepalive: true,
          projectId: getHostProjectId(),
        })
        if (Object.keys(state.files).length > 0) {
          await saveProject(chatId, user.uid, state.files)
        }
      } catch {}
    }
  }
}
