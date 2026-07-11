import { ContinueAgentClient, extractAssistantText } from './client'
import type { AgentStreamEvent } from './types'

const POLL_MS = 400

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

export async function* runContinueAgentTurn(
  baseUrl: string,
  message: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const client = new ContinueAgentClient(baseUrl, headers)
  let lastText = ''
  const autoApproved = new Set<string>()

  yield { type: 'status', status: 'queued' }
  await client.sendMessage(message)
  yield { type: 'status', status: 'running' }

  while (true) {
    if (signal?.aborted) {
      await client.pause().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }

    const state = await client.getState()

    if (state.pendingPermission?.requestId && !autoApproved.has(state.pendingPermission.requestId)) {
      const { requestId, toolName } = state.pendingPermission
      autoApproved.add(requestId)
      yield { type: 'permission', requestId, toolName }
      await client.approvePermission(requestId, true)
      yield { type: 'status', status: `approved:${toolName}` }
    }

    const text = extractAssistantText(state)
    if (text.length > lastText.length) {
      yield { type: 'delta', text: text.slice(lastText.length) }
      lastText = text
    }

    if (!state.isProcessing && state.messageQueueLength === 0) {
      yield { type: 'done' }
      return
    }

    await sleep(POLL_MS, signal)
  }
}
