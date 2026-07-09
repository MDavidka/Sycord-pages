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
          updateLastMessage(statusLine ? `${statusLine}\n\n${assistantText}` : assistantText)
        } else if (event.type === 'status') {
          statusLine = event.status === 'running' ? `_Agent is working…_` : ''
          if (assistantText || statusLine) {
            updateLastMessage(statusLine && !assistantText ? statusLine : `${statusLine}\n\n${assistantText}`.trim())
          }
        } else if (event.type === 'permission') {
          statusLine = `_Running ${event.toolName}…_`
          updateLastMessage(assistantText ? `${statusLine}\n\n${assistantText}` : statusLine)
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
