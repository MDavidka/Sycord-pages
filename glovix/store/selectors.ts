import { useStore } from './index'

export function useSelectedFile() {
  return useStore((s) => s.selectedFile)
}

export function useFiles() {
  return useStore((s) => s.files)
}

export function useMessages() {
  return useStore((s) => s.messages)
}

export function useTerminalOutput() {
  return useStore((s) => s.terminalOutput)
}

export function useParsedErrors() {
  return useStore((s) => s.parsedErrors)
}

export function usePreviewUrl() {
  return useStore((s) => s.previewUrl)
}

export function useCurrentChatId() {
  return useStore((s) => s.currentChatId)
}

export function useUser() {
  return useStore((s) => s.user)
}

export function useTheme() {
  return useStore((s) => s.theme)
}

export function useIsDeploying() {
  return useStore((s) => s.isDeploying)
}

export function useTokenCount() {
  return useStore((s) => s.tokenCount)
}

export function useAiProvider() {
  return useStore((s) => s.aiProvider)
}

export function useAiModel() {
  return useStore((s) => s.aiModel)
}

export function useSelectedModel() {
  return useStore((s) => s.selectedModel)
}

export function useSystemPrompt() {
  return useStore((s) => s.systemPrompt)
}

export function useElementPicker() {
  return useStore((s) => ({
    active: s.elementPickerActive,
    selected: s.selectedElement,
  }))
}

export function useChats() {
  return useStore((s) => s.chats)
}

export function useUserTokens() {
  return useStore((s) => s.userTokens)
}

export function useIsProjectDirty(filesRef?: Record<string, unknown>) {
  return useStore((s) => Object.keys(s.files).length > 0)
}

export function useFileList() {
  return useStore((s) => Object.keys(s.files))
}

export function useFileContent(path: string) {
  return useStore((s) => s.files[path]?.file?.contents ?? null)
}

export function useErrorCount() {
  return useStore((s) => s.parsedErrors.length)
}

export function useWaitingForEnv() {
  return useStore((s) => {
    const lastMsg = s.messages[s.messages.length - 1]
    if (!lastMsg) return false
    const content = typeof lastMsg.content === 'string' ? lastMsg.content : ''
    return content.includes('⏸') || content.includes('Integrations tab')
  })
}
