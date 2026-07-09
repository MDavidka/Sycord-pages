export type ContinueChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ContinueChatMessage {
  role: ContinueChatRole;
  content?: string | null;
  tool_calls?: unknown[];
}

export interface ContinueHistoryItem {
  message: ContinueChatMessage;
  contextItems?: unknown[];
}

export interface ContinueSession {
  sessionId: string;
  title?: string;
  workspaceDirectory?: string;
  history: ContinueHistoryItem[];
}

export interface ContinuePendingPermission {
  toolName: string;
  toolArgs?: unknown;
  requestId: string;
  timestamp?: number;
}

export interface ContinueStateSnapshot {
  session: ContinueSession;
  isProcessing: boolean;
  messageQueueLength: number;
  pendingPermission: ContinuePendingPermission | null;
}

export type AgentStreamEvent =
  | { type: 'status'; status: string }
  | { type: 'delta'; text: string }
  | {
      type: 'activity'
      eventType: string
      title: string
      detail: string
      id?: number
      payload?: Record<string, unknown>
    }
  | { type: 'permission'; requestId: string; toolName: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
