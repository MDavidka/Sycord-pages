import type { Message, ModelType } from './ai'
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

export async function triggerAgentResponse(options: TriggerOptions): Promise<void> {
  const { userMessage, chatId, user, model, activeSkillIds = [], abortSignal, onAiComplete } = options
  const addMessage = useStore.getState().addMessage
  const updateLastMessage = useStore.getState().updateLastMessage
  const messagesBefore = useStore.getState().messages

  if (messagesBefore.length === 1 && user && chatId) {
    const text = messageText(userMessage)
    if (text) generateAndSaveTitle(text, chatId).catch(() => {})
  }

  addMessage({ role: 'assistant', content: '' })
  let assistantText = ''
  let statusLine = ''

  const formatMessage = () => {
    if (assistantText && statusLine) return `${statusLine}\n\n${assistantText}`
    if (assistantText) return assistantText
    return statusLine
  }

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
          updateLastMessage(formatMessage())
        } else if (event.type === 'status') {
          if (event.status === 'running') {
            statusLine = assistantText ? '' : '_Agent is working…_'
          } else if (!event.status.startsWith('retry:') && !event.status.startsWith('agent:')) {
            statusLine = `_${event.status}_`
          }
          if (formatMessage()) {
            updateLastMessage(formatMessage())
          }
        } else if (event.type === 'activity') {
          const line = event.detail || event.title
          if (line) {
            if (event.eventType === 'thinking' || event.eventType === 'request_started') {
              statusLine = `_${line}_`
            } else if (
              event.eventType === 'file_modified' ||
              event.eventType === 'file_created' ||
              event.eventType === 'file_deleted' ||
              event.eventType === 'command_run' ||
              event.eventType === 'tool_call'
            ) {
              statusLine = `_${line}_`
            }
            updateLastMessage(formatMessage())
          }
        } else if (event.type === 'permission') {
          statusLine = `_Running ${event.toolName}…_`
          updateLastMessage(formatMessage())
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      },
    })

    if (!assistantText.trim()) {
      updateLastMessage(statusLine || 'The agent finished without a visible response.');
    }
    if (!abortSignal?.aborted) onAiComplete?.()
  } catch (err: unknown) {
    const msg =
      (err as { name?: string })?.name === 'AbortError'
        ? 'Stopped by user.'
        : err instanceof Error
          ? err.message
          : 'Agent failed'
    updateLastMessage(msg.startsWith('Error') ? msg : `Error: ${msg}`)
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
